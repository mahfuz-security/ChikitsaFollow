import type { BlocksUser } from "@seliseblocks/client";

// Permission slugs the app checks at runtime. Keep this list in lockstep
// with the 16 perms created in Phase K and the role grants in
// app/blocks/data/rules.json (gateway) — this is the client mirror of
// server-side enforcement. The gateway is the source of truth; the client
// mirror exists only to hide UI affordances the user could not perform
// anyway (DC-3, FR-12, FR-13, FR-15).
export const PERMISSIONS = [
  "case-create",
  "case-read",
  "case-update",
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

// IAM may expose permissions either as a flat string array or as a nested
// structure. We mirror the defensive pattern from useHasRole.ts.
function extractPermissions(profile: BlocksUser | undefined | null): string[] {
  if (!profile) return [];
  const raw = (profile as { permissions?: unknown }).permissions;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)]
    );
  }
  // Fall back to role-based gating if the IAM response doesn't surface
  // permissions yet: assign a coarse mapping so the UI still hides the
  // right affordances. The gateway is the source of truth either way.
  return permissionsForRoles(rolesForProfile(profile));
}

function rolesForProfile(profile: BlocksUser | undefined | null): string[] {
  if (!profile) return [];
  const raw = profile.roles;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)]
    );
  }
  return [];
}

// Coarse permission fallback when the IAM /me response doesn't surface
// permissions directly. Role → permission list mirrors the matrix in the
// approved plan (Phase K.2).
const ROLE_PERMISSIONS: Record<string, PermissionSlug[]> = {
  front_desk: [
    "case-create",
    "case-read",
    "case-event-create",
    "case-event-read",
    "case-ai-draft",
    "case-send-reply",
    "case-close",
    "approval-request"
  ],
  branch_manager: [
    "case-create",
    "case-read",
    "case-update",
    "case-event-create",
    "case-event-read",
    "case-ai-draft",
    "case-send-reply",
    "case-close",
    "approval-request",
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
  return extractPermissions(profile).includes(slug);
}

export function permissionsForProfile(profile: BlocksUser | undefined | null): PermissionSlug[] {
  return extractPermissions(profile) as PermissionSlug[];
}
