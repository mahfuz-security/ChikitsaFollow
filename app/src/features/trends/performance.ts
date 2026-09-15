import type { CaseRow } from "../cases/useCases";
import { caseMetrics } from "./metrics";

export function branchPerformance(rows: CaseRow[], branchIds: string[] = [], now = Date.now()) {
  const ids = new Set([...branchIds, ...rows.flatMap(row => row.BranchId ? [row.BranchId] : [])]);
  return [...ids].map(branchId => {
    const cases = rows.filter(row => row.BranchId === branchId);
    const recent = cases.filter(row => { const date = Date.parse(row.CreatedDate ?? ""); return date >= now - 7 * 86400000 && date <= now; }).length;
    const previous = cases.filter(row => { const date = Date.parse(row.CreatedDate ?? ""); return date >= now - 14 * 86400000 && date < now - 7 * 86400000; }).length;
    return { branchId, ...caseMetrics(cases, now), recent, previous, spike: recent >= 3 && recent >= Math.max(1, previous) * 2 };
  }).sort((a, b) => b.total - a.total);
}

export function complaintBreakdown(rows: CaseRow[], field: "Category" | "Severity" | "RootCauseId") {
  const counts = new Map<string, number>();
  rows.forEach(row => { const key = row[field]; if (key) counts.set(key, (counts.get(key) ?? 0) + 1); });
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}
