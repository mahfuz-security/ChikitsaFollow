import { describe, expect, it } from "vitest";
import { branchFilterForUser } from "./access";
describe("Branch scope fails closed", () => {
  it("rejects missing profiles, missing branch assignments, and patients", () => {
    expect(() => branchFilterForUser()).toThrow();
    expect(() => branchFilterForUser({ itemId: "staff", roles: ["front_desk"] })).toThrow();
    expect(() => branchFilterForUser({ itemId: "patient", roles: ["patient"] })).toThrow();
  });
  it("scopes front desk and managers; permits cross-branch quality review", () => {
    expect(branchFilterForUser({ itemId: "staff", roles: ["front_desk"], BranchId: "branch-1" })).toEqual({ BranchId: "branch-1" });
    expect(branchFilterForUser({ itemId: "quality", roles: ["quality_lead"] })).toEqual({});
  });
});
