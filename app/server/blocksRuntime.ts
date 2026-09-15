import { createBlocksClient, type BlocksClient, type BlocksUser } from "@seliseblocks/client";
import type { Request } from "express";

// Same tenant settings as the frontend (app/.env); the private API must talk to
// the same Blocks host the browser session was established on, or /me rejects it.
// Lazy: index.ts loads app/.env after imports are hoisted, so read env per call.
export function projectConfig() {
  return {
    apiUrl: process.env.VITE_BLOCKS_API_URL ?? "https://blocksapi.slsblx.com",
    xBlocksKey: process.env.VITE_BLOCKS_X_BLOCKS_KEY ?? "",
    appDomain: process.env.VITE_BLOCKS_APP_DOMAIN ?? "",
  };
}
export { rolesForUser as roles } from "../src/lib/roles";

// Staff branch assignment is stored as a custom IAM attribute; surface it as a
// top-level BranchId so branch-scoped checks work without admin mapping env.
export function withBranch<T extends Record<string, unknown>>(user: T): T {
  if (user.BranchId === undefined || user.BranchId === null || user.BranchId === "") {
    const attributes = user.attributes;
    const branchId = attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>).BranchId : undefined;
    if (typeof branchId === "string" && branchId) return { ...user, BranchId: branchId };
  }
  return user;
}

// The hosted login keeps its API session in host-only cookies on the Blocks API
// domain, which never reach this server, but it also leaves a refresh-token
// cookie (rt_<app-host>) on the app origin. Minting a short-lived access token
// from that cookie through the SDK's own refresh grant is the backend-for-
//frontend way to authenticate same-origin API calls; nothing is logged.
const mintedTokens = new Map<string, { token: string; expires: number }>();
function refreshCookie(req: Request): string | undefined {
  const host = new URL(req.headers.origin ?? (projectConfig().appDomain || "https://localhost")).hostname;
  const match = req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)rt_${host.replace(/\./g, "\\.")}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
async function mintAccessToken(rt: string): Promise<string | undefined> {
  const cached = mintedTokens.get(rt);
  if (cached && Date.now() < cached.expires) return cached.token;
  const boundedFetch: typeof fetch = (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  const issuer = createBlocksClient({ ...projectConfig(), fetch: boundedFetch });
  const response = await issuer.auth.oidc.refreshToken({ refreshToken: rt });
  const token = response.access_token ?? response.accessToken;
  if (!token || response.error) return undefined;
  const ttl = Math.max(1, Number(response.expires_in ?? response.expiresIn ?? 60) - 30) * 1000;
  mintedTokens.set(rt, { token, expires: Date.now() + ttl });
  return token;
}

export function requestClient(req: Request): BlocksClient {
  const config = projectConfig();
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const rt = refreshCookie(req);
  // SDK transport reaches only the fixed Blocks host. When neither a bearer
  // header nor a mintable refresh cookie is available, forward whatever
  // session cookies arrived so cookie-based tenants keep working.
  const transport: typeof fetch = (url, init) => {
    if (new URL(String(url)).origin !== config.apiUrl) throw new Error("Unexpected SDK destination");
    const headers = new Headers(init?.headers);
    if (!bearer && !rt && req.headers.cookie) headers.set("Cookie", req.headers.cookie);
    return fetch(url, { ...init, headers, redirect: "error", signal: AbortSignal.timeout(15000) });
  };
  return createBlocksClient({
    ...config,
    fetch: transport,
    // Prefer an explicit bearer header; otherwise resolve lazily so the
    // refresh grant runs only when the SDK actually needs a token.
    ...(bearer ? { accessToken: bearer } : rt ? { accessToken: () => mintAccessToken(rt) } : {})
  });
}
export function serviceClient(): BlocksClient | undefined {
  const clientId = process.env.BLOCKS_SERVICE_CLIENT_ID;
  const clientSecret = process.env.BLOCKS_SERVICE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  const boundedFetch: typeof fetch = (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  const auth = createBlocksClient({ ...projectConfig(), fetch: boundedFetch });
  let token: string | undefined, expires = 0, pending: Promise<string> | undefined;
  async function resolveToken() {
    if (token && Date.now() < expires) return token;
    pending ??= auth.auth.oidc.clientCredentials({ clientId: clientId!, clientSecret: clientSecret!, scope: process.env.BLOCKS_SERVICE_SCOPE }).then(result => {
      const next = result.access_token ?? result.accessToken;
      if (!next || result.error) throw new Error("Service authentication unavailable");
      token = next; expires = Date.now() + Math.max(1, Number(result.expires_in ?? result.expiresIn ?? 60) - 30) * 1000;
      return next;
    }).finally(() => { pending = undefined; });
    return pending;
  }
  return createBlocksClient({ ...projectConfig(), fetch: boundedFetch, accessToken: resolveToken, onUnauthorized: () => { expires = 0; return resolveToken(); } });
}
export type Row = Record<string, unknown>;
export function payload(response: unknown, operation: string): Row {
  const raw = response as Row;
  if (!raw || raw.isSuccess === false || (Array.isArray(raw.errors) && raw.errors.length)) throw new Error("Gateway rejected request");
  const data = (raw.data ?? raw) as Row;
  return (data[operation] ?? data) as Row;
}
export async function records(client: BlocksClient, schema: string, fields: string[], filter: Row = {}): Promise<Row[]> {
  const result: Row[] = [];
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    const page = payload(await client.data.collection(schema, { fields }).list({ filter, pageNo, pageSize: 100 }), `get${schema}s`);
    if (!Array.isArray(page.items)) throw new Error("Missing gateway records");
    result.push(...page.items as Row[]);
    if (result.length >= Number(page.totalCount ?? result.length)) return result;
    if (!page.items.length) throw new Error("Incomplete gateway page");
  }
  throw new Error("Gateway scan limit reached");
}
