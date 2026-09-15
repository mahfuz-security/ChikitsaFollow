// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "../../../server/privateStore";
import { refundRoutes } from "../../../server/refunds";
import { payoutInput } from "./payoutTypes";

let store: PrivateStore, server: Server, url: string;
let user: BlocksUser;
let decision = "approved", branch = "branch-1";
const create = vi.fn();
const mobile = { method: "bkash" as const, accountName: "Test Patient", accountNumber: "01712345678" };
beforeEach(async () => {
  vi.stubEnv("HOSPITAL_BRANCH_MAP", JSON.stringify({ "org-1": "branch-1" }));
  user = { itemId: "patient-1", roles: ["patient"] }; decision = "approved"; branch = "branch-1";
  create.mockReset().mockResolvedValue({ data: { insertCase: { acknowledged: true, itemId: "case-1" } } });
  store = new PrivateStore(":memory:", Buffer.alloc(32, 5));
  store.db.prepare("INSERT INTO patient_hospital_ids VALUES(?,?,?)").run("patient-1", "org-1", store.seal("HOSP-1234", "hospital-id:patient-1:org-1"));
  const sdk = { iam: { me: async () => ({ data: user }) }, data: { collection: (schema: string) => ({ create,
    list: async () => ({ data: { [`get${schema}s`]: { items: schema === "Branch" ? [{ ItemId: "branch-1", IsActive: true }] : schema === "Case" ? [{ ItemId: "case-1", CreatedBy: "patient-1", BranchId: branch }] : [{ ItemId: "approval-1", CaseId: "case-1", Decision: decision, AmountType: "refund", Amount: "100", Currency: "BDT" }], totalCount: 1 } } }) }) } } as unknown as BlocksClient;
  const app = express(); app.use(express.json()); app.use(refundRoutes({ store, client: () => sdk, allowedOrigins: ["https://clinic.test"], workerEnabled: false }));
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server"); url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); store.close(); vi.unstubAllEnvs(); });
const call = (path: string, method = "GET", body?: unknown, origin = "https://clinic.test") => fetch(url + path, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
function manager() { user = { itemId: "manager-1", roles: ["branch_manager"], BranchId: "branch-1" }; }
it("stores only encrypted financial details and returns a masked summary", async () => {
  expect((await call("/payout", "PUT", mobile)).status).toBe(200);
  const result = await (await call("/payout")).json();
  expect(result.payout).toMatchObject({ method: "bkash", last4: "5678" });
  expect(JSON.stringify(result)).not.toContain(mobile.accountNumber);
  expect(JSON.stringify(store.db.prepare("SELECT * FROM payouts").all())).not.toContain(mobile.accountNumber);
  expect(() => store.unseal(String(store.db.prepare("SELECT encrypted FROM payouts").get()!.encrypted), "payout:other")).toThrow();
});
it("enforces owner isolation, patient role and origin", async () => {
  await call("/payout", "PUT", mobile);
  user.itemId = "patient-2"; expect(await (await call("/payout")).json()).toEqual({ payout: null });
  manager(); expect((await call("/payout", "PUT", mobile)).status).toBe(403);
  expect((await call("/payout", "PUT", mobile, "https://attacker.test")).status).toBe(403);
});
it("rejects an unauthenticated session and does not reveal financial details to front desk", async () => {
  store.link("case-1", "patient-1", "branch-1", mobile);
  user = {}; expect((await call("/payout")).status).toBe(401);
  user = { itemId: "staff-1", roles: ["front_desk"], BranchId: "branch-1" };
  expect(await (await call("/refunds/case-1")).json()).toEqual({ caseId: "case-1", requested: true });
  expect((await call("/refunds/case-1/reveal", "POST", { approvalId: "approval-1" })).status).toBe(403);
});
it("rejects extra secrets and invalid bank/mobile fields", async () => {
  expect((await call("/payout", "PUT", { ...mobile, pin: "1234" })).status).toBe(400);
  expect(payoutInput.safeParse({ ...mobile, accountNumber: "1234" }).success).toBe(false);
  expect(payoutInput.safeParse({ method: "bank", accountName: "Test User", bankName: "Test Bank", branchName: "Test Branch", accountNumber: "12345678", routingNumber: "123456789" }).success).toBe(true);
});
it("creates a refund complaint once and snapshots the destination outside the case", async () => {
  await call("/payout", "PUT", mobile);
  const input = { requestId: "123e4567-e89b-42d3-a456-426614174000", organizationId: "org-1", category: "billing", subject: "Duplicate bill" };
  const response = await call("/refund-complaints", "POST", input); expect(response.status).toBe(201);
  const first = await response.json(); expect(await (await call("/refund-complaints", "POST", input)).json()).toEqual(first);
  expect(create).toHaveBeenCalledTimes(1); expect(JSON.stringify(create.mock.calls)).not.toContain(mobile.accountNumber);
  await call("/payout", "PUT", { ...mobile, accountNumber: "01811112222" });
  expect(await (await call("/refunds/case-1")).json()).toMatchObject({ last4: "5678" });
  await call("/payout", "DELETE"); expect((await call("/refunds/case-1")).status).toBe(200);
});
it("does not replay an ambiguous remote insert", async () => {
  store.save("patient-1", mobile); create.mockRejectedValue(new Error("connection lost"));
  const input = { requestId: "123e4567-e89b-42d3-a456-426614174000", organizationId: "org-1", category: "billing", subject: "Duplicate bill" };
  expect((await call("/refund-complaints", "POST", input)).status).toBe(503);
  expect((await call("/refund-complaints", "POST", input)).status).toBe(409);
  expect(create).toHaveBeenCalledTimes(1);
});
it("requires the correct branch and approved refund before revealing or recording", async () => {
  store.link("case-1", "patient-1", "branch-1", mobile); manager();
  decision = "pending"; expect((await call("/refunds/case-1/reveal", "POST", { approvalId: "approval-1" })).status).toBe(403);
  decision = "approved"; branch = "branch-2"; expect((await call("/refunds/case-1/reveal", "POST", { approvalId: "approval-1" })).status).toBe(403);
  branch = "branch-1"; expect(await (await call("/refunds/case-1/reveal", "POST", { approvalId: "approval-1" })).json()).toEqual({ destination: mobile });
  const body = { approvalId: "approval-1", transactionReference: "TEST1234", confirmed: true };
  expect((await call("/refunds/case-1/paid", "POST", body)).status).toBe(200);
  expect((await call("/refunds/case-1/paid", "POST", body)).status).toBe(200);
  expect(store.db.prepare("SELECT * FROM outbox").all()).toHaveLength(1);
  expect(JSON.stringify(store.db.prepare("SELECT * FROM audit").all())).not.toContain("TEST1234");
});
