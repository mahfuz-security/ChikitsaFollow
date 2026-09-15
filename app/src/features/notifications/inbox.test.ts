import { expect, it } from "vitest";
import { normalizeInbox } from "./inbox";
it("normalizes live Blocks casing, ignores arbitrary payload text and deduplicates event IDs", () => {
  const first = { id: "1", denormalizedPayload: JSON.stringify({ kind: "updated", reference: "CF-12345678", caseId: "case-1", eventId: "event-1", text: "PRIVATE VALUE" }), isRead: false };
  const inbox = normalizeInbox({ notifications: [first, { ...first, id: "2" }], unReadNotificationsCount: 2, totalNotificationsCount: 2 });
  expect(inbox.items).toHaveLength(1); expect(inbox.unread).toBe(2); expect(JSON.stringify(inbox)).not.toContain("PRIVATE VALUE");
});
it("never treats an unavailable inbox as empty", () => { expect(() => normalizeInbox({ isSuccess: false })).toThrow(); });
