import { rolesForUser } from "../../lib/roles";
export { rolesForUser } from "../../lib/roles";
import { useCurrentUser } from "./useCurrentUser";

// Single-source-of-truth helpers for role gating. The Profile page exposes
// `profile.roles` as a flat array of slugs; callers pass the slugs they
// want to match against. We keep the helper open to additional inputs so
// future per-org role checks (see OrganizationMember schema) can stack on
// top without re-architecting nav gating.
export type RoleSlug = "patient" | "doctor" | "nurse" | "branch_manager" | "admin" | "clouduser" | string;

export function useHasRole(...slugs: RoleSlug[]): boolean | undefined {
  const me = useCurrentUser();
  if (!me.data) return undefined;
  return rolesForUser(me.data.data).some((role) => slugs.includes(role));
}

export function useHasAnyRole(...slugs: RoleSlug[]): boolean | undefined {
  return useHasRole(...slugs);
}
