import type { BlocksUser } from "@seliseblocks/client";
import { hasPermission } from "../../lib/permissions";

// DC-3: Approval.Amount and Approval.Currency are sensitive monetary
// values. The gateway already redacts them for front_desk via the column-
// level READ-deny policy "approval-mask-amount-frontdesk" (rules.json).
// The serializer is a belt-and-suspenders client-side defense — even if
// the gateway response is malformed, we never leak the amount into a
// front-desk view. branch_manager and admin keep visibility through
// approval-amount-read; quality_lead loses visibility client-side as
// well to keep the data surface narrow.
export type ApprovalRow = {
  itemId?: string;
  CaseId?: string;
  Amount?: string; // Numeric value stored as string in cloud schema
  Currency?: string;
  AmountType?: string;
  RequestedBy?: string;
  DecidedBy?: string;
  Decision?: "pending" | "approved" | "rejected";
  Tier?: string;
  Note?: string;
};

export function serializeApprovalForViewer(
  approval: ApprovalRow | undefined,
  viewer: BlocksUser | undefined | null
): ApprovalRow | undefined {
  if (!approval) return approval;
  if (hasPermission(viewer, "approval-amount-read")) return approval;
  // Strip amount + currency. Do not throw — caller may iterate.
  const { Amount: _a, Currency: _c, ...rest } = approval;
  void _a;
  void _c;
  return rest as ApprovalRow;
}

export function serializeApprovalListForViewer(
  approvals: ApprovalRow[] | undefined,
  viewer: BlocksUser | undefined | null
): ApprovalRow[] {
  if (!approvals) return [];
  return approvals.map((row) => serializeApprovalForViewer(row, viewer) ?? row);
}

// FR-22 defense: never include PatientRefCode or PII in a payload that
// could be sent to an external LLM. The AI draft stub already keeps the
// payload to non-PII fields; this helper centralizes the allowlist.
export type LlmSafeCaseSummary = {
  Category: string;
  Severity: string;
  Subject: string;
  Status: string;
};

export function toLlmSafeSummary(c: {
  Category?: string;
  Severity?: string;
  Subject?: string;
  Status?: string;
}): LlmSafeCaseSummary {
  return {
    Category: c.Category ?? "",
    Severity: c.Severity ?? "",
    Subject: c.Subject ?? "",
    Status: c.Status ?? ""
  };
}
