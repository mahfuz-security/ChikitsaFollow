import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useDismissTrend, useMarkTrendActioned, useTrendFlags } from "./useTrends";
import { QualityPatterns } from "./QualityPatterns";

function statusTone(status: string | undefined): "good" | "warn" | "neutral" {
  if (status === "actioned") return "good";
  if (status === "new") return "warn";
  return "neutral";
}

export function TrendsPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const flags = useTrendFlags();
  const actioned = useMarkTrendActioned();
  const dismissed = useDismissTrend();
  const [error, setError] = useState<string | undefined>();

  async function handleAction(itemId: string) {
    if (!me.data?.data?.itemId) return;
    setError(undefined);
    try {
      await actioned.mutateAsync({ itemId, qualityLeadUserId: me.data.data.itemId });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("trends.actionFailed"));
    }
  }

  async function handleDismiss(itemId: string) {
    if (!me.data?.data?.itemId) return;
    setError(undefined);
    try {
      await dismissed.mutateAsync({ itemId, qualityLeadUserId: me.data.data.itemId });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("trends.dismissFailed"));
    }
  }

  return (
    <section>
      <PageHeader title={t("trends.title")} subtitle={t("trends.subtitle")} />
      <QualityPatterns />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {flags.isError ? <Alert tone="error">{t("common.error")}</Alert> : flags.isLoading ? (
        <Skeleton className="skeleton-line" />
      ) : !flags.data || flags.data.length === 0 ? (
        <EmptyState icon={<TrendingUp size={28} />} title={t("trends.empty")} description={t("trends.emptyHint")} />
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("trends.colBranch")}</th>
                <th>{t("trends.colWindow")}</th>
                <th>{t("trends.colCount")}</th>
                <th>{t("trends.colStatus")}</th>
                <th>{t("trends.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {flags.data.map((row) => (
                <tr key={row.itemId}>
                  <td className="mono">{row.BranchId ?? "—"}{row.DraftedFix ? <p>{row.DraftedFix}</p> : null}</td>
                  <td className="mono">{row.WindowStart ?? "—"} → {row.WindowEnd ?? "—"}</td>
                  <td>{row.CaseCount ?? "0"}</td>
                  <td><StatusPill tone={statusTone(row.Status)}>{row.Status ?? "—"}</StatusPill></td>
                  <td>
                    {row.Status === "new" ? (
                      <div className="row-actions">
                        <ActionButton onClick={() => handleAction(row.itemId ?? "")} disabled={actioned.isPending}>
                          {t("trends.action")}
                        </ActionButton>
                        <ActionButton onClick={() => handleDismiss(row.itemId ?? "")} disabled={dismissed.isPending}>
                          {t("trends.dismiss")}
                        </ActionButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
