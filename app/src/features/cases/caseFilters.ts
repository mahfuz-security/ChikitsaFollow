import type { CaseRow } from "./useCases";
export const CASE_VIEWS = ["all", "active", "done", "mine", "new", "waiting", "overdue", "recent"] as const;
export function matchesCaseView(row: CaseRow, view: string, userId?: string, now = Date.now()) {
  const done = ["closed", "resolved", "verified"].includes(row.Status ?? "");
  switch (view) {
    case "active": return !done;
    case "done": return done;
    case "mine": return Boolean(userId) && row.CreatedBy === userId && !done;
    case "new": return row.Status === "open";
    case "waiting": return ["open", "in_progress", "awaiting_approval"].includes(row.Status ?? "");
    case "overdue": return !done && Date.parse(row.PromisedAt ?? "") < now;
    case "recent": {
      const date = Date.parse(row.LastUpdatedDate ?? row.CreatedDate ?? "");
      return date >= now - 7 * 86400000 && date <= now;
    }
    default: return true;
  }
}
