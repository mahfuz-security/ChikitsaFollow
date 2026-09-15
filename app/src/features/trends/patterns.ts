import type { CaseRow } from "../cases/useCases";
export function rootCausePatterns(rows: CaseRow[], now = Date.now()) {
  const start = now - 30 * 24 * 60 * 60 * 1000;
  const groups = new Map<string, { branchId: string; rootCauseId: string; count: number }>();
  for (const row of rows) {
    const date = Date.parse(row.ClosedAt ?? "");
    if (!row.BranchId || !row.RootCauseId || !["closed", "verified", "resolved"].includes(row.Status ?? "") || !Number.isFinite(date) || date < start || date > now) continue;
    const key = JSON.stringify([row.BranchId, row.RootCauseId]);
    const group = groups.get(key) ?? { branchId: row.BranchId, rootCauseId: row.RootCauseId, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.count >= 3).sort((a, b) => b.count - a.count);
}
