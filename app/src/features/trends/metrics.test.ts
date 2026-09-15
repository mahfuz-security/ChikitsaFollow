import { expect, it } from "vitest";
import { caseMetrics } from "./metrics";
it("separates closed from verified, excludes completed overdue cases, and uses actual dates", () => {
  const result = caseMetrics([
    { Status: "closed", CreatedDate: "2026-01-01T00:00:00Z", ClosedAt: "2026-01-01T02:00:00Z", PromisedAt: "2026-01-01T00:00:00Z" },
    { Status: "verified", CreatedDate: "2026-01-01T00:00:00Z", ClosedAt: "2026-01-01T02:00:00Z" }, { Status: "open", PromisedAt: "2026-01-01T00:00:00Z" }, { Status: "in_progress" }
  ], Date.parse("2026-01-02T00:00:00Z"));
  expect(result).toMatchObject({ total: 4, open: 2, overdue: 1, verified: 1, unverified: 1, rate: 50, average: 2 });
});
it("does not fabricate a resolution rate when there are no completed cases", () => {
  expect(caseMetrics([]).rate).toBeUndefined();
  expect(caseMetrics([]).average).toBeUndefined();
  expect(caseMetrics([{ Status: "closed", CreatedDate: "2026-01-01", ClosedAt: "2026-01-02" }]).average).toBeUndefined();
});
