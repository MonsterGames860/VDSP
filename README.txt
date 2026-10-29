VDSP — SINGLE-SOURCE DEPLOYMENT
================================

The website HTML and API are bundled into one source file: api/[...path].js. package.json, .gitignore, README.txt and vercel.json remain separate because the deployment platform requires project metadata and routing configuration.

REALTIME DATABASE
-----------------
Default database URL is configured as:
https://vdsp-panel-default-rtdb.europe-west1.firebasedatabase.app
You can override it with FIREBASE_DATABASE_URL in Vercel Environment Variables.

VERCEL SETUP
------------
1. Upload/extract this project into a Git repository and import it into Vercel.
2. In Vercel → Project → Settings → Environment Variables, add:
   FIREBASE_DATABASE_URL = https://vdsp-panel-default-rtdb.europe-west1.firebasedatabase.app
   FIREBASE_SERVICE_ACCOUNT_JSON = the complete Firebase service-account JSON as a single-line JSON value
   CORS_ORIGINS = https://YOUR-VERCEL-PROJECT.vercel.app
3. Create the Firebase service account in Firebase Console → Project settings → Service accounts. Keep the JSON private. Never put it in HTML, Git, or this ZIP.
4. Ensure Firebase Authentication → Sign-in method → Email/Password is enabled and verify the account email before signing in.
5. Redeploy after setting environment variables. Then visit the Vercel URL and sign in. The API URL field defaults to the same site origin.

DATABASE RULES
--------------
The API uses Firebase Admin SDK on the server. The Admin SDK bypasses Realtime Database rules, so keep client access closed by default:
{
  "rules": { ".read": false, ".write": false }
}
Do not make the whole database public. The browser must not read/write creator records or developer keys directly.

IMPORTANT LIMITATIONS
---------------------
- The API cannot access Firebase Admin until FIREBASE_SERVICE_ACCOUNT_JSON is configured correctly. Merely adding the database URL is not enough.
- Vercel serverless request body limits can prevent large file uploads; this deployment is primarily suitable for login, profile and key management. Use a dedicated scanning host/object-storage upload flow for large file scanning.
- Malware scanning remains unverified unless a scanner is actually configured. Vercel does not automatically install ClamAV.
- Never embed a permanent developer API key in browser/game code.
- This is a starter scaffold, not a certified antivirus product.
