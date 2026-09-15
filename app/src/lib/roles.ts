import type { BlocksUser } from "@seliseblocks/client";

// IAM /me exposes slugs; directory responses can group them by organization.
export function rolesForUser(profile: BlocksUser | undefined | null): string[] {
  const raw: unknown = profile?.roles;
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  if (Array.isArray(raw)) return strings(raw);
  if (raw && typeof raw === "object") return [...new Set(Object.values(raw).flatMap(strings))];
  return [];
}

export function homeView(profile: BlocksUser | undefined | null): "cases" | "performance" | "patient" | "unknown" {
  const roles = rolesForUser(profile);
  if (roles.includes("front_desk")) return "cases";
  if (roles.some(role => ["branch_manager", "quality_lead"].includes(role))) return "performance";
  if (roles.some(role => ["admin", "clouduser"].includes(role))) return "cases";
  if (roles.some(role => ["patient", "doctor", "nurse"].includes(role))) return "patient";
  return "unknown";
}
