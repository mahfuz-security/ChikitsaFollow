import { gatewayCollection } from "../../lib/blocks/gateway";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

// Shape we care about on the client. Kept narrow on purpose -- we don't
// re-export the IAM type here because Invite rows live in our own schema
// (see Invite.json) and we want our field names to be the contract.
export type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";

export type InviteRow = {
  itemId?: string;
  InviteId?: string;
  Email?: string;
  RoleSlug?: string;
  OrgId?: string;
  InvitedByUserId?: string;
  Status?: InviteStatus;
  CreatedAt?: string;
  ExpiresAt?: string;
  AcceptedAt?: string;
  CancelledAt?: string;
  Note?: string;
};

export type CreateInviteInput = {
  email: string;
  roleSlug: string;
  orgId: string;
  invitedByUserId: string;
  note?: string;
  expiresAt?: string; // ISO; defaults to +14 days if omitted
};

// Generate the stable client-visible id once on the client. The cloud
// might override it -- we keep the local copy around so the row is
// referenceable until refetch lands.
function newInviteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function useInvitesForOrg(orgId: string | undefined) {
  return useQuery({
    enabled: Boolean(orgId),
    queryFn: async () => {
      // Data Gateway supports filter-by-field on list. We restrict to the
      // org we manage so a manager can't accidentally see invites from
      // other branches they're not in. The SDK returns a BlocksPagedResult
      // whose `data` wraps the array under `items`.
      const response = (await gatewayCollection("Invite").list({
        filter: { OrgId: orgId },
        pageNo: 1,
        pageSize: 100
      })) as { data?: { items?: InviteRow[] } } | undefined;
      const items = response?.data?.items ?? [];
      return items as InviteRow[];
    },
    queryKey: ["data", "Invite", "byOrg", orgId]
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInviteInput) => {
      const now = new Date();
      const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_TTL_MS).toISOString();
      const row: Record<string, unknown> = {
        InviteId: newInviteId(),
        Email: input.email,
        RoleSlug: input.roleSlug,
        OrgId: input.orgId,
        InvitedByUserId: input.invitedByUserId,
        Status: "pending" as InviteStatus,
        CreatedAt: now.toISOString(),
        ExpiresAt: expiresAt
      };
      if (input.note) row.Note = input.note;
      const result = await gatewayCollection("Invite").create(row);
      return result as InviteRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Invite", "byOrg", variables.orgId] });
    }
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    // The append-only contract (matches DC-4 spirit): we don't mutate the
    // existing row to set Status=cancelled; we *write a new row* with the
    // same InviteId but updated status. The data layer's last-write-wins
    // resolution treats the latest as truth.
    mutationFn: async (args: { inviteId: string; orgId: string }) => {
      const now = new Date().toISOString();
      const result = await gatewayCollection("Invite").create({
        InviteId: args.inviteId,
        Status: "cancelled" as InviteStatus,
        CancelledAt: now
      });
      return result as InviteRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Invite", "byOrg", variables.orgId] });
    }
  });
}
