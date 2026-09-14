import { ShieldCheck } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useAuditLog } from "./useAuditLog";

export function AuditPage() {
  const { t } = useT();
  const rows = useAuditLog();
  return (
    <section>
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      {rows.isLoading ? (
        <Skeleton className="skeleton-line" />
      ) : !rows.data || rows.data.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={28} />} title={t("audit.empty")} description={t("audit.emptyHint")} />
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("audit.colAction")}</th>
                <th>{t("audit.colResource")}</th>
                <th>{t("audit.colResourceId")}</th>
                <th>{t("audit.colActor")}</th>
                <th>{t("audit.colBranch")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.data.map((row) => (
                <tr key={row.itemId}>
                  <td>{row.Action ?? "—"}</td>
                  <td>{row.ResourceType ?? "—"}</td>
                  <td className="mono">{row.ResourceId ?? "—"}</td>
                  <td className="mono">{row.ActorUserId ?? "—"}</td>
                  <td className="mono">{row.BranchId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
