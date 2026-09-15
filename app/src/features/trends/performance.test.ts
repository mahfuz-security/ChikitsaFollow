import { expect, it } from "vitest";
import { branchPerformance, complaintBreakdown } from "./performance";
import { matchesCaseView } from "../cases/caseFilters";

const now = Date.parse("2026-09-15T12:00:00Z");
it("shows zero-volume branches and flags a measurable recent spike", () => {
  const rows = Array.from({ length: 5 }, () => ({ BranchId: "dhanmondi", Status: "open" as const, Category: "other", CreatedDate: "2026-09-14T12:00:00Z" }));
  const result = branchPerformance(rows, ["dhanmondi", "other"], now);
  expect(result[0]).toMatchObject({ total: 5, recent: 5, previous: 0, spike: true });
  expect(result[1]).toMatchObject({ total: 0, spike: false, rate: undefined });
  expect(complaintBreakdown(rows, "Category")).toEqual([{ value: "other", count: 5 }]);
});
it("does not count future dates or mistake steady volume for a spike", () => {
  const rows = ["2026-09-14", "2026-09-13", "2026-09-12", "2026-09-05", "2026-09-04", "2026-09-20"].map(date => ({ BranchId: "b", CreatedDate: `${date}T12:00:00Z` }));
  expect(branchPerformance(rows, [], now)[0]).toMatchObject({ recent: 3, previous: 2, spike: false });
});
it("filters own open cases without confusing creation with assignment", () => {
  expect(matchesCaseView({ CreatedBy: "me", Status: "open" }, "mine", "me", now)).toBe(true);
  expect(matchesCaseView({ CreatedBy: "other", Status: "open" }, "mine", "me", now)).toBe(false);
  expect(matchesCaseView({ CreatedBy: "me", Status: "closed" }, "mine", "me", now)).toBe(false);
});
it("excludes completed overdue cases and invalid recent timestamps", () => {
  expect(matchesCaseView({ Status: "open", PromisedAt: "2026-09-01" }, "overdue", undefined, now)).toBe(true);
  expect(matchesCaseView({ Status: "verified", PromisedAt: "2026-09-01" }, "overdue", undefined, now)).toBe(false);
  expect(matchesCaseView({ LastUpdatedDate: "invalid" }, "recent", undefined, now)).toBe(false);
});
