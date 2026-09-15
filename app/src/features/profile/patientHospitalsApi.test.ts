// @vitest-environment node
import { beforeEach, afterEach, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "../../../server/privateStore";
import { refundRoutes } from "../../../server/refunds";
let store: PrivateStore, server: Server, url: string, user: BlocksUser;
const primary = "7e4a824c-37ea-4956-aa55-ed160b5e8bfc", extra = "77ee73e7-87df-4847-967e-44d5b976b5fc";
beforeEach(async () => {
  user = { itemId: "patient-1", roles: ["patient"], organizationIds: [primary] };
  store = new PrivateStore(":memory:", Buffer.alloc(32, 1));
  const sdk = { iam: { me: async () => ({ data: user }) } } as unknown as BlocksClient;
  const app = express(); app.use(refundRoutes({ store, client: () => sdk, allowedOrigins: ["https://clinic.test"], workerEnabled: false }));
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server"); url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); });
const call = (body?: unknown, origin = "https://clinic.test") => fetch(url + "/patient-hospitals", { method: body ? "POST" : "GET", headers: { Origin: origin, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
it("imports the signup organization and preserves it when adding more hospitals", async () => {
  const initial = await (await call()).json();
  expect(initial.primaryOrganizationId).toBe(primary);
  expect(initial.hospitals.filter((row: {selected: boolean}) => row.selected)).toHaveLength(1);
  expect((await call({ organizationId: extra, patientId: "HOSP-1234" })).status).toBe(200);
  expect((await call({ organizationId: extra, patientId: "HOSP-1234" })).status).toBe(200);
  user = { itemId: "patient-1", roles: ["patient"] };
  const saved = await (await call()).json();
  expect(saved.primaryOrganizationId).toBe(primary);
  expect(saved.hospitals.filter((row: {selected: boolean}) => row.selected)).toHaveLength(2);
  expect(store.db.prepare("SELECT * FROM patient_hospitals").all()).toHaveLength(2);
});
it("isolates accounts and rejects forged owners, roles, hospitals and cross-origin writes", async () => {
  await call({ organizationId: extra, patientId: "HOSP-1234" });
  user = { itemId: "patient-2", roles: ["patient"] };
  expect((await (await call()).json()).primaryOrganizationId).toBeNull();
  expect((await call({ organizationId: extra, owner: "patient-1" })).status).toBe(400);
  expect((await call({ organizationId: extra, roles: ["admin"] })).status).toBe(400);
  expect((await call({ organizationId: "unknown" })).status).toBe(400);
  expect((await call({ organizationId: extra }, "https://other.test")).status).toBe(403);
  user = { itemId: "manager", roles: ["branch_manager"] };
  expect((await call({ organizationId: extra })).status).toBe(403);
});
