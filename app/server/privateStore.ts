import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PayoutInput, PayoutSummary } from "../src/features/refunds/payoutTypes";

export class PrivateStore {
  readonly db: DatabaseSync;
  constructor(path: string, private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("A 32-byte payout encryption key is required.");
    if (path !== ":memory:") { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); chmodSync(dirname(path), 0o700); }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS payouts(owner TEXT PRIMARY KEY, encrypted TEXT NOT NULL, updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS refunds(case_id TEXT PRIMARY KEY, owner TEXT NOT NULL, branch TEXT NOT NULL, encrypted TEXT NOT NULL, paid TEXT, approval_id TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, recipient TEXT NOT NULL, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ticket_links(case_id TEXT PRIMARY KEY, owner TEXT NOT NULL, branch TEXT NOT NULL, email TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ticket_messages(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, actor TEXT NOT NULL, side TEXT NOT NULL, request_id TEXT NOT NULL, encrypted TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(case_id,actor,request_id));
      CREATE TABLE IF NOT EXISTS ticket_submissions(actor TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, reference TEXT NOT NULL, case_id TEXT, PRIMARY KEY(actor,request_id));
      CREATE TABLE IF NOT EXISTS patient_hospital_ids(owner TEXT NOT NULL, organization_id TEXT NOT NULL, encrypted TEXT NOT NULL, PRIMARY KEY(owner,organization_id));
      CREATE TABLE IF NOT EXISTS patient_active_hospital(owner TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS case_patient_identity(case_id TEXT PRIMARY KEY, owner TEXT NOT NULL, organization_id TEXT NOT NULL, encrypted TEXT NOT NULL);
    `);
  }
  seal(value: unknown, context: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64")).join(".");
  }
  unseal<T>(value: string, context: string): T {
    const [iv, tag, data] = value.split(".").map(part => Buffer.from(part, "base64"));
    if (!iv || !tag || !data) throw new Error("Invalid encrypted record");
    const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8")) as T;
  }
  audit(actor: string, action: string, resource: string) {
    this.db.prepare("INSERT INTO audit(actor,action,resource,created) VALUES(?,?,?,?)").run(actor, action, resource, new Date().toISOString());
  }
  payout(owner: string): { input: PayoutInput; summary: PayoutSummary } | undefined {
    const row = this.db.prepare("SELECT encrypted,updated FROM payouts WHERE owner=?").get(owner);
    if (!row) return undefined;
    const input = this.unseal<PayoutInput>(String(row.encrypted), `payout:${owner}`);
    return { input, summary: { method: input.method, last4: input.accountNumber.slice(-4), updatedAt: String(row.updated) } };
  }
  save(owner: string, input: PayoutInput) {
    this.db.prepare("INSERT INTO payouts VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET encrypted=excluded.encrypted,updated=excluded.updated")
      .run(owner, this.seal(input, `payout:${owner}`), new Date().toISOString());
    this.audit(owner, "payout_saved", owner);
  }
  link(caseId: string, owner: string, branch: string, input: PayoutInput) {
    this.db.prepare("INSERT INTO refunds(case_id,owner,branch,encrypted) VALUES(?,?,?,?) ON CONFLICT(case_id) DO NOTHING")
      .run(caseId, owner, branch, this.seal(input, `refund:${caseId}:${owner}`));
    this.audit(owner, "refund_linked", caseId);
  }
  enqueue(id: string, recipient: string, payload: Record<string, string>) {
    this.db.prepare("INSERT OR IGNORE INTO outbox(id,recipient,payload) VALUES(?,?,?)").run(id, recipient, JSON.stringify(payload));
  }
  patientForCase(caseId: string, creator: unknown): string {
    const identity = this.db.prepare("SELECT owner FROM case_patient_identity WHERE case_id=?").get(caseId);
    const link = this.db.prepare("SELECT owner FROM ticket_links WHERE case_id=?").get(caseId);
    return String(identity?.owner ?? link?.owner ?? creator ?? "");
  }
  close() { this.db.close(); }
}
