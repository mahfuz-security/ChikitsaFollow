import { useState } from "react";
import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useCurrentUser } from "../profile/useCurrentUser";
import { rolesForUser } from "../profile/useHasRole";
import { useApprovalsForViewer, useDecideApproval, useRequestApproval } from "./useApprovals";

function decisionTone(decision: string | undefined): "good" | "warn" | "neutral" {
  if (decision === "approved") return "good";
  if (decision === "pending") return "warn";
  return "neutral";
}

export function ApprovalsPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const approvals = useApprovalsForViewer(me.data?.data);
  const decide = useDecideApproval();
  const request = useRequestApproval();

  const callerRoles = rolesForUser(me.data?.data);
  const canRequest = callerRoles.includes("front_desk") || callerRoles.includes("branch_manager");
  const canDecide = callerRoles.includes("branch_manager") || callerRoles.includes("admin") || callerRoles.includes("clouduser");

  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState<"waiver" | "refund" | "voucher">("waiver");
  const [caseId, setCaseId] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError(t("approvals.invalidAmount"));
      return;
    }
    if (!caseId.trim()) {
      setError(t("approvals.caseIdRequired"));
      return;
    }
    try {
      await request.mutateAsync({
        caseId: caseId.trim(),
        amount: numeric,
        amountType,
        requestedBy: me.data?.data?.itemId ?? "unknown"
      });
      setAmount("");
      setCaseId("");
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("approvals.requestFailed"));
    }
  }

  async function handleDecide(approvalId: string, decision: "approved" | "rejected") {
    try {
      await decide.mutateAsync({
        approvalId,
        decision,
        decidedBy: me.data?.data?.itemId ?? "unknown"
      });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("approvals.decideFailed"));
    }
  }

  return (
    <section>
      <PageHeader title={t("approvals.title")} subtitle={t("approvals.subtitle")} />

      {canRequest ? (
        <form className="panel" onSubmit={handleRequest}>
          <div className="panel-title">{t("approvals.requestTitle")}</div>
          <div className="form-row">
            <label className="form-field">
              <span>{t("approvals.caseId")}</span>
              <input value={caseId} onChange={(event) => setCaseId(event.target.value)} required />
            </label>
            <label className="form-field">
              <span>{t("approvals.amount")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>{t("approvals.amountType")}</span>
              <select value={amountType} onChange={(event) => setAmountType(event.target.value as "waiver" | "refund" | "voucher")}>
                <option value="waiver">{t("approvals.type.waiver")}</option>
                <option value="refund">{t("approvals.type.refund")}</option>
                <option value="voucher">{t("approvals.type.voucher")}</option>
              </select>
            </label>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <ActionButton type="submit" disabled={request.isPending}>
            {request.isPending ? t("common.saving") : t("approvals.submit")}
          </ActionButton>
        </form>
      ) : null}

      <div className="panel">
        <div className="panel-title">{t("approvals.listTitle")}</div>
        {approvals.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : !approvals.data || approvals.data.length === 0 ? (
          <EmptyState title={t("approvals.empty")} description={t("approvals.emptyHint")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("approvals.colCase")}</th>
                <th>{t("approvals.colAmount")}</th>
                <th>{t("approvals.colType")}</th>
                <th>{t("approvals.colStatus")}</th>
                <th>{t("approvals.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {approvals.data.map((row) => (
                <tr key={row.itemId}>
                  <td className="mono">{row.CaseId ?? "—"}</td>
                  <td>{row.Amount ? `${row.Amount} ${row.Currency ?? ""}`.trim() : t("approvals.amountMasked")}</td>
                  <td>{row.AmountType ? t(tx(`approvals.type.${row.AmountType}`)) : "—"}</td>
                  <td><StatusPill tone={decisionTone(row.Decision)}>{row.Decision ?? "—"}</StatusPill></td>
                  <td>
                    {canDecide && row.Decision === "pending" ? (
                      <div className="row-actions">
                        <ActionButton onClick={() => handleDecide(row.itemId ?? "", "approved")} disabled={decide.isPending}>
                          {t("approvals.approve")}
                        </ActionButton>
                        <ActionButton onClick={() => handleDecide(row.itemId ?? "", "rejected")} disabled={decide.isPending}>
                          {t("approvals.reject")}
                        </ActionButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
