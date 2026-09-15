// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { BlocksClient } from "@seliseblocks/client";
import { PrivateStore } from "../../../server/privateStore";
import { deadlineKind, deadlineRecipients, notificationTick } from "../../../server/notificationWorker";
const now = Date.parse("2026-09-15T10:00:00Z");
const row = { ItemId: "case-1", BranchId: "branch-1", CreatedBy: "patient-1", PatientRefCode: "CF-12345678", Status: "open", PromisedAt: "2026-09-15T11:00:00Z", LastUpdatedDate: "2026-09-15T09:00:00Z" };
const users = [{ itemId: "patient-1", roles: ["patient"], active: true }, { itemId: "manager-1", roles: ["branch_manager"], BranchId: "branch-1", active: true }, { itemId: "staff-1", roles: ["front_desk"], BranchId: "branch-1", active: true }, { itemId: "other", roles: ["branch_manager"], BranchId: "branch-2", active: true }];
it("warns only for active cases inside the deadline window", () => {
  expect(deadlineKind(row, now)).toBe("deadline");
  expect(deadlineKind(row, now + 3600000)).toBe("overdue");
  expect(deadlineKind({ ...row, Status: "resolved" }, now)).toBeUndefined();
  expect(deadlineKind({ ...row, PromisedAt: "invalid" }, now)).toBeUndefined();
  expect(deadlineKind({ ...row, PromisedAt: "2026-10-01" }, now)).toBeUndefined();
  expect(deadlineRecipients(row, users)).toEqual(["manager-1", "staff-1"]);
});
it("deduplicates reminders, retries failures and sends only safe update metadata to the patient", async () => {
  const store = new PrivateStore(":memory:", Buffer.alloc(32, 8));
  const current = { ...row }; const notify = vi.fn().mockResolvedValue({ isSuccess: true });
  const sdk = { iam: { users: { list: async () => ({ data: users, totalCount: users.length }) } }, notifier: { notify }, data: { collection: (schema: string) => ({ list: async () => ({ data: { [`get${schema}s`]: { items: schema === "Case" ? [current] : [], totalCount: schema === "Case" ? 1 : 0 } } }) }) } } as unknown as BlocksClient;
  try {
    await notificationTick(store, sdk, now); expect(notify).toHaveBeenCalledTimes(2);
    await notificationTick(store, sdk, now); expect(notify).toHaveBeenCalledTimes(2);
    current.LastUpdatedDate = "2026-09-15T10:00:00Z"; notify.mockRejectedValueOnce(new Error("offline"));
    await notificationTick(store, sdk, now); expect(store.db.prepare("SELECT * FROM outbox WHERE sent=0").all()).toHaveLength(1);
    await notificationTick(store, sdk, now + 120000);
    expect(store.db.prepare("SELECT * FROM outbox WHERE sent=0").all()).toHaveLength(0);
    const sent = notify.mock.calls.at(-1)![0]; expect(sent.userIds).toEqual(["patient-1"]);
    expect(Object.keys(JSON.parse(sent.denormalizedPayload)).sort()).toEqual(["caseId", "eventId", "kind", "reference"]);
  } finally { store.close(); }
});
