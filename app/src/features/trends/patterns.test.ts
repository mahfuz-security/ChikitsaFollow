import { expect, it } from "vitest";
import { rootCausePatterns } from "./patterns";
it("groups recurring root causes by branch within the last 30 days", () => {
  const row = { BranchId: "b1", RootCauseId: "rc1", Status: "closed" as const, ClosedAt: "2026-09-10T12:00:00Z" };
  const groups = rootCausePatterns([row, row, row, { ...row, BranchId: "b2" }, { ...row, ClosedAt: "2026-01-01T00:00:00Z" }, { ...row, ClosedAt: "2027-01-01T00:00:00Z" }], Date.parse("2026-09-15T00:00:00Z"));
  expect(groups).toEqual([{ branchId: "b1", rootCauseId: "rc1", count: 3 }]);
});
