# ChikitsaFollow

Service-recovery application built with React, Vite, TypeScript, and Blocks IAM/Data/Localization. Patients land on their service desk; staff see role-gated case workflows.

See [SRS implementation status](../SRS-IMPLEMENTATION.md) for implemented flows and production blockers. The interface and client-side safeguards do not certify cloud authorization or healthcare compliance.

## Assistant And Languages

Run `npm run start:api` alongside Vite for reviewed service guidance and optional
server-side Groq drafts. Without provider configuration, reviewed templates remain
available. See [server setup](server/README.md); never put a provider key in a
`VITE_` variable. The backend must be deployed separately from the static frontend.

The common module has 358 English and 358 Bangla keys published in Blocks dev.
`npm run export:localization` regenerates local dictionaries; publishing changes
requires a Blocks CLI dry-run and approval. German coverage is partial.

Every Blocks API call in this app goes through [`@seliseblocks/client`](https://www.npmjs.com/package/@seliseblocks/client) via a single `createBlocksClient()` instance in `src/lib/blocks/client.ts` — there is no hand-written `fetch()` wrapper for Blocks endpoints anywhere in this app. Each SDK module is exercised in context rather than in one dedicated demo panel: `auth` in the hosted login flow, `iam` on the Profile page and user menu, and `localization` in `LocalizationProvider`. Add more pages under `src/features/` as your app needs them.

## Setup

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` and verify every public setting against your
Blocks project, including `VITE_BLOCKS_OIDC_CLIENT_ID`. Local environment files
are not distributed with this repository. See the [project guide](../README.md)
for the private API and release prerequisites.

## Public signup clinics

The signup clinic picker uses `src/features/organizations/signupClinicCatalog.ts`,
a project-scoped directory of public clinic names and IDs. The IAM organization
list requires authentication, so anonymous signup must not call that admin endpoint.
IAM still validates signup and organization membership on the server.

After adding, renaming, or disabling an organization in Blocks OS, run
`npm run sync:signup-clinics` with Blocks CLI 0.5.0 authenticated to this project.
This command reads all organization pages and exports only active names and IDs;
it does not change cloud records. Rebuild and deploy to update a deployed signup
page. Each environment needs its own catalog; a mismatched tenant shows no clinics.

## Login setup (required)

This app signs users in directly against this project's tenant (no CLI-style account impersonation) through Blocks IAM's hosted IdP controller. Before login will work, register a **public** OIDC client for this app in Blocks IAM with:

- `redirect_uris`: EVERY origin the app is served from, each with `/login/callback` -- your dev origin, and each deployed URL. `blocks release setup` assigns a random-suffixed domain (find it via `blocks release repos list --json`, the `url` field), and until that origin's callback is registered the first login there fails with `redirect_uri_not_registered`; `blocks release deploy --register-callback` registers it for you.
- `client_type`: `public` (no client secret — this is a browser app and cannot keep one; this scaffold never asks for or ships a client secret).
- `tenant_id` used for login: this project's tenant (`VITE_BLOCKS_X_BLOCKS_KEY`).

Then set `VITE_BLOCKS_OIDC_CLIENT_ID` in `.env` to the new client's id. Until then, the login page shows a setup notice instead of failing silently.

## Testing login locally over HTTPS on the real project domain

Blocks SSO sets a **Secure, domain-scoped** session-related cookie as part of the OIDC exchange; browsers refuse to store or send that on plain `http://localhost`. To test the real login flow locally, run the dev server on the project's actual domain over HTTPS instead of `localhost`:

1. Find the app's registered Blocks domain in the Blocks OS project settings, or ask whoever created the project. It must match the OIDC redirect URI's host.
2. Point it at your machine — add to your hosts file (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` as Administrator): `127.0.0.1  <domain>`.
3. Confirm `.env` has `VITE_BLOCKS_DEV_HOST=<domain>` (generated from `--app-domain`) and `VITE_BLOCKS_DEV_PORT=5173`.
4. Generate a local HTTPS cert for that exact domain: `npm run cert`. Trust it in your OS store to remove the browser warning (command printed by the script), then restart the browser.
5. `npm run dev` -> open `https://<domain>:<port>` (not `localhost`).
6. Register that exact origin's `/login/callback` as a redirect URI on the OIDC client — byte-for-byte, including the port.

`.cert/` is gitignored — each developer generates and trusts their own cert.

## Blocks Release deployment

The scaffold includes `Dockerfile` and `nginx.conf` for Blocks Release. The Release service must pass Docker build arg `ci_build=<environment>` plus the public `VITE_BLOCKS_*` build args documented in the Dockerfile. The generated `package.json` also provides `build:dev`, `build:test`, `build:stg`, `build:iat`, `build:uat`, `build:preprod`, `build:prodshadow`, and `build:prod` scripts for local checks.

During each environment build, `scripts/write-release-env.mjs` writes `dist/env.<environment>` from client-safe Docker build args or local `.env` files. Root `.env` remains gitignored and must not be committed.

## What's included

- `/login` — login page (redirects to Blocks IAM).
- `/login/callback` — completes the hosted IAM callback via `blocksClient.auth.idp.callback()`, then returns to the page you started from.
- `/` and `/profile` — protected; redirect to `/login` when signed out.
- Sidebar + topbar shell matching the `@seliseblocks/blocks-kit` look (icon-only rail on narrow screens, avatar dropdown, notifications menu, active-item accent bar).
- `blocks/localization/*.en.json` local i18n seed files for AI or human edits. Sync them through `blocks localization validate` and `blocks localization push`; the runtime app reads Localization service data through `blocksClient.localization`.

IAM's hosted login sets the session as a **Secure, httpOnly** cookie by default -- this app never reads, stores, or refreshes a token itself. "Signed in" is determined by calling `blocksClient.auth.userInfo()` (`GET /iam/v4/auth/me`), which the browser's cookie authenticates automatically; this is different from `blocksClient.iam.me()`, the full IAM profile call used on the Profile page. Logging out calls `blocksClient.auth.logout()` so IAM ends the session server-side. A cached bearer token (and `blocksClient.auth.oidc.refreshToken()` to refresh it) is only used if a tenant's OIDC config explicitly returns tokens in the response body instead of a cookie.
