# Home PC setup — ChikitsaFollow

Target: bring this repo up on a fresh Windows / macOS / Linux machine so you can
edit the clinical app exactly the way you do on your dev box.

Read `app/README.md` for the in-app README; this file is the *bootstrap guide*
between the dev box and a new home PC.

## 0. Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | `^20.19` or `>=22.12` (see `app/package.json` `engines`) | Vite 8 + Vite 8 deprecated Node 18 and 20.x < 20.19 |
| npm | bundled with Node | package install |
| Git | recent | clone the repo |
| A modern browser | Chrome / Edge / Firefox | runtime + dev preview |
| OpenSSL (Linux/macOS) or PowerShell (Windows) | — | local HTTPS cert via `npm run cert` |

Optional:

- `gh` (GitHub CLI) for `gh auth` instead of typing PATs each push.
- The `seliseblocks` CLI (`npm i -g @seliseblocks/cli-os`) if you want
  `blocks data schema ...` / `blocks iam ...` scripts locally. Not required to
  edit the app.

## 1. Clone

```bash
git clone git@github.com:mahfuz-security/ChikitsaFollow.git
cd ChikitsaFollow
git checkout dev        # dev is the working branch; main starts empty
```

If you don't use SSH keys on the home PC:

```bash
git clone https://github.com/mahfuz-security/ChikitsaFollow.git
cd ChikitsaFollow
git checkout dev
```

## 2. Restore `.env` (the part you can't pull from GitHub)

For tenant-safety reasons (the OIDC client id and tenant key grant access to
the cloud tenant), `app/.env` is **not** committed to the repo. Recreate it
from your dev machine, e.g.:

```bash
# From the dev box:
scp app/.env you@homepc:~/ChikitsaFollow/app/.env
```

Or copy the values manually. Required variables (with the values that match
this project):

```env
VITE_BLOCKS_API_URL=https://blocksapi.slsblx.com
VITE_BLOCKS_X_BLOCKS_KEY=<tenantKey>
VITE_BLOCKS_APP_DOMAIN=<app-domain>
VITE_BLOCKS_OIDC_URL=https://iam.seliseblocks.com
VITE_BLOCKS_OIDC_CLIENT_ID=<public OIDC client id>
VITE_BLOCKS_OIDC_SCOPE=openid profile
VITE_BLOCKS_DEV_HOST=<app-domain>
VITE_BLOCKS_DEV_PORT=5173
```

The tenant key + client id pair live in the Blocks portal under the project
that owns `blocks.json`. If you don't have them yet, ask whoever provisioned
the project.

`app/.env` is the **single combined env file**: it also holds the private API's
server-only settings (`GROQ_API_KEY`, `BLOCKS_SERVICE_CLIENT_ID/SECRET`,
`PAYOUT_ENCRYPTION_KEY`, `APP_ORIGINS`, etc. — see `app/.env.example`). Only
`VITE_`-prefixed values are visible to the browser; the server reads the rest.
There is no separate `app/server/.env` anymore.

## 3. Install dependencies

```bash
cd app
npm install
```

If you see peer-dep warnings from `@seliseblocks/client` or Vite plugins,
ignore them unless `npm install` exits non-zero.

If you want a faster install on a machine you don't trust to compile native
modules, run `npm ci` instead — it pins against `package-lock.json` exactly.

## 4. (Optional but recommended) Generate a local HTTPS cert

`app/.env` points at the *real* project domain over HTTPS (`<app-domain>:5173`
not `localhost`). Run:

```bash
cd app
npm run cert
```

Follow the printed instructions to trust the generated cert in your OS key
store so the browser stops warning. Without this, login fails because Blocks
SSO sets a Secure, domain-scoped cookie that plain `http://localhost` will
not accept.

For dev iterations on `localhost` with mock data, you can skip this and
start at step 5 — the mock build path works fine without HTTPS.

## 5. Run the app

```bash
cd app
npm run dev
```

Open:

- `http://localhost:5173` for a quick boot check (login won't complete over
  plain HTTP on a non-project domain; the form will display but submission
  fails the SSO handshake).
- `https://<app-domain>:5173` for the full Blocks IAM round-trip after step 4
  (this is the development URL the OIDC client was registered for).

The dev server hot-reloads on every save.

## 6. Sanity checks before you start editing

```bash
cd app
npm run lint           # tsc --noEmit, must be clean
npm test              # vitest, must pass (30 tests at last check)
npm run compliance-report   # structural controls DC-1..4 / FR-12 / FR-19 / FR-22
```

If `lint` shows new errors, your checkout's TypeScript isn't aligned with the
SDK pinned in `package.json` — re-run `npm install`.

If `compliance-report` flags a regression, the related feature guards
(serializers, firewall, branch filter, append-only CaseEvent) have drifted —
fix the source of the drift, do not edit the script to make it pass.

## 7. (Optional) Reset / reseat the local tenant cache

If the home PC was previously pointed at a different tenant and you're seeing
phantom auth state, clear:

- Browser cookies for `<app-domain>` and `iam.seliseblocks.com`.
- localStorage entries for `blocks-app:language` and `chikitsa:theme`.
- The Blocks CLI token cache (if installed): `blocks logout`.

## 8. Pushing back to GitHub

From the home PC, after your edits:

```bash
git checkout dev
git add -p                # review each hunk
git commit -m "..."
git push -u origin dev
```

If push is rejected (e.g. someone else pushed first):

```bash
git pull --rebase origin dev
git push origin dev
```

**Secret safety:** never commit `app/.env`, `app/.cert/*`, or anything that
looks like a credential. The repo intentionally has no `.gitignore` because
the dev box chose to ship the working tree whole; at home, prefer adding the
standard exclusions locally:

```bash
# Recommended home-side .gitignore additions (not committed):
echo "app/.env" >> .gitignore
echo "app/.cert/" >> .gitignore
echo "app/node_modules/" >> .gitignore
echo "app/dist/" >> .gitignore
```

That keeps YOUR home checkout small while still letting the dev box's "push
everything" history live on.

## 9. What is NOT going to work from home

- **`blocks git push` / `blocks git pull`** — those need a GitHub integration
  inside the Blocks portal that this project's account doesn't currently
  have. Use plain `git push` / `git pull` instead.
- **`blocks iam *` queries without a Blocks CLI login** — the home PC needs
  its own `blocks login` device flow before those commands work. The app
  itself doesn't need them to run.

## 10. Architectural notes (read once, save hours later)

- **All Blocks API calls go through `@seliseblocks/client`.** See
  [`app/src/lib/blocks/client.ts`](app/src/lib/blocks/client.ts). Don't add
  raw `fetch()` for `*.seliseblocks.com`.
- **Compliance guards are enforced in scripts, not in tests.** The script
  `scripts/compliance-report.ts` is what you run to verify DC-1..4 and
  FR-12/19/22 are still in place. Test files are for behavior, not policy.
- **The design system spec lives outside the app:**
  `ChikitsaFollow-Design-System.md` at the repo root. The implementation in
  `app/src/app/styles.css` and `app/tailwind.config.ts` is the source of
  truth for colors, spacing, and glass levels — both should converge on the
  spec.
- **The clinical firewall (`app/src/features/ai/firewall.ts`) is policy, not
  heuristics.** Anyone changing it should re-read FR-19 in
  `ChikitsaFollow-AI-Agent-SRS.md` first.
