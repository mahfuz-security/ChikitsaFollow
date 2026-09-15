// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createAssistantApi } from "../../../server/assistant";

let server: Server;
let url: string;
beforeAll(async () => {
  const api = createAssistantApi({ allowedOrigins: ["https://clinic.test"] });
  server = await new Promise<Server>(resolve => { const instance = api.listen(0, "127.0.0.1", () => resolve(instance)); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server");
  url = `http://127.0.0.1:${address.port}/api/assistant`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
async function ask(body: unknown, origin = "https://clinic.test") {
  return fetch(url, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
describe("Service guidance API", () => {
  it("advertises guided mode without a server-side provider key", async () => {
    expect(await (await fetch(url)).json()).toEqual({ mode: "guided" });
  });
  it("returns reviewed Bangla guidance and disables caching", async () => {
    const response = await ask({ topic: "billing", language: "bn-BD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ source: "guided", text: expect.stringContaining("বিলের") });
  });
  it("rejects free text, case records, arbitrary locales, and untrusted origins", async () => {
    expect((await ask({ topic: "billing", language: "en-US", patientName: "Private name" })).status).toBe(400);
    expect((await ask({ message: "test value 8.5" })).status).toBe(400);
    expect((await ask({ topic: "billing", language: "invalid" })).status).toBe(400);
    expect((await ask({ topic: "billing", language: "en-US" }, "https://untrusted.test")).status).toBe(403);
  });
  it("never generates emergency or clinical guidance", async () => {
    const response = await ask({ topic: "medical", language: "en-US", useAi: true });
    expect(await response.json()).toMatchObject({ source: "guided", text: expect.stringContaining("cannot provide medical advice") });
  });
  it("serves an honest draft template and rejects free-text case input", async () => {
    const headers = { Origin: "https://clinic.test", "Content-Type": "application/json" };
    const valid = await fetch(url + "/draft", { method: "POST", headers, body: JSON.stringify({ category: "billing", severity: "Medium", language: "en-US" }) });
    expect(await valid.json()).toMatchObject({ source: "template", draft: expect.stringContaining("next update") });
    const invalid = await fetch(url + "/draft", { method: "POST", headers, body: JSON.stringify({ category: "billing", severity: "Medium", language: "en-US", Subject: "Private clinical note" }) });
    expect(invalid.status).toBe(400);
  });
});
