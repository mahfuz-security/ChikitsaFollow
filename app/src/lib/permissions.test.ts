import { describe, expect, it } from "vitest";
import type { BlocksUser } from "@seliseblocks/client";
import { hasPermission } from "./permissions";

// Verifies the client-side permission mirror stays in lockstep with the
// approved role→permission matrix (Phase K.2).

const profileWithRoles = (roles: string[]) => ({ itemId: "u", roles } as unknown as BlocksUser);

describe("hasPermission (coarse role-fallback mirror)", () => {
  it("front_desk can request approvals but cannot read amounts", () => {
    const p = profileWithRoles(["front_desk"]);
    expect(hasPermission(p, "approval-request")).toBe(true);
    expect(hasPermission(p, "approval-amount-read")).toBe(false);
    expect(hasPermission(p, "case-create")).toBe(true);
    expect(hasPermission(p, "case-close")).toBe(true);
    expect(hasPermission(p, "trend-action")).toBe(false);
    expect(hasPermission(p, "vocab-manage")).toBe(false);
  });

  it("branch_manager can decide approvals + read amounts", () => {
    const p = profileWithRoles(["branch_manager"]);
    expect(hasPermission(p, "approval-decide")).toBe(true);
    expect(hasPermission(p, "approval-amount-read")).toBe(true);
    expect(hasPermission(p, "case-update")).toBe(true);
    expect(hasPermission(p, "vocab-manage")).toBe(false);
  });

  it("quality_lead can read + tag trends but cannot close cases", () => {
    const p = profileWithRoles(["quality_lead"]);
    expect(hasPermission(p, "case-read")).toBe(true);
    expect(hasPermission(p, "trend-action")).toBe(true);
    expect(hasPermission(p, "audit-read")).toBe(true);
    expect(hasPermission(p, "case-close")).toBe(false);
    expect(hasPermission(p, "approval-decide")).toBe(false);
  });

  it("admin can manage vocab + branches", () => {
    const p = profileWithRoles(["admin"]);
    expect(hasPermission(p, "vocab-manage")).toBe(true);
    expect(hasPermission(p, "branch-manage")).toBe(true);
    expect(hasPermission(p, "approval-amount-read")).toBe(true);
    expect(hasPermission(p, "case-close")).toBe(false);
  });

  it("respects explicit permissions array when present (gateway truth)", () => {
    const p = { itemId: "u", roles: ["front_desk"], permissions: ["approval-amount-read"] } as unknown as BlocksUser;
    expect(hasPermission(p, "approval-amount-read")).toBe(true);
  });

  it("returns false for null/undefined profile", () => {
    expect(hasPermission(null, "case-create")).toBe(false);
    expect(hasPermission(undefined, "case-create")).toBe(false);
  });
});
