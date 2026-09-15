import { getValidAccessToken } from "../../lib/blocks/auth";

export async function privateApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = await getValidAccessToken();
  const response = await fetch(`/api/private${path}`, { method, credentials: "include", cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({ error: "service_unavailable" }));
  if (!response.ok || data.error) throw new Error(typeof data.error === "string" ? data.error : "service_unavailable");
  return data as T;
}
