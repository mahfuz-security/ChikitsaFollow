import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "./privateStore";
import { payload, records, roles, type Row } from "./blocksRuntime";
import { hasPermission } from "../src/lib/permissions";
import { scanForClinical } from "../src/features/ai/firewall";
import { organizationForCase, hospitalBranchMap, hospitalPatientId, snapshotPatientIdentity } from "./patientHospitals";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const categories = ["report_delay", "instructions", "missed_follow_up", "wait_time", "billing", "staff_behavior", "facility", "communication", "other"] as const;
const fields = ["CreatedBy", "BranchId", "PatientRefCode", "Subject", "Status", "Category", "Severity", "PromisedAt", "CreatedDate", "LastUpdatedDate"];
class TicketError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export type SharedMessage = { id: string; side: string; kind: string; text: string; replyTo?: string; createdAt: string };
function serviceText(text: string) {
  if (!scanForClinical(text).ok || /\b(?:pin|otp|password)\s*[:=]\s*\S+/i.test(text)) throw new TicketError(400, "unsafe_ticket_text");
}
function patientOnly(user: BlocksUser) { return roles(user).includes("patient") && !roles(user).some(role => ["front_desk", "branch_manager", "admin", "clouduser", "quality_lead"].includes(role)); }
export function ticketRoutes(store: PrivateStore, service?: BlocksClient) {
  const router = Router();
  function requireService() { if (!service) throw new TicketError(503, "ticket_service_unavailable"); return service; }
  function summary(row: Row) {
    return { id: String(row.ItemId ?? row.itemId), reference: row.PatientRefCode, subject: row.Subject, status: row.Status, category: row.Category, severity: row.Severity, promisedAt: row.PromisedAt ?? null, updatedAt: row.LastUpdatedDate ?? row.CreatedDate ?? null };
  }
  async function accessible(sdk: BlocksClient, user: BlocksUser, caseId: string, organizationId?: unknown) {
    const patient = patientOnly(user);
    const row = (await records(patient ? requireService() : sdk, "Case", fields, { ItemId: caseId }))[0];
    if (!row || String(row.ItemId ?? row.itemId) !== caseId) throw new TicketError(404, "ticket_not_found");
    if (patient) {
      if (store.patientForCase(caseId, row.CreatedBy) !== user.itemId) throw new TicketError(404, "ticket_not_found");
      if (!organizationId || organizationForCase(store, row) !== organizationId) throw new TicketError(404, "ticket_not_found");
    } else if (!hasPermission(user, "case-read") || (!roles(user).some(role => ["admin", "clouduser", "quality_lead"].includes(role)) && (!user.BranchId || user.BranchId !== row.BranchId))) throw new TicketError(403, "ticket_access_denied");
    return { row, patient };
  }
  function messages(caseId: string): SharedMessage[] {
    return store.db.prepare("SELECT * FROM ticket_messages WHERE case_id=? ORDER BY created,id").all(caseId).map(row => {
      const content = store.unseal<{ text: string; kind: string; replyTo?: string }>(String(row.encrypted), `message:${caseId}:${row.id}`);
      return { id: String(row.id), side: String(row.side), createdAt: String(row.created), text: content.text, kind: content.kind, ...(content.replyTo ? { replyTo: content.replyTo } : {}) };
    });
  }
  const createInput = z.object({ requestId: z.string().uuid(), patientEmail: z.string().trim().email().max(254), patientId: hospitalPatientId, branchId: id, category: z.enum(categories), severity: z.enum(["Low", "Medium", "High"]), subject: z.string().trim().min(1).max(120), commitment: z.string().trim().max(500).default(""), promisedAt: z.string().datetime().optional() }).strict();
  router.post("/tickets", async (req, res) => {
    const user = res.locals.user as BlocksUser, sdk = res.locals.sdk as BlocksClient;
    if (!hasPermission(user, "case-create") || !roles(user).includes("front_desk") || !user.BranchId) throw new TicketError(403, "ticket_access_denied");
    const input = createInput.parse(req.body);
    if (input.branchId !== user.BranchId) throw new TicketError(403, "ticket_access_denied");
    const organizationId = Object.entries(hospitalBranchMap()).find(([, branch]) => branch === input.branchId)?.[0];
    if (!organizationId) throw new TicketError(503, "hospital_not_ready");
    serviceText(input.subject); serviceText(input.commitment);
    if (input.promisedAt && Date.parse(input.promisedAt) <= Date.now()) throw new TicketError(400, "invalid_deadline");
    const email = input.patientEmail.toLowerCase();
    const fingerprint = createHash("sha256").update(JSON.stringify({ ...input, patientEmail: email })).digest("hex");
    const previous = store.db.prepare("SELECT * FROM ticket_submissions WHERE actor=? AND request_id=?").get(user.itemId!, input.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint || !previous.case_id) throw new TicketError(409, "ticket_submission_requires_review");
      res.json({ caseRow: { itemId: previous.case_id }, patientRefCode: previous.reference }); return;
    }
    // Exact-match and bind once to IAM identity, never to a browser-supplied ID.
    const matches: BlocksUser[] = [];
    const directory = requireService();
    for (let pageNo = 1; pageNo <= 100; pageNo++) {
      const page = await directory.iam.users.list({ search: email, pageNo, pageSize: 100 });
      if (page.isSuccess === false || !Array.isArray(page.data)) throw new TicketError(503, "ticket_service_unavailable");
      matches.push(...page.data.filter(candidate => candidate.email?.trim().toLowerCase() === email && candidate.active === true && roles(candidate).includes("patient") && candidate.itemId));
      if (pageNo * 100 >= (page.totalCount ?? page.data.length)) break;
      if (!page.data.length || pageNo === 100) throw new TicketError(503, "ticket_service_unavailable");
    }
    if (matches.length !== 1) throw new TicketError(400, "patient_email_not_available");
    const owner = matches[0]!.itemId!, reference = `CF-${randomBytes(6).toString("hex").toUpperCase()}`;
    store.db.prepare("INSERT INTO ticket_submissions(actor,request_id,fingerprint,reference) VALUES(?,?,?,?)").run(user.itemId!, input.requestId, fingerprint, reference);
    const row: Row = { BranchId: input.branchId, Category: input.category, Severity: input.severity, Subject: input.subject, Status: "open", PatientRefCode: reference };
    if (input.promisedAt) row.PromisedAt = input.promisedAt;
    const created = payload(await sdk.data.collection("Case").create(row), "insertCase");
    const caseId = String(created.itemId ?? created.ItemId ?? "");
    if (!caseId || created.acknowledged === false) throw new TicketError(503, "ticket_submission_requires_review");
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.db.prepare("INSERT INTO ticket_links VALUES(?,?,?,?)").run(caseId, owner, input.branchId, store.seal(email, `ticket-email:${caseId}`));
      snapshotPatientIdentity(store, caseId, owner, organizationId, input.patientId);
      store.db.prepare("UPDATE ticket_submissions SET case_id=? WHERE actor=? AND request_id=?").run(caseId, user.itemId!, input.requestId);
      if (input.commitment) {
        const messageId = randomUUID();
        store.db.prepare("INSERT INTO ticket_messages VALUES(?,?,?,?,?,?,?)").run(messageId, caseId, user.itemId!, "staff", input.requestId, store.seal({ kind: "comment", text: input.commitment }, `message:${caseId}:${messageId}`), new Date().toISOString());
      }
      store.audit(user.itemId!, "patient_linked_case_created", caseId);
      store.enqueue(`ticket-created:${caseId}`, owner, { kind: "ticket_received", caseId, reference });
      store.db.exec("COMMIT");
    } catch (error) { store.db.exec("ROLLBACK"); throw error; }
    res.status(201).json({ caseRow: { itemId: caseId }, patientRefCode: reference });
  });
  router.get("/tickets", async (req, res) => {
    const user = res.locals.user as BlocksUser;
    if (!patientOnly(user)) throw new TicketError(403, "ticket_access_denied");
    const organizationId = id.parse(req.query.organizationId);
    const sdk = requireService();
    const owned = await records(sdk, "Case", fields, { CreatedBy: user.itemId });
    const links = store.db.prepare("SELECT case_id FROM ticket_links WHERE owner=? UNION SELECT case_id FROM case_patient_identity WHERE owner=?").all(user.itemId!, user.itemId!);
    for (const link of links) owned.push(...await records(sdk, "Case", fields, { ItemId: String(link.case_id) }));
    const unique = new Map(owned.filter(row => store.patientForCase(String(row.ItemId ?? row.itemId), row.CreatedBy) === user.itemId && organizationForCase(store, row) === organizationId).map(row => [String(row.ItemId ?? row.itemId), summary(row)]));
    res.json({ tickets: [...unique.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
  });
  router.get("/tickets/:caseId", async (req, res) => {
    const caseId = id.parse(req.params.caseId), user = res.locals.user as BlocksUser;
    const { row } = await accessible(res.locals.sdk, user, caseId, req.query.organizationId);
    const identity = store.db.prepare("SELECT * FROM case_patient_identity WHERE case_id=?").get(caseId);
    const hospitalPatientId = identity ? store.unseal<string>(String(identity.encrypted), `case-patient:${caseId}:${identity.owner}:${identity.organization_id}`) : null;
    res.json({ ticket: summary(row), hospitalPatientId, messages: messages(caseId), canReply: patientOnly(user) || hasPermission(user, "case-send-reply") });
  });
  const messageInput = z.object({ requestId: z.string().uuid(), text: z.string().trim().min(1).max(1000), kind: z.enum(["comment", "reply", "problem_update"]), replyTo: id.optional(), provenance: z.object({ draftSource: z.string().max(64), originalDraft: z.string().max(2000), edited: z.boolean() }).strict().optional() }).strict();
  router.post("/tickets/:caseId/messages", async (req, res) => {
    const caseId = id.parse(req.params.caseId), user = res.locals.user as BlocksUser, input = messageInput.parse(req.body);
    const { row, patient } = await accessible(res.locals.sdk, user, caseId, req.query.organizationId);
    if (!patient && !hasPermission(user, "case-send-reply")) throw new TicketError(403, "ticket_access_denied");
    serviceText(input.text);
    if (input.provenance) { if (patient) throw new TicketError(403, "ticket_access_denied"); serviceText(input.provenance.originalDraft); }
    if (input.replyTo && !store.db.prepare("SELECT id FROM ticket_messages WHERE case_id=? AND id=?").get(caseId, input.replyTo)) throw new TicketError(400, "invalid_reply_target");
    const content = { text: input.text, kind: input.kind, ...(input.replyTo ? { replyTo: input.replyTo } : {}), ...(input.provenance ? { provenance: input.provenance } : {}) };
    const previous = store.db.prepare("SELECT * FROM ticket_messages WHERE case_id=? AND actor=? AND request_id=?").get(caseId, user.itemId!, input.requestId);
    if (previous) {
      if (JSON.stringify(store.unseal(String(previous.encrypted), `message:${caseId}:${previous.id}`)) !== JSON.stringify(content)) throw new TicketError(409, "message_request_changed");
      res.json({ id: previous.id }); return;
    }
    const messageId = randomUUID();
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.db.prepare("INSERT INTO ticket_messages VALUES(?,?,?,?,?,?,?)").run(messageId, caseId, user.itemId!, patient ? "patient" : "staff", input.requestId, store.seal(content, `message:${caseId}:${messageId}`), new Date().toISOString());
      store.audit(user.itemId!, "shared_message_created", caseId);
      if (!patient) store.enqueue(`message:${messageId}`, store.patientForCase(caseId, row.CreatedBy), { kind: "ticket_reply", caseId });
      else store.enqueue(`staff-message:${messageId}`, "branch-staff", { kind: "patient_reply", caseId, branchId: String(row.BranchId) });
      store.db.exec("COMMIT");
    } catch (error) { store.db.exec("ROLLBACK"); throw error; }
    res.status(201).json({ id: messageId });
  });
  router.use((error: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
    res.status(error instanceof TicketError ? error.status : error instanceof z.ZodError ? 400 : 503).json({ error: error instanceof TicketError ? error.message : error instanceof z.ZodError ? "invalid_ticket_request" : "ticket_service_unavailable" });
  });
  return router;
}
