import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

export type OrgMemberRole = "patient" | "doctor" | "nurse" | "branch_manager" | "admin" | "clouduser" | string;

export type OrganizationMemberRow = {
  itemId?: string;
  UserId?: string;
  OrgId?: string;
  RoleSlug?: string;
  Status?: "active" | "inactive";
  JoinedAt?: string;
  LeftAt?: string;
  InvitedByUserId?: string;
  Source?: "signup" | "manager_invite" | "admin_invite" | "clouduser_invite";
};

// Single-org role slugs: nurse and branch_manager must NOT have active
// rows in more than one org. patient/doctor/admin/clouduser may.
const SINGLE_ORG_ROLES: ReadonlySet<OrgMemberRole> = new Set(["nurse", "branch_manager"]);

export function isSingleOrgRole(roleSlug: string | undefined): boolean {
  if (!roleSlug) return false;
  return SINGLE_ORG_ROLES.has(roleSlug);
}

export function useOrganizationMembersForOrg(orgId: string | undefined) {
  return useQuery({
    enabled: Boolean(orgId),
    queryFn: async () => {
      const response = (await blocksClient.data.collection("OrganizationMember").list({
        filter: { OrgId: orgId },
        pageNo: 1,
        pageSize: 200
      })) as { data?: { items?: OrganizationMemberRow[] } } | undefined;
      return (response?.data?.items ?? []) as OrganizationMemberRow[];
    },
    queryKey: ["data", "OrganizationMember", "byOrg", orgId]
  });
}

export function useOrganizationMembersForUser(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = (await blocksClient.data.collection("OrganizationMember").list({
        filter: { UserId: userId },
        pageNo: 1,
        pageSize: 50
      })) as { data?: { items?: OrganizationMemberRow[] } } | undefined;
      return (response?.data?.items ?? []) as OrganizationMemberRow[];
    },
    queryKey: ["data", "OrganizationMember", "byUser", userId]
  });
}

export type AddMembershipInput = {
  userId: string;
  orgId: string;
  roleSlug: string;
  source: OrganizationMemberRow["Source"];
  invitedByUserId?: string;
};

// Enforce single-org constraint at write time. Server-side checks (rules
// + custom functions) will be added in a later phase; this client-side
// guard gives us a fast UX failure before the round-trip.
export class SingleOrgViolationError extends Error {
  constructor(public readonly conflictingOrgId: string, public readonly roleSlug: string) {
    super(`Role '${roleSlug}' is single-org and the user already belongs to ${conflictingOrgId}.`);
    this.name = "SingleOrgViolationError";
  }
}

export function useAddOrganizationMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddMembershipInput) => {
      if (isSingleOrgRole(input.roleSlug)) {
        const existing = (await blocksClient.data.collection("OrganizationMember").list({
          filter: { Status: "active", UserId: input.userId },
          pageNo: 1,
          pageSize: 50
        })) as { data?: { items?: OrganizationMemberRow[] } } | undefined;
        const active = (existing?.data?.items ?? []) as OrganizationMemberRow[];
        const conflict = active.find((row) => row.OrgId && row.OrgId !== input.orgId);
        if (conflict?.OrgId) {
          throw new SingleOrgViolationError(conflict.OrgId, input.roleSlug);
        }
      }

      const row: Record<string, unknown> = {
        UserId: input.userId,
        OrgId: input.orgId,
        RoleSlug: input.roleSlug,
        Status: "active",
        JoinedAt: new Date().toISOString(),
        Source: input.source
      };
      if (input.invitedByUserId) row.InvitedByUserId = input.invitedByUserId;
      const result = await blocksClient.data.collection("OrganizationMember").create(row);
      return result as OrganizationMemberRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "OrganizationMember", "byOrg", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["data", "OrganizationMember", "byUser", variables.userId] });
    }
  });
}
