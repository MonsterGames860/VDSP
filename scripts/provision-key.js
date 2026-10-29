import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

if (!process.env.FIREBASE_DATABASE_URL) throw new Error('FIREBASE_DATABASE_URL is required');
if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL });
const [ownerId, appId = 'default-app'] = process.argv.slice(2);
if (!ownerId) {
  console.error('Usage: npm run provision-key -- <ownerId> [appId]');
  process.exit(1);
}
const key = 'vdsp_live_' + randomBytes(32).toString('base64url');
const keyHash = createHash('sha256').update(key).digest('hex');
await getDatabase().ref(`developerKeys/${keyHash}`).set({ ownerId, appId, active: true, scopes: ['scan'], createdAt: Date.now(), note: 'Store only the hash in RTDB; this script outputs the secret once.' });
console.log('\nVDSP API key created. Copy it now; it cannot be recovered later.\n');
console.log(`Owner ID: ${ownerId}\nApp ID: ${appId}\nAPI Key: ${key}\n`);
console.log('Keep this key on a trusted server. NEVER embed it in browser JavaScript, a game client, a public repository, or a distributed mod.');
