VDSP SECURE API STARTER (v0.2)
==============================

WHAT IS INCLUDED
- Firebase Admin-backed Node.js API
- Browser/client-safe Firebase ID-token auth support
- Server-only VDSP API keys stored as SHA-256 hashes
- File upload size cap, rate limit, SHA-256 fingerprint, MIME sniffing
- Optional ClamAV scan integration
- Hash reputation endpoint and deny-by-default Firebase database rules
- Schema and API documentation
- Transparent VDSP logo embedded in the standalone web page
- Developer portal with Firebase email/password sign-in, verified-email gating, Creator ID provisioning, one-time API key creation, key listing and revocation

IMPORTANT SECURITY RULE
Never put a secret API key into public HTML, a browser script, a distributed game client, or a downloadable mod. Those files can be inspected. Put the API key on a trusted server. Client-side code may contain a public application ID, and should use Firebase Authentication/App Check or short-lived scoped tokens.

REQUIREMENTS
- Node.js 20+
- Firebase project with Realtime Database
- Firebase service-account credentials for the API server only
- Optional ClamAV installed and configured for actual malware scanning

SETUP
1. Create Realtime Database in Firebase Console and copy its exact URL.
2. Copy .env.example to .env and set FIREBASE_DATABASE_URL.
3. Create a Firebase service account for server use. Set GOOGLE_APPLICATION_CREDENTIALS to the absolute path of that JSON file. Never upload it to a website or commit it to source control.
4. Apply firebase/database.rules.json in Firebase Realtime Database Rules. These rules deny all direct client reads/writes; the server uses Admin SDK.
5. Run `npm install`.
6. For local testing, run `npm start`. Default bind is 127.0.0.1. Put behind HTTPS/reverse proxy for deployment; configure HOST=0.0.0.0 only when you understand your hosting firewall.
7. For malware scanning, install and update ClamAV, configure its daemon, then set CLAMDSCAN_PATH to the correct clamdscan path. Without it, results stay unverified.
8. Provision a server API key with `npm run provision-key -- <ownerId> [appId]`. Copy the key from terminal once. It is shown only once. Never use it in a game/browser client.

TEST
- GET http://127.0.0.1:8787/health
- POST /v1/scan with multipart field `file` and a Firebase ID token or server API key.
- GET /v1/files/<64-char-sha256>/status

STATUS POLICY
- Blacklist hit => blocked.
- A ClamAV detection => blocked pending human/security review.
- Clean scan, scanner error/unavailable, unknown file type, or missing signature => unverified.
- Approved must be created only by a separate trusted review/signing workflow that verifies the exact file hash and cryptographic signature.

This package is a starter scaffold, not a finished or certified antivirus product. Do not claim any file is completely safe based on one scanner result. See docs/API.md and docs/DATABASE-SCHEMA.md.

Logo is embedded directly in index.html. The developer portal creates Creator IDs after verified-email sign-in and lets users create/revoke API keys. Keys are returned only once. Review PRODUCTION-CHECKLIST.md before deployment.
