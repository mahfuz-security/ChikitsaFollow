import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { serializeApprovalListForViewer, type ApprovalRow } from "../cases/serializers";

// Re-export for the page that needs the type.
export type { ApprovalRow };

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

export function useApprovalsForBranch(branchId: string | undefined) {
  return useQuery({
    enabled: Boolean(branchId),
    queryFn: async () => {
      // The cloud schema does not index approvals by branch directly; we
      // resolve via Case.BranchId by joining on CaseId at fetch time.
      // For now, return all approvals and let the page filter to its
      // branch when branch-scoping is wired up (FR-12). For front_desk
      // we filter to approvals they requested.
      const response = (await blocksClient.data.collection("Approval").list({
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      return (response?.data?.items ?? []) as ApprovalRow[];
    },
    queryKey: ["data", "Approval", "byBranch", branchId]
  });
}

export function useApprovalsForViewer(viewer: BlocksUser | undefined | null) {
  return useQuery({
    queryFn: async () => {
      const filter: Record<string, string> = {};
      // Front-desk only sees their own requests; manager sees pending +
      // decided for their branch; quality_lead sees all (audit role).
      const roles = ((viewer?.roles ?? []) as string[]);
      if (roles.includes("front_desk")) {
        const myId = viewer?.itemId;
        if (myId) filter.RequestedBy = myId;
      }
      const response = (await blocksClient.data.collection("Approval").list({
        filter,
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      const rows = (response?.data?.items ?? []) as ApprovalRow[];
      // DC-3: serialize-strip Amount/Currency when caller lacks
      // approval-amount-read. Gateway already redacts, this is the
      // client mirror.
      return serializeApprovalListForViewer(rows, viewer);
    },
    queryKey: ["data", "Approval", "forViewer", viewer?.itemId ?? "anonymous"]
  });
}

export type RequestApprovalInput = {
  caseId: string;
  amount: number;
  currency?: string;
  amountType: "waiver" | "refund" | "voucher";
  requestedBy: string;
  note?: string;
};

export function useRequestApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequestApprovalInput) => {
      // Cloud FieldType has no numeric type (see schema Approval.json
      // description), so Amount is stored as a string. Convert at the
      // boundary; consumer code parses with Number() too.
      const row: Record<string, unknown> = {
        CaseId: input.caseId,
        Amount: String(input.amount),
        Currency: input.currency ?? "BDT",
        AmountType: input.amountType,
        RequestedBy: input.requestedBy,
        Decision: "pending"
      };
      if (input.note) row.Note = input.note;
      const created = await blocksClient.data.collection("Approval").create(row);
      return created as ApprovalRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Approval"] });
      void variables.caseId;
    }
  });
}

export type DecideApprovalInput = {
  approvalId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  note?: string;
};

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecideApprovalInput) => {
      const patch: Record<string, unknown> = {
        Decision: input.decision,
        DecidedBy: input.decidedBy
      };
      if (input.note) patch.Note = input.note;
      const updated = await blocksClient.data.collection("Approval").update(input.approvalId, patch);
      return updated as ApprovalRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "Approval"] });
    }
  });
}
