import { gatewayCollection } from "../../lib/blocks/gateway";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { serializeApprovalListForViewer, type ApprovalRow } from "../cases/serializers";
import { hasPermission } from "../../lib/permissions";
import { branchFilterForUser } from "../cases/access";
import { scanForClinical } from "../ai/firewall";

// Re-export for the page that needs the type.
export type { ApprovalRow };

export function useApprovalsForViewer(viewer: BlocksUser | undefined | null) {
  return useQuery({
    enabled: Boolean(viewer?.itemId),
    queryFn: async () => {
      const filter: Record<string, string> = {};
      // Front-desk only sees their own requests; manager sees pending +
      // decided for their branch; quality_lead sees all (audit role).
      const roles = ((viewer?.roles ?? []) as string[]);
      if (roles.includes("front_desk")) {
        const myId = viewer?.itemId;
        if (myId) filter.RequestedBy = myId;
      }
      const scope = branchFilterForUser(viewer);
      const fields = hasPermission(viewer, "approval-amount-read") ? ["Amount", "Currency"] : [];
      let rows: ApprovalRow[] = [];
      if (scope.BranchId) {
        const cases = await gatewayCollection("Case").list({ filter: scope, pageNo: 1, pageSize: 100 });
        for (const row of cases.data.items) {
          const response = await gatewayCollection("Approval", fields).list({ filter: { ...filter, CaseId: row.itemId }, pageNo: 1, pageSize: 100 });
          rows.push(...response.data.items as ApprovalRow[]);
        }
      } else {
        const response = await gatewayCollection("Approval", fields).list({ filter, pageNo: 1, pageSize: 100 });
        rows = response.data.items as ApprovalRow[];
      }
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
      if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter a positive amount.");
      const scan = scanForClinical(input.note);
      if (!scan.ok) throw new Error(scan.message);
      const profile = (await blocksClient.iam.me()).data;
      if (!hasPermission(profile, "approval-request")) throw new Error("Approval request is not permitted.");
      const scope = branchFilterForUser(profile);
      const cases = await gatewayCollection("Case").list({ filter: { ...scope, ItemId: input.caseId }, pageNo: 1, pageSize: 1 });
      if (!cases.data.items.length) throw new Error("This case is unavailable.");
      // Cloud FieldType has no numeric type (see schema Approval.json
      // description), so Amount is stored as a string. Convert at the
      // boundary; consumer code parses with Number() too.
      const row: Record<string, unknown> = {
        CaseId: input.caseId,
        Amount: String(input.amount),
        Currency: input.currency ?? "BDT",
        AmountType: input.amountType,
        RequestedBy: profile?.itemId,
        Decision: "pending"
      };
      if (input.note) row.Note = input.note;
      const created = await gatewayCollection("Approval").create(row);
      await gatewayCollection("CaseEvent").create({ CaseId: input.caseId, EventType: "approval_requested", ActorUserId: profile?.itemId, AiGenerated: false,
        MetadataJson: JSON.stringify({ approvalId: created.itemId, type: input.amountType }) });
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
      const profile = (await blocksClient.iam.me()).data;
      if (!hasPermission(profile, "approval-decide")) throw new Error("Manager approval is required.");
      const scope = branchFilterForUser(profile);
      const approval = await gatewayCollection("Approval").get(input.approvalId);
      if (!approval || approval.Decision !== "pending") throw new Error("This approval is unavailable or already decided.");
      const cases = await gatewayCollection("Case").list({ filter: { ...scope, ItemId: approval.CaseId }, pageNo: 1, pageSize: 1 });
      if (!cases.data.items.length) throw new Error("This case is unavailable.");
      const scan = scanForClinical(input.note);
      if (!scan.ok) throw new Error(scan.message);
      const patch: Record<string, unknown> = {
        Decision: input.decision,
        DecidedBy: profile?.itemId
      };
      const updated = await gatewayCollection("Approval").update(input.approvalId, patch);
      await gatewayCollection("CaseEvent").create({ CaseId: approval.CaseId, EventType: "approval_decided", ActorUserId: profile?.itemId, Text: input.note, AiGenerated: false,
        MetadataJson: JSON.stringify({ approvalId: input.approvalId, decision: input.decision }) });
      return updated as ApprovalRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "Approval"] });
    }
  });
}
