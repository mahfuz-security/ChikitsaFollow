# Service Assistant API

The same-origin `/api/assistant` endpoint serves public navigation guidance.
It cannot read cases, issue refunds, diagnose, book appointments, or mutate IAM.

The same server also mounts a separate authenticated `/api/private` refund
service and an optional Blocks notification worker. See
[`REFUNDS-NOTIFICATIONS.md`](../../REFUNDS-NOTIFICATIONS.md) for encryption,
persistent storage, machine credentials and production requirements.

## Local Run

`npm run start:api` starts on loopback port 8787. Vite proxies
`/api/assistant` and `/api/private` to that port over HTTP behind its HTTPS frontend.
Set `APP_ORIGINS` to the exact browser origins, including the port.

The server reads environment variables and optionally loads `server/.env`, never frontend Vite variables. Use the
names in `.env.example` with your process manager or secret manager. Never use
a `VITE_` prefix for a provider credential. The server's `.env` is ignored by git.
With Node 22+ you can use `node --env-file=server/.env --import tsx server/index.ts`.

## Providers

The installed Blocks CLI 0.5.0 and client SDK 0.2.0 do not expose agent/chat
methods. Blocks documents a portal-managed widget, but this repository has no
verified published widget ID or approved agent configuration. Do not invent
one or bypass the SDK with direct Blocks HTTP calls.

The fallback is Groq using the OpenAI-compatible client, configured with
`GROQ_API_KEY`, `GROQ_MODEL`, and `AI_ENABLED=true`. The model is configured by
the operator rather than embedded in client code. Without all three, the UI
accurately reports guided help. Provider failure also falls back to reviewed
guidance. Each generated message is explicitly labeled AI.

Only a topic enum and culture code are accepted. Free text, patient names,
case content, user IDs, and arbitrary keys are rejected by the API schema.
The browser classifies questions locally. No conversation database or prompt
logging is implemented. The model receives curated help text, never the raw
question. Medical and privacy responses bypass generation.
AI assistance is on by default and can be disabled in the chat. Only the topic
and language are shared, never the free-text question. Failed requests show
reviewed guidance with a visible availability notice.

The API uses origin checks, a 2KB JSON limit, a per-IP request limit, upstream
timeouts, no-store response headers, and a fixed provider URL. Public AI also
needs deployment-level global spending/concurrency limits. The in-memory
limiter is per process; use a shared rate-limit store before horizontal scale.
Do not trust arbitrary proxy headers or enable Express trust proxy globally.

## Production Routing

The existing frontend nginx image does not contain a Node server. Deploy the
API separately (the optional Dockerfile here uses `app/` as its build context),
and configure the ingress to send `/api/assistant` to it under the same HTTPS
origin as the frontend. Do not expose port 8787 publicly. Set `APP_ORIGINS` to
the deployed browser origin. Do not route API paths to the SPA fallback.

No cloud deployment was performed by these changes.

## Sources

- [Blocks Agents](https://docs.seliseblocks.com/cloud/agents/): portal and widget capabilities; installed CLI/SDK inventory is the integration boundary here.
- [Groq compatibility](https://console.groq.com/docs/openai): server-side OpenAI-compatible base URL.
- [Groq quickstart](https://console.groq.com/docs/quickstart): chat completion request structure.
