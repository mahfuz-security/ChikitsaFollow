import type { CaseRow } from "../cases/useCases";

export function caseMetrics(cases: CaseRow[], now = Date.now()) {
  const completed = cases.filter(row => ["closed", "resolved", "verified"].includes(row.Status ?? ""));
  const active = cases.filter(row => !completed.includes(row));
  const verified = cases.filter(row => row.Status === "verified").length;
  // A merely closed complaint is not evidence of resolution.
  const durations = completed.filter(row => ["resolved", "verified"].includes(row.Status ?? "")).flatMap(row => {
    const start = Date.parse(row.CreatedDate ?? "");
    const end = Date.parse(row.ClosedAt ?? "");
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? [(end - start) / 3_600_000] : [];
  });
  return {
    total: cases.length, open: active.length,
    overdue: active.filter(row => Date.parse(row.PromisedAt ?? "") < now).length,
    closed: cases.filter(row => row.Status === "closed").length,
    resolved: cases.filter(row => row.Status === "resolved" || row.Status === "verified").length,
    unverified: cases.filter(row => row.Status === "closed").length,
    verified, rate: completed.length ? Math.round(verified / completed.length * 100) : undefined,
    average: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length * 10) / 10 : undefined
  };
}
