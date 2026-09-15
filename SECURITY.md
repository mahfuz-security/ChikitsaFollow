# Security

## Reporting A Vulnerability

Use GitHub private vulnerability reporting if enabled for this repository.
Otherwise contact the repository owner privately. Do not post credentials,
patient information, exploit payloads containing live records, or banking data
in a public issue.

## Public Repository Rules

- Never commit environment files, provider keys, service credentials, session cookies, or real account passwords.
- Never commit private databases, payout records, patient exports, certificates, or database backups.
- Keep example environment files credential-free. Public tenant and public OIDC client identifiers are not client secrets.
- Treat every `VITE_` variable as public, including values written into release assets.
- Review staged changes and Git history before publication. Ignore rules do not remove previously committed data.
- Rotate an exposed credential immediately; deleting it from a file or rewriting history does not revoke it.
- Use synthetic records only for screenshots and public demonstrations.

## Deployment Requirements

Server secrets belong in the deployment secret manager, not frontend build
arguments. Use least-privilege service identities and exact allowed origins.
Persist the API's encrypted private database outside the web root and keep its
encryption key separately protected. Review backup access, recovery, retention,
and key rotation before using real data.

Verify authorization at the API and Blocks Data Gateway, including cross-branch
and cross-patient denial tests. Never treat a patient reference or a UI role gate
as sufficient authorization. Test log redaction and notification recipient scope.

Clinical-content screening is best-effort. This repository does not establish
regulatory compliance, medical suitability, or production security certification.
