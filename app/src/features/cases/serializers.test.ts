import { describe, expect, it } from "vitest";
import type { BlocksUser } from "@seliseblocks/client";
import { serializeApprovalForViewer, serializeApprovalListForViewer, toLlmSafeSummary, type ApprovalRow } from "./serializers";

// AC-6: front_desk GET /Approval/{id} response must not contain Amount/Currency.

const FRONT_DESK_PROFILE = {
  itemId: "u-fd-1",
  roles: ["front_desk"],
  permissions: []
} as unknown as BlocksUser;

const MANAGER_PROFILE = {
  itemId: "u-bm-1",
  roles: ["branch_manager"],
  permissions: ["approval-amount-read"]
} as unknown as BlocksUser;

const APPROVAL: ApprovalRow = {
  itemId: "a-1",
  CaseId: "c-1",
  Amount: "500",
  Currency: "BDT",
  AmountType: "waiver",
  Decision: "pending"
};

describe("serializeApprovalForViewer (DC-3, AC-6)", () => {
  it("strips Amount + Currency for front_desk", () => {
    const out = serializeApprovalForViewer(APPROVAL, FRONT_DESK_PROFILE);
    expect(out).toBeDefined();
    expect(out).not.toHaveProperty("Amount");
    expect(out).not.toHaveProperty("Currency");
    expect(out?.CaseId).toBe("c-1");
    expect(out?.Decision).toBe("pending");
  });

  it("preserves Amount + Currency for branch_manager", () => {
    const out = serializeApprovalForViewer(APPROVAL, MANAGER_PROFILE);
    expect(out?.Amount).toBe("500");
    expect(out?.Currency).toBe("BDT");
  });

  it("falls back to role-based gating when permissions are missing (coarse mirror)", () => {
    const profile = { itemId: "x", roles: ["front_desk"] } as unknown as BlocksUser;
    const out = serializeApprovalForViewer(APPROVAL, profile);
    expect(out).not.toHaveProperty("Amount");
  });

  it("serializes a list of approvals", () => {
    const list = [APPROVAL, { ...APPROVAL, itemId: "a-2" }];
    const out = serializeApprovalListForViewer(list, FRONT_DESK_PROFILE);
    expect(out).toHaveLength(2);
    for (const row of out) {
      expect(row).not.toHaveProperty("Amount");
    }
  });
});

describe("toLlmSafeSummary (FR-22)", () => {
  it("returns only the 4 non-PII fields", () => {
    const out = toLlmSafeSummary({
      Category: "wait_time",
      Severity: "High",
      Subject: "Long wait",
      Status: "open"
    });
    expect(out).toEqual({
      Category: "wait_time",
      Severity: "High",
      Subject: "Long wait",
      Status: "open"
    });
    expect(out).not.toHaveProperty("PatientRefCode");
    expect(out).not.toHaveProperty("Email");
    expect(out).not.toHaveProperty("FirstName");
  });

  it("defaults missing fields to empty string", () => {
    expect(toLlmSafeSummary({})).toEqual({ Category: "", Severity: "", Subject: "", Status: "" });
  });
});
