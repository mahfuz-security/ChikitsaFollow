import { Router, json, type Request } from "express";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { payoutInput, type PayoutInput } from "../src/features/refunds/payoutTypes";
import { scanForClinical } from "../src/features/ai/firewall";
import { PrivateStore } from "./privateStore";
import { payload, records, requestClient, roles, type Row } from "./blocksRuntime";
import { ticketRoutes } from "./tickets";
import { patientHospitalRoutes, hospitalBranchMap, patientIdentity, snapshotPatientIdentity } from "./patientHospitals";

class Denied extends Error { constructor(readonly status: number, message: string) { super(message); } }
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const complaint = z.object({ requestId: z.string().uuid(), organizationId: id, category: z.enum(["report_delay", "instructions", "missed_follow_up", "wait_time", "billing", "staff_behavior", "facility", "communication", "other"]), subject: z.string().trim().min(1).max(120), refundRequested: z.boolean().default(false) }).strict();
type Config = { store: PrivateStore; client?: (req: Request) => BlocksClient; allowedOrigins: string[]; workerEnabled: boolean; service?: BlocksClient };
export function refundRoutes({ store, client = requestClient, allowedOrigins, workerEnabled, service }: Config) {
  const router = Router();
  store.db.exec("CREATE TABLE IF NOT EXISTS submissions(owner TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, reference TEXT NOT NULL, case_id TEXT, PRIMARY KEY(owner,request_id))");
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (!allowedOrigins.includes(req.headers.origin ?? "") && !["GET", "HEAD"].includes(req.method)) { res.status(403).json({ error: "origin_not_allowed" }); return; }
    next();
  });
  router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));
  router.use(json({ limit: "8kb" }));
  router.use(async (req, res, next) => {
    try {
      const sdk = client(req);
      const result = await sdk.iam.me();
      const user = result.data;
      if (result.isSuccess === false || !user?.itemId || user.active === false) throw new Error("Invalid session");
      res.locals.sdk = sdk; res.locals.user = user; next();
    } catch { res.status(401).json({ error: "authentication_required" }); }
  });
  function patient(user: BlocksUser) {
    if (!roles(user).includes("patient") || roles(user).includes("branch_manager")) throw new Denied(403, "patient_required");
    return user.itemId!;
  }
  const refundRow = (caseId: string) => {
    const row = store.db.prepare("SELECT * FROM refunds WHERE case_id=?").get(caseId);
    if (!row) throw new Denied(404, "refund_not_found");
    return row;
  };
  async function manager(sdk: BlocksClient, user: BlocksUser, caseId: string, approvalId?: string) {
    if (!roles(user).some(role => ["branch_manager", "admin", "clouduser"].includes(role))) throw new Denied(403, "manager_required");
    const row = (await records(sdk, "Case", ["BranchId", "CreatedBy"], { ItemId: caseId }))[0];
    const branch = (user as Row).BranchId;
    if (!row || (row.ItemId ?? row.itemId) !== caseId || (!roles(user).some(role => ["admin", "clouduser"].includes(role)) && (!branch || row.BranchId !== branch))) throw new Denied(403, "wrong_branch");
    const refund = refundRow(caseId);
    if (refund.branch !== row.BranchId || refund.owner !== store.patientForCase(caseId, row.CreatedBy)) throw new Denied(403, "refund_owner_mismatch");
    if (approvalId) {
      const approval = (await records(sdk, "Approval", ["CaseId", "AmountType", "Decision", "Amount", "Currency"], { ItemId: approvalId }))[0];
      if (!approval || (approval.ItemId ?? approval.itemId) !== approvalId || approval.CaseId !== caseId || approval.AmountType !== "refund" || approval.Decision !== "approved" || !(Number(approval.Amount) > 0) || !Number.isFinite(Number(approval.Amount))) throw new Denied(403, "approved_refund_required");
      return { refund, approval };
    }
    return { refund };
  }
  router.get("/status", (_req, res) => res.json({ payoutStorage: true, deadlineWorker: workerEnabled }));
  router.get("/payout", (_req, res) => res.json({ payout: store.payout(patient(res.locals.user))?.summary ?? null }));
  router.put("/payout", (req, res) => {
    const owner = patient(res.locals.user), input = payoutInput.parse(req.body);
    store.save(owner, input); res.json({ payout: store.payout(owner)!.summary });
  });
  router.delete("/payout", (_req, res) => {
    const owner = patient(res.locals.user);
    store.db.prepare("DELETE FROM payouts WHERE owner=?").run(owner); store.audit(owner, "payout_removed", owner);
    res.json({ deleted: true });
  });
  router.post(["/refund-complaints", "/patient-complaints"], async (req, res) => {
    const owner = patient(res.locals.user), input = complaint.parse(req.body), sdk = res.locals.sdk as BlocksClient;
    const branchId = hospitalBranchMap()[input.organizationId];
    const hospitalId = patientIdentity(store, owner, input.organizationId);
    if (!hospitalId) throw new Denied(400, "hospital_patient_id_required");
    if (!branchId) throw new Denied(400, "hospital_not_ready");
    const refundRequested = req.path === "/refund-complaints" || input.refundRequested;
    if (refundRequested && input.category !== "billing") throw new Denied(400, "invalid_refund");
    if (!scanForClinical(input.subject).ok) throw new Denied(400, "clinical_content");
    const fingerprint = createHash("sha256").update(JSON.stringify({ organizationId: input.organizationId, category: input.category, subject: input.subject, refundRequested })).digest("hex");
    const previous = store.db.prepare("SELECT * FROM submissions WHERE owner=? AND request_id=?").get(owner, input.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Denied(409, "request_changed");
      if (!previous.case_id) throw new Denied(409, "submission_requires_review");
      res.json({ reference: previous.reference }); return;
    }
    const payout = store.payout(owner);
    if (refundRequested && !payout) throw new Denied(400, "payout_required");
    const branches = await records(sdk, "Branch", ["IsActive"], { ItemId: branchId, IsActive: true });
    if (!branches.some(row => (row.ItemId ?? row.itemId) === branchId && row.IsActive === true)) throw new Denied(400, "invalid_branch");
    const reference = `CF-${randomBytes(6).toString("hex").toUpperCase()}`;
    // Persist intent before the remote write. Ambiguous failures are not retried
    // as another complaint; the same request key must be reconciled by an operator.
    store.db.prepare("INSERT INTO submissions(owner,request_id,fingerprint,reference) VALUES(?,?,?,?)").run(owner, input.requestId, fingerprint, reference);
    const created = payload(await sdk.data.collection("Case").create({ BranchId: branchId, Category: input.category, Subject: input.subject, Severity: "Medium", Status: "open", PatientRefCode: reference }), "insertCase");
    const caseId = String(created.itemId ?? created.ItemId ?? "");
    if (!caseId || created.acknowledged === false) throw new Denied(503, "submission_requires_review");
    store.db.exec("BEGIN IMMEDIATE");
    try {
      snapshotPatientIdentity(store, caseId, owner, input.organizationId, hospitalId);
      if (refundRequested) store.link(caseId, owner, branchId, payout!.input);
      store.db.prepare("UPDATE submissions SET case_id=? WHERE owner=? AND request_id=?").run(caseId, owner, input.requestId);
      store.enqueue(`received:${caseId}`, owner, { kind: refundRequested ? "received" : "ticket_received", reference, caseId });
      store.db.exec("COMMIT");
    } catch (error) { store.db.exec("ROLLBACK"); throw error; }
    res.status(201).json({ reference });
  });
  router.get("/refunds/:caseId", async (req, res) => {
    const caseId = id.parse(req.params.caseId), user = res.locals.user as BlocksUser;
    const row = refundRow(caseId);
    if (roles(user).includes("front_desk") && !roles(user).includes("branch_manager")) {
      const assigned = user.BranchId;
      const existing = (await records(res.locals.sdk, "Case", ["BranchId"], { ItemId: caseId }))[0];
      if (!assigned || (existing?.ItemId ?? existing?.itemId) !== caseId || existing?.BranchId !== assigned || row.branch !== assigned) throw new Denied(403, "wrong_branch");
      res.json({ caseId, requested: true }); return;
    }
    if (row.owner !== user.itemId) await manager(res.locals.sdk, user, caseId);
    const input = store.unseal<PayoutInput>(String(row.encrypted), `refund:${caseId}:${row.owner}`);
    res.json({ caseId, requested: true, method: input.method, last4: input.accountNumber.slice(-4), paid: Boolean(row.paid) });
  });
  const approvalBody = z.object({ approvalId: id }).strict();
  router.post("/refunds/:caseId/reveal", async (req, res) => {
    const caseId = id.parse(req.params.caseId), { approvalId } = approvalBody.parse(req.body);
    const { refund } = await manager(res.locals.sdk, res.locals.user, caseId, approvalId);
    store.audit(res.locals.user.itemId, "refund_destination_revealed", caseId);
    res.json({ destination: store.unseal<PayoutInput>(String(refund.encrypted), `refund:${caseId}:${refund.owner}`) });
  });
  const paymentBody = z.object({ approvalId: id, transactionReference: z.string().trim().min(4).max(80).regex(/^[a-zA-Z0-9 /_-]+$/), confirmed: z.literal(true) }).strict();
  router.post("/refunds/:caseId/paid", async (req, res) => {
    const caseId = id.parse(req.params.caseId), input = paymentBody.parse(req.body);
    const { refund, approval } = await manager(res.locals.sdk, res.locals.user, caseId, input.approvalId);
    if (refund.paid) { res.json({ recorded: true }); return; }
    store.db.exec("BEGIN IMMEDIATE");
    try {
      const receipt = store.seal({ ...input, amount: approval!.Amount, currency: approval!.Currency, recordedAt: new Date().toISOString(), recordedBy: res.locals.user.itemId }, `receipt:${caseId}`);
      store.db.prepare("UPDATE refunds SET paid=?,approval_id=? WHERE case_id=? AND paid IS NULL").run(receipt, input.approvalId, caseId);
      store.audit(res.locals.user.itemId, "manual_refund_recorded", caseId);
      store.enqueue(`refund-paid:${caseId}`, String(refund.owner), { kind: "refund_paid", caseId });
      store.db.exec("COMMIT");
    } catch (error) { store.db.exec("ROLLBACK"); throw error; }
    res.json({ recorded: true });
  });
  router.use(patientHospitalRoutes(store));
  router.use(ticketRoutes(store, service));
  router.use((error: unknown, _req: Request, res: import("express").Response, _next: import("express").NextFunction) => {
    const status = error instanceof Denied ? error.status : error instanceof z.ZodError ? 400 : 503;
    res.status(status).json({ error: error instanceof Denied ? error.message : status === 400 ? "invalid_request" : "service_unavailable" });
  });
  return router;
}
