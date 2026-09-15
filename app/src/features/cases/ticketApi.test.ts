// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "../../../server/privateStore";
import { refundRoutes } from "../../../server/refunds";
let store: PrivateStore, server: Server, url: string, user: BlocksUser;
let cases: Record<string, unknown>[];
const create = vi.fn();
const patient = { itemId: "patient-1", email: "patient@example.test", active: true, roles: ["patient"] };
beforeEach(async () => {
  vi.stubEnv("HOSPITAL_BRANCH_MAP", JSON.stringify({ "org-1": "branch-1" }));
  user = { itemId: "staff-1", roles: ["front_desk"], BranchId: "branch-1" }; cases = [];
  create.mockReset().mockImplementation(async (row: Record<string, unknown>) => { cases.push({ ...row, ItemId: "case-1", CreatedBy: user.itemId }); return { data: { insertCase: { itemId: "case-1", acknowledged: true } } }; });
  store = new PrivateStore(":memory:", Buffer.alloc(32, 1));
  const sdk = { iam: { me: async () => ({ data: user }), users: { list: async () => ({ data: [patient], totalCount: 1 }) } }, data: { collection: () => ({ create, list: async ({ filter }: { filter: Record<string, unknown> }) => ({ data: { getCases: { items: cases.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)), totalCount: cases.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)).length } } }) }) } } as unknown as BlocksClient;
  const app = express(); app.use(refundRoutes({ store, client: () => sdk, service: sdk, allowedOrigins: ["https://clinic.test"], workerEnabled: false }));
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server"); url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); vi.unstubAllEnvs(); });
const call = (path: string, method = "GET", body?: unknown) => fetch(url + path + "?organizationId=org-1", { method, headers: { Origin: "https://clinic.test", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const input = { requestId: "123e4567-e89b-42d3-a456-426614174000", patientEmail: "PATIENT@example.test", patientId: "HOSP-1234", branchId: "branch-1", subject: "Long wait", category: "wait_time", severity: "Medium", commitment: "We will contact reception." };
it("requires a valid patient email, binds IAM identity, and keeps email off Case and audit", async () => {
  expect((await call("/tickets", "POST", { ...input, patientEmail: "" })).status).toBe(400);
  expect((await call("/tickets", "POST", { ...input, patientEmail: "someone@example.test" })).status).toBe(400);
  expect((await call("/tickets", "POST", input)).status).toBe(201);
  expect((await call("/tickets", "POST", input)).status).toBe(200);
  expect(create).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(cases)).not.toContain("example.test");
  expect(JSON.stringify(store.db.prepare("SELECT * FROM ticket_links").all())).not.toContain("example.test");
  expect(store.patientForCase("case-1", "staff-1")).toBe("patient-1");
});
it("lets the linked patient view and reply, but denies another patient and another branch", async () => {
  await call("/tickets", "POST", input);
  user = patient;
  const inbox = await (await call("/tickets")).json(); expect(inbox.tickets).toHaveLength(1);
  const ticket = await (await call("/tickets/case-1")).json(); expect(ticket.messages[0].side).toBe("staff"); expect(JSON.stringify(ticket)).not.toContain("CreatedBy");
  const message = { requestId: "223e4567-e89b-42d3-a456-426614174000", kind: "problem_update", text: "I am still waiting for the follow-up.", replyTo: ticket.messages[0].id };
  expect((await call("/tickets/case-1/messages", "POST", message)).status).toBe(201);
  expect((await call("/tickets/case-1/messages", "POST", message)).status).toBe(200);
  expect(store.db.prepare("SELECT * FROM ticket_messages").all()).toHaveLength(2);
  user = { ...patient, itemId: "patient-2" };
  expect((await call("/tickets/case-1")).status).toBe(404);
  expect((await call("/tickets/case-1/messages", "POST", message)).status).toBe(404);
  user = { itemId: "staff-2", roles: ["front_desk"], BranchId: "branch-2" };
  expect((await call("/tickets/case-1")).status).toBe(403);
});
it("rejects cross-ticket reply IDs, clinical text, forged identity and review-only manager replies", async () => {
  await call("/tickets", "POST", input); user = patient;
  const message = { requestId: "223e4567-e89b-42d3-a456-426614174000", kind: "reply", text: "Please follow up." };
  expect((await call("/tickets/case-1/messages", "POST", { ...message, replyTo: "other-ticket-message" })).status).toBe(400);
  expect((await call("/tickets/case-1/messages", "POST", { ...message, actor: "staff-1" })).status).toBe(400);
  expect((await call("/tickets/case-1/messages", "POST", { ...message, text: "creatinine 1.4 mg/dL" })).status).toBe(400);
  user = { itemId: "manager-1", roles: ["branch_manager"], BranchId: "branch-1" };
  expect((await call("/tickets/case-1/messages", "POST", message)).status).toBe(403);
});
