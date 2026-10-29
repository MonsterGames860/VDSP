# VDSP API v0.1

Base URL is your deployed HTTPS endpoint.

## Health
`GET /health` — returns service state and whether a scanner is configured. No credentials required.

## Scan a file
`POST /v1/scan` — multipart/form-data with a `file` field. Requires `Authorization: Bearer <credential>` where credential is either a Firebase Auth ID token or a VDSP developer API key.

Example (trusted server only):

```bash
curl -X POST https://YOUR-VDSP-API/v1/scan \\
  -H "Authorization: Bearer $VDSP_API_KEY" \\
  -F "file=@./sample.zip"
```

Response contains `fileId`, `sha256`, detected file type, `status`, `scanStatus`, `signatureStatus` and a warning. A clean scan never auto-approves a file.

## Query a file hash
`GET /v1/files/{sha256}/status` — returns `blocked`, `approved` or `unverified` based on trusted server-side database records. Use only 64-character SHA-256 hashes.

## Authentication model
- Public application ID: safe to include in clients; identifies an app, does not grant privileged access.
- Firebase ID token: use for logged-in or anonymous web/mobile users; verify it server-side.
- VDSP API key: only for trusted backend-to-backend calls. Do not embed in browser JS, distributed game code, plugins or mods. If a client must call VDSP directly, use Firebase Auth/App Check and narrowly scoped, short-lived tokens instead of a permanent secret.

## Limitations
This starter optionally invokes ClamAV using `CLAMDSCAN_PATH`. If unset or unavailable, the API returns `scanner_unavailable` and leaves the result unverified. This is a starter, not a certified malware-analysis sandbox. Do not execute uploaded files. For production, use an isolated worker/container with no network access, strict CPU/memory/time limits, archive-bomb protections, updated signatures, retention controls, and a review/signature workflow.


## Developer portal endpoints (v0.2)
All these endpoints require `Authorization: Bearer <Firebase ID token>` from a Firebase user with a verified email. Configure Firebase Authentication Email/Password and email verification before use.

- `GET /v1/developer/profile` — creates/returns the signed-in user's Creator ID profile.
- `GET /v1/developer/keys` — lists key metadata only, never secret values.
- `POST /v1/developer/keys` with JSON `{ "label": "My Game Backend" }` — creates a scoped key and returns the secret once.
- `DELETE /v1/developer/keys/:keyId` — revokes a key owned by the signed-in creator.

The permanent API key is for trusted server-to-server requests only. Do not embed it in a browser, downloadable game, plugin or mod. Use Firebase ID tokens or a short-lived backend-issued token in public clients. Creator IDs are identifiers, not proof of trust.
