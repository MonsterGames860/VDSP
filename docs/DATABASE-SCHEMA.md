# VDSP Realtime Database schema

All client reads/writes are denied by `firebase/database.rules.json`. The API uses Firebase Admin SDK and performs server-side authorization. Never loosen the rules to let clients set trust statuses.

- `developerKeys/{sha256OfSecret}`: ownerId, appId, active, scopes, createdAt. Store only the hash of the API key.
- `scanResults/{fileId}`: hash, detected type, scan state, submitting owner, timestamp and status.
- `fileHashes/{sha256}`: first-seen metadata. Do not treat this node alone as a verdict.
- `blacklist/{sha256}`: `blocked: true`, reason, source, reviewedBy, reviewedAt. Only trusted admin tooling should write this.
- `approvedHashes/{sha256}`: `active: true`, `signatureVerified: true`, keyId, version, reviewedBy, reviewedAt. Only the review/signing service may write this after cryptographic signature verification.
- `auditLog/{eventId}`: append-only security and administrative actions. Production deployment should restrict and export audit logs.

## Status precedence

1. Exact hash on active blacklist => `blocked`.
2. Exact hash with active approval AND verified signature => `approved`.
3. Anything else, including scanner unavailable, scan error, unknown file type or pending review => `unverified`.

A `no_detection` ClamAV result means only that the configured engine reported no detection; it is not a safety guarantee.
