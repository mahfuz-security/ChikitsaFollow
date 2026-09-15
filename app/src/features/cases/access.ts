import type { BlocksUser } from "@seliseblocks/client";
import { rolesForUser } from "../profile/useHasRole";

export function branchFilterForUser(profile?: BlocksUser | null): { BranchId?: string } {
  if (!profile?.itemId) throw new Error("Sign in to access cases.");
  const roles = rolesForUser(profile);
  if (roles.some(role => ["quality_lead", "admin", "clouduser"].includes(role))) return {};
  if (!roles.some(role => ["front_desk", "branch_manager"].includes(role))) throw new Error("You do not have access to staff cases.");
  const branchId = (profile as { BranchId?: string }).BranchId;
  if (!branchId) throw new Error("No branch is assigned to your account. Contact your clinic administrator.");
  return { BranchId: branchId };
}
