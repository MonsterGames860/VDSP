VDSP — VERCEL PROJECT (CORRECTED PACKAGE)
========================================

This archive includes index.html. The previous archive accidentally omitted it.

FILES
-----
- index.html: VDSP website UI
- api/[...path].js: Vercel API handler
- server/index.js: local Node/Fastify server
- package.json, .gitignore, README.txt: kept as separate project files
- vercel.json: routes API requests while allowing index.html to serve at /

FIREBASE REALTIME DATABASE
--------------------------
FIREBASE_DATABASE_URL=https://vdsp-panel-default-rtdb.europe-west1.firebasedatabase.app

VERCEL ENVIRONMENT VARIABLES
----------------------------
FIREBASE_DATABASE_URL = https://vdsp-panel-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_SERVICE_ACCOUNT_JSON = complete service account JSON (secret; Vercel environment variable only)
CORS_ORIGINS = https://YOUR-VERCEL-PROJECT.vercel.app

IMPORTANT
---------
1. Enable Firebase Authentication Email/Password and verify your email.
2. Configure FIREBASE_SERVICE_ACCOUNT_JSON securely, then redeploy. Never commit it or put it in index.html.
3. API code in Vercel must be compatible with the Vercel Node runtime; if deployment logs report a function/runtime error, share the error text.
4. File SHA-256 and an unconfigured scanner are not a malware scan. No detection does not prove a file is safe.
5. This is a starter scaffold, not a certified antivirus product.
