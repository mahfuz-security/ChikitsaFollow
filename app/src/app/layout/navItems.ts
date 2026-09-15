import { ClipboardList, FileCheck2, HeartHandshake, LayoutDashboard, LineChart, Send, ShieldCheck, Tags, UserRound } from "lucide-react";
import type { ComponentType } from "react";
import { rolesForUser } from "../../features/profile/useHasRole";

// Nav items are filtered at render time against the caller's roles; the
// role list is passed in by AppShell so the lookup is one query rather
// than a hook-per-item. The labelKey is i18n-resolved at the call site.
export type NavIconProps = { size?: number | string };
export type NavItem = {
  href: string;
  icon: ComponentType<NavIconProps>;
  labelKey: string;
  // Empty array = visible to every authenticated user.
  requiredRoles?: string[];
};

export const navItems: readonly NavItem[] = [
  { href: "/", icon: HeartHandshake, labelKey: "nav.home" },
  { href: "/complaints", icon: ClipboardList, labelKey: "complaint.title", requiredRoles: ["patient"] },
  // Invites are gated: only branch_manager / admin / clouduser see this.
  // doctor/nurse/patient never see it (the manager invites them instead).
  { href: "/invites", icon: Send, labelKey: "nav.invites", requiredRoles: ["branch_manager", "admin", "clouduser"] },
  // Cases: front desk handles; managers review/verify; quality leads read across branches.
  { href: "/cases", icon: ClipboardList, labelKey: "nav.cases", requiredRoles: ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"] },
  // Approvals: front-desk requests, branch_manager decides, quality_lead audits.
  { href: "/approvals", icon: FileCheck2, labelKey: "nav.approvals", requiredRoles: ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"] },
  // Trends: quality_lead owns this view.
  { href: "/trends", icon: LineChart, labelKey: "nav.trends", requiredRoles: ["quality_lead", "admin", "clouduser"] },
  { href: "/reports", icon: LineChart, labelKey: "performance.title", requiredRoles: ["branch_manager", "quality_lead", "admin", "clouduser"] },
  // Audit: admin + quality_lead.
  { href: "/audit", icon: ShieldCheck, labelKey: "nav.audit", requiredRoles: ["admin", "quality_lead", "clouduser"] },
  // Vocabulary admin: admin only.
  { href: "/admin/vocab", icon: Tags, labelKey: "nav.vocab", requiredRoles: ["admin", "clouduser"] },
  { href: "/profile", icon: UserRound, labelKey: "nav.profile" }
] as const;

export function visibleNavItems(roles: string[] | undefined): readonly NavItem[] {
  if (!roles) return [];
  return navItems.filter((item) => {
    if (!item.requiredRoles || item.requiredRoles.length === 0) return true;
    return item.requiredRoles.some((required) => roles.includes(required));
  }).map(item => item.href === "/" && roles.some(role => ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"].includes(role)) ? { ...item, icon: LayoutDashboard, labelKey: "account.dashboard" } : item);
}

// Re-exported so existing imports keep working without churn.
export { rolesForUser };
