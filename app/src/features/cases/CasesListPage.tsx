import { ListChecks, Plus } from "lucide-react";
import { useRef } from "react";
import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useCurrentUser } from "../profile/useCurrentUser";
import { rolesForUser } from "../profile/useHasRole";
import { useCases, type CaseStatus } from "./useCases";

function statusTone(status: CaseStatus | undefined): "good" | "warn" | "neutral" {
  if (status === "open") return "warn";
  if (status === "in_progress") return "warn";
  if (status === "awaiting_approval") return "warn";
  if (status === "resolved" || status === "closed") return "good";
  return "neutral";
}

type CasesListPageProps = { onNavigate: (path: string) => void };

export function CasesListPage({ onNavigate }: CasesListPageProps) {
  const { t } = useT();
  const me = useCurrentUser();
  const cases = useCases();
  const callerRoles = rolesForUser(me.data?.data);
  const canCreate = callerRoles.includes("front_desk") || callerRoles.includes("branch_manager") || callerRoles.includes("clouduser");
  const isFrontDesk = callerRoles.includes("front_desk");
  const tableAnchor = useRef<HTMLDivElement | null>(null);

  const openCount = (cases.data ?? []).filter((row) => row.Status === "open" || row.Status === "in_progress").length;

  function scrollToTable() {
    tableAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section>
      <PageHeader
        title={t("cases.title")}
        subtitle={t("cases.subtitle")}
        actions={
          canCreate && !isFrontDesk ? (
            <ActionButton onClick={() => onNavigate("/cases/new")}>
              <Plus size={18} />
              {t("cases.newCta")}
            </ActionButton>
          ) : undefined
        }
      />

      {isFrontDesk && canCreate ? (
        <div className="panel front-desk-hero">
          <div>
            <h3>{t("cases.frontDeskHome.title")}</h3>
            <p className="muted">{t("cases.frontDeskHome.subtitle")}</p>
            {openCount > 0 ? (
              <p className="muted">{t("cases.frontDeskHome.openCount", undefined, { count: String(openCount) })}</p>
            ) : null}
          </div>
          <div className="row-actions">
            <ActionButton onClick={() => onNavigate("/cases/new")}>
              <Plus size={18} />
              {t("cases.frontDeskHome.cta")}
            </ActionButton>
          </div>
        </div>
      ) : null}

      {cases.isLoading ? (
        <Skeleton className="skeleton-line" />
      ) : !cases.data || cases.data.length === 0 ? (
        <EmptyState icon={<ListChecks size={28} />} title={t("cases.empty")} description={t("cases.emptyHint")} />
      ) : (
        <div className="panel" ref={tableAnchor}>
          {isFrontDesk ? (
            <button type="button" className="link-button" onClick={scrollToTable}>
              {t("cases.frontDeskHome.seeAll")}
            </button>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("cases.colCode")}</th>
                <th>{t("cases.colCategory")}</th>
                <th>{t("cases.colSeverity")}</th>
                <th>{t("cases.colSubject")}</th>
                <th>{t("cases.colStatus")}</th>
                <th>{t("cases.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.data.map((row) => (
                <tr key={row.itemId}>
                  <td className="mono">{row.PatientRefCode ?? "—"}</td>
                  <td>{row.Category ? t(tx(`cases.category.${row.Category}`)) : "—"}</td>
                  <td>{row.Severity ?? "—"}</td>
                  <td className="truncate" title={row.Subject ?? ""}>{row.Subject ?? "—"}</td>
                  <td><StatusPill tone={statusTone(row.Status)}>{row.Status ?? "—"}</StatusPill></td>
                  <td>
                    <ActionButton onClick={() => onNavigate(`/cases/${row.itemId ?? ""}`)}>
                      {t("cases.open")}
                    </ActionButton>
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
