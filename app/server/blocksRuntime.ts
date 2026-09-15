import { createBlocksClient, type BlocksClient, type BlocksUser } from "@seliseblocks/client";
import type { Request } from "express";

export const projectConfig = { apiUrl: "https://api.seliseblocks.com", xBlocksKey: "D08e00d1169e543c9b2c2ac64060b9358", appDomain: "https://dtdgmi-elgoe.slsblx.com" };
export { rolesForUser as roles } from "../src/lib/roles";
export function requestClient(req: Request): BlocksClient {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  // SDK transport forwards the hosted IAM session only to the fixed Blocks host.
  const transport: typeof fetch = (url, init) => {
    if (new URL(String(url)).origin !== projectConfig.apiUrl) throw new Error("Unexpected SDK destination");
    const headers = new Headers(init?.headers);
    if (!token && req.headers.cookie) headers.set("Cookie", req.headers.cookie);
    return fetch(url, { ...init, headers, redirect: "error", signal: AbortSignal.timeout(15000) });
  };
  return createBlocksClient({ ...projectConfig, accessToken: token, fetch: transport });
}
export function serviceClient(): BlocksClient | undefined {
  const clientId = process.env.BLOCKS_SERVICE_CLIENT_ID;
  const clientSecret = process.env.BLOCKS_SERVICE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  const boundedFetch: typeof fetch = (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  const auth = createBlocksClient({ ...projectConfig, fetch: boundedFetch });
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
  return createBlocksClient({ ...projectConfig, fetch: boundedFetch, accessToken: resolveToken, onUnauthorized: () => { expires = 0; return resolveToken(); } });
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
