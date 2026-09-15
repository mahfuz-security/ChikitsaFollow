// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "../../../server/privateStore";
import { refundRoutes } from "../../../server/refunds";
let store: PrivateStore, server: Server, url: string, user: BlocksUser, cases: Record<string, unknown>[];
const first = "7e4a824c-37ea-4956-aa55-ed160b5e8bfc", second = "77ee73e7-87df-4847-967e-44d5b976b5fc";
beforeEach(async () => {
  vi.stubEnv("HOSPITAL_BRANCH_MAP", JSON.stringify({ [first]: "branch-1", [second]: "branch-2" }));
  user = { itemId: "patient-1", active: true, roles: ["patient"] }; cases = [];
  store = new PrivateStore(":memory:", Buffer.alloc(32, 1));
  const sdk = { iam: { me: async () => ({ data: user }) }, data: { collection: (schema: string) => ({
    create: async (input: Record<string, unknown>) => { const ItemId = `case-${cases.length + 1}`; cases.push({ ...input, ItemId, CreatedBy: user.itemId }); return { data: { insertCase: { itemId: ItemId, acknowledged: true } } }; },
    list: async ({ filter }: { filter: Record<string, unknown> }) => {
      const all = schema === "Branch" ? [{ ItemId: "branch-1", IsActive: true }, { ItemId: "branch-2", IsActive: true }] : cases;
      const items = all.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value));
      return { data: { [`get${schema}s`]: { items, totalCount: items.length } } };
    }
  }) } } as unknown as BlocksClient;
  const app = express(); app.use(refundRoutes({ store, client: () => sdk, service: sdk, allowedOrigins: ["https://clinic.test"], workerEnabled: false }));
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server"); url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); vi.unstubAllEnvs(); });
const call = (path: string, body?: unknown) => fetch(url + path, { method: body ? "POST" : "GET", headers: { Origin: "https://clinic.test", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const create = (organizationId: string) => call("/patient-complaints", { requestId: crypto.randomUUID(), organizationId, subject: "Long wait at reception", category: "wait_time" });
it("separates identical hospital-issued IDs by hospital and authenticated owner", async () => {
  for (const organizationId of [first, second]) {
    expect((await call("/patient-hospitals", { organizationId, patientId: "SAME-1234" })).status).toBe(200);
    expect((await create(organizationId)).status).toBe(201);
  }
  expect((await (await call(`/tickets?organizationId=${first}`)).json()).tickets.map((row: { id: string }) => row.id)).toEqual(["case-1"]);
  expect((await (await call(`/tickets?organizationId=${second}`)).json()).tickets.map((row: { id: string }) => row.id)).toEqual(["case-2"]);
  expect((await call(`/tickets/case-1?organizationId=${second}`)).status).toBe(404);
  expect((await call(`/tickets/case-1/messages?organizationId=${second}`, { requestId: crypto.randomUUID(), text: "Wrong hospital", kind: "comment" })).status).toBe(404);
  user.itemId = "patient-2";
  await call("/patient-hospitals", { organizationId: first, patientId: "SAME-1234" });
  expect((await (await call(`/tickets?organizationId=${first}`)).json()).tickets).toEqual([]);
  expect((await call(`/tickets/case-1?organizationId=${first}`)).status).toBe(404);
  expect(JSON.stringify(cases)).not.toContain("SAME-1234");
  expect(JSON.stringify(store.db.prepare("SELECT * FROM case_patient_identity").all())).not.toContain("SAME-1234");
});
it("requires a patient ID and keeps the original ID snapshot after profile edits", async () => {
  expect((await create(first)).status).toBe(400);
  await call("/patient-hospitals", { organizationId: first, patientId: "ORIGINAL-1234" });
  await create(first);
  await call("/patient-hospitals", { organizationId: first, patientId: "REVISED-5678" });
  const row = store.db.prepare("SELECT encrypted FROM case_patient_identity WHERE case_id='case-1'").get()!;
  expect(store.unseal(String(row.encrypted), `case-patient:case-1:patient-1:${first}`)).toBe("ORIGINAL-1234");
  expect((await call("/patient-hospitals/active", { organizationId: second })).status).toBe(403);
  expect((await call("/patient-hospitals/active", { organizationId: first })).status).toBe(200);
  expect((await (await call("/patient-hospitals")).json()).activeOrganizationId).toBe(first);
});
