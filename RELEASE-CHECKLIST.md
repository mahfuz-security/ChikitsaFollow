# Release Checklist

Status: source publication requested by the repository owner; deployment and
production sign-off remain on hold pending the checks below.

## Local Verification: 2026-09-15

### Combined Hosting Follow-Up

The owner selected Blocks hosting for both frontend and API. `app/Dockerfile`
now serves both on port 8080. Updated verification: 108 tests across 29 files
passed, TypeScript checks passed, and the Docker image built successfully.
Local container smoke checks passed for pages, callback routing, assistant JSON,
unauthenticated private-route rejection, hidden environment/source files, and
restart with a local mounted volume. These checks do not prove Blocks persistence.

The Blocks hosting settings query returned `providers: []`. No persistent-volume
configuration command is exposed by the installed Release CLI. Before deployment,
a Blocks operator must confirm the following for this repository:

- `app/` build context and container port 8080.
- A durable volume mounted at `/data`, writable by UID 1000.
- One replica, with no overlapping writers during replacement.
- Runtime secret injection, separate from browser build arguments.
- Least-privilege service credentials, hospital branch mapping, and managed encryption key.

The registered dev callback already matches the target URL. No live deployment
or secret synchronization has been performed in this follow-up.

| Check | Result |
| --- | --- |
| `npm test` | Passed: 104 tests across 28 files. |
| `npm run lint` | Passed: TypeScript checking. |
| `npm run build` | Passed; bundle-size warnings remain. |
| `npm audit --json` | Zero known vulnerabilities reported at check time. |
| Publishable-file secret scan | Gitleaks scanned 253 files before this report update; all four findings were the public Blocks project identifier, manually reviewed as non-secret. |
| Git history secret scan | Both local and fetched remote commits scanned; two findings were the same public project identifier. |
| Additional credential patterns | No provider-key, private-key, or supplied account-password matches in publishable files. |
| Ignore rules | Environment files, private databases, local certificates, and local workspace notes excluded. |
| Remote comparison | Local HEAD and fetched remote `dev` have identical trees but different commit IDs. No push or history replacement performed. |
| Live end-to-end QA | Not passed or certified; cloud and deployment requirements below remain open. |

Secret scanners cannot prove absence of all sensitive information. Review the
final staged diff and rescan after any further edits. Existing trailing spaces
in the user-edited requirements document are Markdown line breaks and were left
unchanged.

## Repository

- [x] Add a root README with audience, workflows, setup, and honest limitations.
- [x] Add root ignore rules for environment files, certificates, private databases, and generated output.
- [ ] Review staged files and scan both the working tree and reachable Git history for secrets.
- [ ] Rotate previously disclosed provider credentials.
- [x] Inspect remote `dev` before pushing; its baseline tree matches the local baseline, so both histories can be preserved.
- [ ] Decide on a license and enable private security reporting before public reuse.

## Application And Cloud

- [ ] Confirm active Branch records and the organization-to-branch mapping.
- [ ] Confirm front-desk and manager branch assignments.
- [ ] Configure a least-privilege service identity for patient lookup and notification processing.
- [ ] Verify case creation by both patient and front desk using live accounts.
- [ ] Verify organization isolation, patient ownership, comment visibility, and management-only amounts.
- [ ] Verify the resolve, root-cause, verification, and closure sequence against the requirements.
- [ ] Verify manager approvals and manual refund recording, including denied operations.
- [ ] Verify near-deadline and patient-update notification delivery.
- [ ] Complete and review the requested quality charts and retrieval-based help.
- [ ] Create and retain 50 clearly identified synthetic showcase cases in Blocks after branch associations are verified.
- [ ] Run desktop/mobile and light/dark UI checks for each role.

## Deployment

- [ ] Run tests, TypeScript checks, and the release build.
- [ ] Deploy the private API; route `/api/assistant` and `/api/private` to it, never the SPA fallback.
- [ ] Configure exact deployed origins and OIDC callback URLs.
- [ ] Provision durable private storage and a managed encryption key; test recovery.
- [ ] Review a Blocks Release dry-run before syncing server secrets or deploying.
- [ ] Confirm the deployed site loads live data and all four role workflows pass.

Do not equate passing local tests with a passing cloud release. Record actual
results and outstanding failures before marking a checklist item complete.
