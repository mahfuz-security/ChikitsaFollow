export type InboxItem = { id: string; kind: string; reference: string; created: string; read: boolean; caseId: string };
const kinds = ["received", "updated", "deadline", "overdue", "refund_paid", "ticket_received", "ticket_reply", "patient_reply"];
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
export function normalizeInbox(response: unknown) {
  const outer = obj(response), data = obj(outer.data ?? outer);
  if (outer.isSuccess === false || !Array.isArray(data.notifications ?? data.Notifications)) throw new Error("Notification inbox unavailable");
  const rows = (data.notifications ?? data.Notifications) as unknown[];
  const seen = new Set<string>();
  const items: InboxItem[] = [];
  for (const raw of rows) {
    const row = obj(raw);
    let payload = row.denormalizedPayload ?? row.DenormalizedPayload ?? row.payload ?? row.Payload;
    if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { payload = {}; } }
    const body = obj(payload), id = String(row.id ?? row.Id ?? row.itemId ?? "");
    const event = String(body.eventId ?? id);
    if (!id || seen.has(event)) continue;
    seen.add(event);
    items.push({ id, kind: kinds.includes(String(body.kind)) ? String(body.kind) : "generic", reference: /^CF-[A-Z0-9]{8,12}$/.test(String(body.reference)) ? String(body.reference) : "",
      caseId: /^[a-zA-Z0-9_-]{1,100}$/.test(String(body.caseId ?? "")) ? String(body.caseId) : "", created: String(row.createdTime ?? row.CreatedTime ?? ""), read: (row.isRead ?? row.IsRead) === true });
  }
  return { items, unread: Number(data.unReadNotificationsCount ?? data.UnReadNotificationsCount ?? 0), total: Number(data.totalNotificationsCount ?? data.TotalNotificationsCount ?? items.length) };
}
