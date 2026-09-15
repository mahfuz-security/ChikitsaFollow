import { describe, expect, it } from "vitest";
import type { BlocksUser } from "@seliseblocks/client";
import { hasPermission, PERMISSIONS } from "./permissions";

const profileWithRoles = (roles: string[]) => ({ itemId: "u", roles } as unknown as BlocksUser);

it("preserves role grants when IAM returns no directly assigned permissions", () => {
  expect(hasPermission({ roles: ["front_desk"], permissions: [] }, "case-create")).toBe(true);
  expect(hasPermission({ roles: ["front_desk"], permissions: [] }, "case-send-reply")).toBe(true);
  expect(hasPermission({ roles: ["branch_manager"], permissions: [] }, "case-verify")).toBe(true);
  expect(hasPermission({ roles: ["branch_manager"], permissions: [] }, "case-create")).toBe(false);
  expect(hasPermission({ roles: ["quality_lead"], permissions: [] }, "trend-action")).toBe(true);
  expect(hasPermission({ roles: ["patient"], permissions: [] }, "case-read")).toBe(false);
});

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
  it("branch_manager retains approval review but cannot update cases", () => {
    const p = profileWithRoles(["branch_manager"]);
    expect(hasPermission(p, "approval-decide")).toBe(true);
    expect(hasPermission(p, "approval-amount-read")).toBe(true);
    expect(hasPermission(p, "case-update")).toBe(false);
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
  it("does not expose management amounts to staff through an overbroad grant", () => {
    const p = { itemId: "u", roles: ["front_desk"], permissions: ["approval-amount-read"] } as unknown as BlocksUser;
    expect(hasPermission(p, "approval-amount-read")).toBe(false);
  });
  it("returns false for null/undefined profile", () => {
    expect(hasPermission(null, "case-create")).toBe(false);
    expect(hasPermission(undefined, "case-create")).toBe(false);
  });
});

it("allows manager verification but not creation or general editing with broad IAM grants", () => {
  const profile = { roles: ["branch_manager"], permissions: [...PERMISSIONS] };
  for (const permission of ["case-create", "case-update", "case-close", "case-ai-draft", "case-send-reply"] as const) expect(hasPermission(profile, permission)).toBe(false);
  expect(hasPermission(profile, "case-read")).toBe(true);
  expect(hasPermission(profile, "case-event-create")).toBe(true);
  expect(hasPermission(profile, "case-verify")).toBe(true);
  expect(hasPermission(profile, "approval-request")).toBe(false);
});
it("retains front-desk creation and separate administrator permissions", () => {
  expect(hasPermission({ roles: ["front_desk"] }, "case-create")).toBe(true);
  expect(hasPermission({ roles: ["front_desk"] }, "case-update")).toBe(true);
  expect(hasPermission({ roles: ["front_desk"] }, "case-verify")).toBe(false);
  expect(hasPermission({ roles: ["branch_manager", "admin"], permissions: ["case-create"] }, "case-create")).toBe(true);
});
it("supports the resource strings returned by Blocks IAM", () => {
  const profile = { roles: ["branch_manager"], permissions: ["blocks-data::case::update", "blocks-data::caseevent::create"] };
  expect(hasPermission(profile, "case-verify")).toBe(true);
  expect(hasPermission(profile, "case-event-create")).toBe(true);
  expect(hasPermission(profile, "case-update")).toBe(false);
});
