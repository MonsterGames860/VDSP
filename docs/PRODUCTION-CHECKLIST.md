# Before public launch

- [ ] Deploy API only behind HTTPS; do not expose the Firebase service-account JSON.
- [ ] Set `HOST=0.0.0.0` only in a managed hosting environment with firewall rules.
- [ ] Set `CORS_ORIGINS` to exact production origins; do not use wildcard origins with credentials.
- [ ] Enable Firebase Anonymous Authentication for the starter web page, or replace it with your account system.
- [ ] Apply deny-all Realtime Database rules. Keep Admin SDK credentials on the server only.
- [ ] Use App Check where supported and add stronger account-based quotas for production.
- [ ] Install and update ClamAV; verify scanner behavior using benign test files and the EICAR test file in a controlled environment.
- [ ] Run malware scanning in a dedicated, isolated worker/container with no outbound network, non-root user, read-only root filesystem, CPU/RAM/time quotas, archive recursion limits and automatic cleanup.
- [ ] Add archive bomb protection and safely inspect nested archives before advertising support for archives.
- [ ] Keep a human review/signature pipeline for `approvedHashes`; the scan API intentionally cannot create approvals.
- [ ] Add key rotation/revocation UI, audit logs, abuse monitoring, privacy/retention policy, backups and incident response.
- [ ] Add integration tests, dependency scanning and security review before production use.

The included API is a functional starting point, not a certified antivirus service. It never executes uploads. A browser page cannot force an independent game to block a file; game/launcher integrations must check the VDSP verdict and enforce it.
