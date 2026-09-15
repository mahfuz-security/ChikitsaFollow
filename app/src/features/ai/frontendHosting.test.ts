// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createAssistantApi } from "../../../server/assistant";
import { mountFrontend } from "../../../server/frontend";

let server: Server;
let origin: string;
const directory = mkdtempSync(join(tmpdir(), "frontend-hosting-"));
beforeAll(async () => {
  writeFileSync(join(directory, "index.html"), "<!doctype html><title>Clinic</title>");
  writeFileSync(join(directory, ".env"), "private-fixture");
  const app = createAssistantApi({ allowedOrigins: [] });
  mountFrontend(app, directory);
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  rmSync(directory, { recursive: true, force: true });
});
describe("Combined frontend and API hosting", () => {
  it("serves pages and the login callback without redirecting to localhost", async () => {
    for (const path of ["/", "/profile", "/login/callback?code=fixture"]) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>Clinic</title>");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("preserves API responses and rejects unknown API routes as JSON", async () => {
    expect(await (await fetch(origin + "/api/assistant")).json()).toEqual({ mode: "guided" });
    const response = await fetch(origin + "/api/private/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
  it("does not serve missing assets, environment files, or server source", async () => {
    for (const path of ["/.env", "/server/index.ts", "/assets/missing.js"]) {
      expect((await fetch(origin + path)).status).toBe(404);
    }
  });
  it("offers liveness without claiming cloud readiness", async () => {
    expect(await (await fetch(origin + "/healthz")).json()).toEqual({ status: "alive" });
  });
});
