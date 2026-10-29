import 'dotenv/config';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { createHash, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileTypeFromBuffer } from 'file-type';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);
if (!process.env.FIREBASE_DATABASE_URL) throw new Error('FIREBASE_DATABASE_URL is required');
if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL });
const db = getDatabase();
const app = Fastify({ logger: true, bodyLimit: MAX_BYTES + 1024 * 1024, requestTimeout: 30000 });
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500').split(',').map(x => x.trim()).filter(Boolean);
await app.register(cors, { origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) cb(null, true); else cb(new Error('Origin not allowed'), false); }, methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type'] });
await app.register(helmet);
await app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1, fields: 8, parts: 10 } });
await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });

// Public app ID is an identifier, NOT a secret. It does not authorize trust/status changes.
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
async function authenticate(req, reply) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) { reply.code(401).send({ error: 'authentication_required' }); return null; }
  const token = header.slice(7).trim();
  if (!token) { reply.code(401).send({ error: 'authentication_required' }); return null; }
  // Server-issued developer keys are stored only as SHA-256 hashes in RTDB.
  const keyHash = sha256(token);
  const keySnap = await db.ref(`developerKeys/${keyHash}`).get();
  if (keySnap.exists() && keySnap.val()?.active === true) {
    const k = keySnap.val();
    await db.ref(`developerKeys/${keyHash}/lastUsedAt`).set(Date.now());
    return { type: 'api_key', ownerId: k.ownerId, appId: k.appId || null, scopes: k.scopes || ['scan'], keyHash };
  }
  // Otherwise validate a Firebase Auth ID token (suitable for user-facing clients).
  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    return { type: 'firebase', ownerId: decoded.uid, appId: null, scopes: ['scan'] };
  } catch {
    reply.code(401).send({ error: 'invalid_credentials' }); return null;
  }
}
async function scanWithClamAV(filePath) {
  const bin = process.env.CLAMDSCAN_PATH;
  if (!bin) return { state: 'scanner_unavailable', engine: null, detail: 'CLAMDSCAN_PATH is not configured' };
  return await new Promise((resolve) => {
    const child = spawn(bin, ['--no-summary', '--', filePath], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', d => stdout += d.toString().slice(0, 4000));
    child.stderr.on('data', d => stderr += d.toString().slice(0, 2000));
    child.on('error', () => resolve({ state: 'scanner_unavailable', engine: 'ClamAV', detail: 'Scanner could not start' }));
    child.on('close', code => {
      if (code === 0) resolve({ state: 'no_detection', engine: 'ClamAV', detail: 'No detection by configured engine; this is not proof of safety' });
      else if (code === 1) resolve({ state: 'detected', engine: 'ClamAV', detail: 'Scanner reported a detection' });
      else resolve({ state: 'scan_error', engine: 'ClamAV', detail: 'Scanner returned an error or timed out' });
    });
  });
}


// Developer portal endpoints: Firebase email/password accounts must have a verified email.
async function requireVerifiedFirebaseUser(req, reply) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) { reply.code(401).send({ error: 'authentication_required' }); return null; }
  try {
    const decoded = await getAuth().verifyIdToken(header.slice(7).trim(), true);
    if (!decoded.email || decoded.email_verified !== true) { reply.code(403).send({ error: 'verified_email_required', message: 'Verify your email address before using developer credentials.' }); return null; }
    return decoded;
  } catch { reply.code(401).send({ error: 'invalid_firebase_token' }); return null; }
}
function creatorIdFor(uid) { return 'VDSP-' + createHash('sha256').update(uid).digest('hex').slice(0, 12).toUpperCase(); }
app.get('/v1/developer/profile', async (req, reply) => {
  const user = await requireVerifiedFirebaseUser(req, reply); if (!user) return;
  const ref = db.ref(`creators/${user.uid}`); let snap = await ref.get();
  if (!snap.exists()) {
    const profile = { creatorId: creatorIdFor(user.uid), uid: user.uid, email: user.email, displayName: String(user.name || user.email.split('@')[0]).slice(0, 60), createdAt: Date.now(), status: 'active' };
    await ref.transaction(current => current || profile); snap = await ref.get();
  }
  const value = snap.val();
  if (value.status !== 'active') return reply.code(403).send({ error: 'creator_account_disabled' });
  return { creatorId: value.creatorId, displayName: value.displayName, email: value.email, createdAt: value.createdAt, status: value.status };
});
app.get('/v1/developer/keys', async (req, reply) => {
  const user = await requireVerifiedFirebaseUser(req, reply); if (!user) return;
  const snap = await db.ref('developerKeys').orderByChild('ownerId').equalTo(user.uid).get();
  const keys = []; snap.forEach(child => { const k = child.val() || {}; keys.push({ keyId: k.keyId || child.key, label: k.label || 'VDSP API key', active: k.active === true, scopes: k.scopes || ['scan'], createdAt: k.createdAt || null, lastUsedAt: k.lastUsedAt || null }); });
  return { keys };
});
app.post('/v1/developer/keys', async (req, reply) => {
  const user = await requireVerifiedFirebaseUser(req, reply); if (!user) return;
  const profileSnap = await db.ref(`creators/${user.uid}`).get();
  if (!profileSnap.exists() || profileSnap.val()?.status !== 'active') return reply.code(403).send({ error: 'creator_profile_required' });
  const label = String(req.body?.label || 'Default application').replace(/[<>\r\n]/g, '').trim().slice(0, 80) || 'Default application';
  const keyId = randomUUID(); const apiKey = 'vdsp_live_' + randomBytes(32).toString('base64url'); const keyHash = sha256(apiKey); const now = Date.now();
  const record = { keyId, ownerId: user.uid, creatorId: profileSnap.val().creatorId, label, active: true, scopes: ['scan'], createdAt: now, lastUsedAt: null };
  await db.ref(`developerKeys/${keyHash}`).set(record);
  await db.ref(`creatorKeyIndex/${user.uid}/${keyId}`).set({ keyHash, label, active: true, createdAt: now });
  await db.ref(`auditLog/${randomUUID()}`).set({ event: 'developer_key_created', ownerId: user.uid, keyId, at: now });
  return reply.code(201).send({ keyId, apiKey, label, scopes: record.scopes, createdAt: now, warning: 'Copy this secret now. It cannot be retrieved later. Never embed it in a public client.' });
});
app.delete('/v1/developer/keys/:keyId', async (req, reply) => {
  const user = await requireVerifiedFirebaseUser(req, reply); if (!user) return;
  const keyId = String(req.params.keyId || ''); const indexRef = db.ref(`creatorKeyIndex/${user.uid}/${keyId}`); const indexSnap = await indexRef.get();
  if (!indexSnap.exists()) return reply.code(404).send({ error: 'key_not_found' });
  const entry = indexSnap.val();
  if (entry.keyHash) await db.ref(`developerKeys/${entry.keyHash}/active`).set(false);
  await indexRef.update({ active: false, revokedAt: Date.now() });
  await db.ref(`auditLog/${randomUUID()}`).set({ event: 'developer_key_revoked', ownerId: user.uid, keyId, at: Date.now() });
  return { keyId, active: false, revoked: true };
});

app.get('/health', async () => ({ service: 'VDSP API', version: '0.1.0', status: 'ok', scannerConfigured: Boolean(process.env.CLAMDSCAN_PATH) }));

app.post('/v1/scan', async (req, reply) => {
  const identity = await authenticate(req, reply);
  if (!identity) return;
  if (!identity.scopes.includes('scan')) return reply.code(403).send({ error: 'insufficient_scope' });
  let part;
  try { part = await req.file(); } catch { return reply.code(400).send({ error: 'invalid_multipart_upload' }); }
  if (!part) return reply.code(400).send({ error: 'file_required' });
  const chunks = []; let total = 0;
  try {
    for await (const chunk of part.file) { total += chunk.length; if (total > MAX_BYTES) return reply.code(413).send({ error: 'file_too_large', maxBytes: MAX_BYTES }); chunks.push(chunk); }
    if (part.file.truncated) return reply.code(413).send({ error: 'file_too_large', maxBytes: MAX_BYTES });
  } catch { return reply.code(400).send({ error: 'upload_failed' }); }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) return reply.code(400).send({ error: 'empty_file' });
  const hash = sha256(buffer);
  const fileType = await fileTypeFromBuffer(buffer).catch(() => undefined);
  const filename = path.basename(part.filename || 'upload.bin').replace(/[\r\n\0]/g, '').slice(0, 160) || 'upload.bin';
  const fileId = randomUUID();
  const blacklist = await db.ref(`blacklist/${hash}`).get();
  if (blacklist.exists() && blacklist.val()?.blocked === true) {
    const record = { fileId, sha256: hash, fileName: filename, size: total, detectedType: fileType?.mime || 'unknown', status: 'blocked', scanStatus: 'blocked_by_hash', signatureStatus: 'not_checked', submittedBy: identity.ownerId, submittedAt: Date.now() };
    await db.ref(`scanResults/${fileId}`).set(record);
    return reply.send({ ...record, message: 'This exact file hash is on the VDSP blocklist.' });
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'vdsp-scan-'));
  const filePath = path.join(dir, 'payload.bin'); // Never trust or execute the supplied filename.
  try {
    await writeFile(filePath, buffer, { mode: 0o600, flag: 'wx' });
    const malware = await scanWithClamAV(filePath);
    // Clean scan alone NEVER confers approval. Approval is a separate signed review workflow.
    const status = malware.state === 'detected' ? 'blocked' : 'unverified';
    const record = {
      fileId, sha256: hash, fileName: filename, size: total,
      detectedType: fileType?.mime || 'unknown', detectedExtension: fileType?.ext || null,
      status, scanStatus: malware.state, scanEngine: malware.engine,
      scanDetail: malware.detail, signatureStatus: 'not_checked',
      submittedBy: identity.ownerId, submittedAt: Date.now(),
      note: 'No detection is not proof that a file is safe. VDSP approval requires separate signature and review checks.'
    };
    await db.ref(`scanResults/${fileId}`).set(record);
    await db.ref(`fileHashes/${hash}`).transaction(current => current || { firstSeenAt: Date.now(), firstSeenBy: identity.ownerId, fileSize: total, detectedType: record.detectedType });
    return reply.send(record);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get('/v1/files/:sha256/status', async (req, reply) => {
  const hash = String(req.params.sha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return reply.code(400).send({ error: 'invalid_sha256' });
  const block = await db.ref(`blacklist/${hash}`).get();
  if (block.exists() && block.val()?.blocked === true) return { sha256: hash, status: 'blocked', reason: block.val()?.reason || 'Security blocklist match' };
  const snap = await db.ref(`approvedHashes/${hash}`).get();
  if (snap.exists() && snap.val()?.active === true && snap.val()?.signatureVerified === true) return { sha256: hash, status: 'approved', keyId: snap.val()?.keyId || null, version: snap.val()?.version || null };
  return { sha256: hash, status: 'unverified' };
});

app.setErrorHandler((error, req, reply) => {
  req.log.error({ err: error }, 'Request failed');
  if (!reply.sent) reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({ error: error.statusCode === 413 ? 'file_too_large' : 'request_failed' });
});
try { await app.listen({ port: PORT, host: HOST }); } catch (err) { app.log.error(err); process.exit(1); }
