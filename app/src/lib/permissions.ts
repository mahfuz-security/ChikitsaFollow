import type { BlocksUser } from "@seliseblocks/client";
import { rolesForUser as rolesForProfile } from "./roles";

// Application gates do not replace independently enforced gateway policies.
export const PERMISSIONS = [
  "case-create",
  "case-read",
  "case-update",
  "case-verify",
  "case-close",
  "case-event-create",
  "case-event-read",
  "case-ai-draft",
  "case-send-reply",
  "approval-request",
  "approval-decide",
  "approval-amount-read",
  "trend-read",
  "trend-action",
  "audit-read",
  "vocab-manage",
  "branch-manage"
] as const;

export type PermissionSlug = (typeof PERMISSIONS)[number];
const RESOURCE_PERMISSIONS: Record<string, PermissionSlug> = {
  "blocks-data::case::create": "case-create", "blocks-data::case::read": "case-read",
  "blocks-data::case::update": "case-update", "blocks-data::case::close": "case-close",
  "blocks-data::case::ai-draft": "case-ai-draft", "blocks-data::case::send-reply": "case-send-reply",
  "blocks-data::caseevent::create": "case-event-create", "blocks-data::caseevent::read": "case-event-read",
  "blocks-data::approval::request": "approval-request", "blocks-data::approval::decide": "approval-decide",
  "blocks-data::approval::amount": "approval-amount-read",
  "blocks-data::trendflag::read": "trend-read", "blocks-data::trendflag::action": "trend-action",
  "blocks-data::auditlog::read": "audit-read"
};
function normalizePermissions(values: unknown[]): string[] {
  return values.map(value => RESOURCE_PERMISSIONS[String(value)] ?? String(value));
}

// IAM may expose permissions either as a flat string array or as a nested
// structure. We mirror the defensive pattern from useHasRole.ts.
function extractPermissions(profile: BlocksUser | undefined | null): string[] {
  if (!profile) return [];
  const raw = (profile as { permissions?: unknown }).permissions;
  // IAM's empty array means no direct grants, not removal of role grants.
  if (Array.isArray(raw)) return [...new Set([...permissionsForRoles(rolesForProfile(profile)), ...normalizePermissions(raw)])];
  if (raw && typeof raw === "object") {
    return [...new Set([...permissionsForRoles(rolesForProfile(profile)), ...normalizePermissions(Object.values(raw as Record<string, unknown>).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)]
    ))])];
  }
  // Fall back to role-based gating if the IAM response doesn't surface
  // permissions yet: assign a coarse mapping so the UI still hides the
  // right affordances. The gateway is the source of truth either way.
  return permissionsForRoles(rolesForProfile(profile));
}

// Coarse permission fallback when the IAM /me response doesn't surface
// permissions directly. Role → permission list mirrors the matrix in the
// approved plan (Phase K.2).
const ROLE_PERMISSIONS: Record<string, PermissionSlug[]> = {
  front_desk: [
    "case-create",
    "case-read",
    "case-update",
    "case-event-create",
    "case-event-read",
    "case-ai-draft",
    "case-send-reply",
    "case-close",
    "approval-request"
  ],
  branch_manager: [
    "case-read",
    "case-verify",
    "case-event-create",
    "case-event-read",
    "approval-decide",
    "approval-amount-read"
  ],
  quality_lead: [
    "case-read",
    "case-event-read",
    "case-event-create",
    "trend-read",
    "trend-action",
    "audit-read"
  ],
  admin: [
    "vocab-manage",
    "branch-manage",
    "audit-read",
    "approval-decide",
    "approval-amount-read"
  ]
};

function permissionsForRoles(roles: string[]): PermissionSlug[] {
  const set = new Set<PermissionSlug>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) set.add(perm);
  }
  return Array.from(set) as PermissionSlug[];
}

export function hasPermission(profile: BlocksUser | undefined | null, slug: PermissionSlug): boolean {
  if (slug === "approval-amount-read" && !rolesForProfile(profile).some(role => ["branch_manager", "admin", "clouduser"].includes(role))) return false;
  // Verification is a separate application action using the existing Case update endpoint.
  if (slug === "case-verify") {
    if (!rolesForProfile(profile).some(role => ["branch_manager", "admin", "clouduser"].includes(role))) return false;
    return extractPermissions(profile).some(permission => ["case-verify", "case-update"].includes(permission));
  }
  if (isReviewOnlyManager(profile) && (slug === "approval-request" || (slug.startsWith("case-") && !["case-read", "case-event-read", "case-event-create"].includes(slug)))) return false;
  return extractPermissions(profile).includes(slug);
}

export function isReviewOnlyManager(profile: BlocksUser | undefined | null): boolean {
  const roles = rolesForProfile(profile);
  return roles.includes("branch_manager") && !roles.some(role => ["admin", "clouduser"].includes(role));
}

export function permissionsForProfile(profile: BlocksUser | undefined | null): PermissionSlug[] {
  return PERMISSIONS.filter(slug => hasPermission(profile, slug));
}
