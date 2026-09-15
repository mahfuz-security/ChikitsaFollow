import { createHash } from "node:crypto";
import type { BlocksClient, BlocksUser } from "@seliseblocks/client";
import { records, roles, type Row } from "./blocksRuntime";
import { PrivateStore } from "./privateStore";
const safeReference = (value: unknown) => /^CF-[A-Z0-9]{8,12}$/.test(String(value)) ? String(value) : "";

export function deadlineKind(row: Row, now: number, warningHours = 24): "deadline" | "overdue" | undefined {
  if (!["open", "in_progress", "awaiting_approval"].includes(String(row.Status))) return;
  const due = Date.parse(String(row.PromisedAt ?? ""));
  if (!Number.isFinite(due)) return;
  if (due <= now) return "overdue";
  if (due - now <= warningHours * 3600_000) return "deadline";
}
export function deadlineRecipients(row: Row, users: BlocksUser[]) {
  return users.filter(user => user.active !== false && user.itemId && user.BranchId === row.BranchId && row.BranchId && roles(user).some(role => ["front_desk", "branch_manager"].includes(role))).map(user => user.itemId!);
}
export async function notificationTick(store: PrivateStore, sdk: BlocksClient, now = Date.now(), warningHours = 24) {
  const users: BlocksUser[] = [];
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    const page = await sdk.iam.users.list({ pageNo, pageSize: 100 });
    if (page.isSuccess === false || !Array.isArray(page.data)) throw new Error("Cannot resolve notification recipients");
    users.push(...page.data);
    if (users.length >= (page.totalCount ?? users.length)) break;
    if (!page.data.length || pageNo === 1000) throw new Error("Incomplete user scan");
  }
  const cases = await records(sdk, "Case", ["BranchId", "CreatedBy", "CreatedDate", "LastUpdatedDate", "Status", "PromisedAt", "PatientRefCode"]);
  const events = await records(sdk, "CaseEvent", ["CaseId", "EventType", "CreatedDate"]);
  const eventVersions = new Map<string, string[]>();
  for (const event of events) {
    const key = String(event.CaseId), version = `${event.CreatedDate}:${event.ItemId ?? event.itemId}`;
    const versions = eventVersions.get(key) ?? [];
    versions.push(version); eventVersions.set(key, versions);
  }
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of cases) {
      const caseId = String(row.ItemId ?? row.itemId ?? "");
      if (!caseId) continue;
      const reference = safeReference(row.PatientRefCode);
      const kind = deadlineKind(row, now, warningHours);
      if (kind) for (const recipient of deadlineRecipients(row, users)) {
        store.enqueue(`${kind}:${caseId}:${row.PromisedAt}:${recipient}`, recipient, { kind, caseId, reference, due: String(row.PromisedAt) });
      }
      const fingerprint = createHash("sha256").update(JSON.stringify([row.Status, row.PromisedAt, row.LastUpdatedDate, eventVersions.get(caseId)?.sort()])).digest("hex");
      const previous = store.db.prepare("SELECT fingerprint FROM observations WHERE id=?").get(caseId);
      const owner = users.find(user => user.itemId === store.patientForCase(caseId, row.CreatedBy) && user.active !== false && roles(user).includes("patient"));
      if (owner?.itemId && previous && previous.fingerprint !== fingerprint) {
        store.enqueue(`updated:${caseId}:${fingerprint}`, owner.itemId, { kind: "updated", caseId, reference });
      }
      store.db.prepare("INSERT INTO observations VALUES(?,?) ON CONFLICT(id) DO UPDATE SET fingerprint=excluded.fingerprint").run(caseId, fingerprint);
    }
    store.db.exec("COMMIT");
  } catch (error) { store.db.exec("ROLLBACK"); throw error; }
  for (const entry of store.db.prepare("SELECT * FROM outbox WHERE sent=0 AND recipient='branch-staff' LIMIT 100").all()) {
    const data = JSON.parse(String(entry.payload)) as Record<string, string>;
    const row = cases.find(row => (row.ItemId ?? row.itemId) === data.caseId);
    if (row && row.BranchId === data.branchId) for (const recipient of deadlineRecipients(row, users)) {
      store.enqueue(`${entry.id}:${recipient}`, recipient, data);
    }
    store.db.prepare("UPDATE outbox SET sent=1 WHERE id=?").run(String(entry.id));
  }
  const pending = store.db.prepare("SELECT * FROM outbox WHERE sent=0 AND retry_at<=? ORDER BY rowid LIMIT 100").all(now);
  for (const entry of pending) {
    const data = JSON.parse(String(entry.payload)) as Record<string, string>;
    const recipient = users.find(user => user.itemId === entry.recipient && user.active !== false);
    const currentCase = cases.find(row => (row.ItemId ?? row.itemId) === data.caseId);
    // Recheck scope at delivery time; a queued reminder must not survive a
    // branch reassignment, changed deadline, or completed case.
    const deadline = data.kind === "deadline" || data.kind === "overdue";
    const allowed = recipient && currentCase && (deadline
      ? deadlineRecipients(currentCase, [recipient]).length && deadlineKind(currentCase, now, warningHours) === data.kind && currentCase.PromisedAt === data.due
      : data.kind === "patient_reply" ? deadlineRecipients(currentCase, [recipient]).length
      : roles(recipient).includes("patient") && store.patientForCase(String(data.caseId), currentCase.CreatedBy) === recipient.itemId);
    if (!allowed) { store.db.prepare("UPDATE outbox SET sent=2 WHERE id=?").run(String(entry.id)); continue; }
    try {
      const response = await sdk.notifier.notify({ userIds: [String(entry.recipient)], denormalizedPayload: JSON.stringify({ ...data, reference: safeReference(currentCase!.PatientRefCode), eventId: entry.id }), saveDenormalizedPayloadAsAnObject: true, contentAvailable: true });
      if (response?.isSuccess === false || (Array.isArray(response?.errors) && response.errors.length)) throw new Error("Delivery rejected");
      store.db.prepare("UPDATE outbox SET sent=1 WHERE id=?").run(String(entry.id));
    } catch {
      const attempts = Number(entry.attempts) + 1;
      store.db.prepare("UPDATE outbox SET attempts=?,retry_at=? WHERE id=?").run(attempts, now + Math.min(3600_000, 30_000 * 2 ** Math.min(attempts, 7)), String(entry.id));
    }
  }
}
export function startNotificationWorker(store: PrivateStore, sdk: BlocksClient, warningHours = 24) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await notificationTick(store, sdk, Date.now(), warningHours); }
    catch { console.warn("Notification scan failed; it will retry. Check service permissions and connectivity."); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => void run(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
