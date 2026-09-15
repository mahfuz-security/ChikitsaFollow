import { AlertTriangle, ListChecks, Plus, Search } from "lucide-react";
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
import { hasPermission } from "../../lib/permissions";
import { useCases, type CaseStatus } from "./useCases";

import { caseStatusTone } from "./casePresentation";
import { ResolutionOverview } from "../trends/ResolutionOverview";
import { CASE_VIEWS, matchesCaseView } from "./caseFilters";

type CasesListPageProps = { onNavigate: (path: string) => void };

export function CasesListPage({ onNavigate }: CasesListPageProps) {
  const { t } = useT();
  const me = useCurrentUser();
  const cases = useCases();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const callerRoles = rolesForUser(me.data?.data);
  const canCreate = hasPermission(me.data?.data, "case-create");
  const isFrontDesk = callerRoles.includes("front_desk");
  const rows = cases.data ?? [];
  const isDone = (status?: CaseStatus) => status === "resolved" || status === "closed" || status === "verified";
  const openCount = rows.filter(row => !isDone(row.Status)).length;
  const visibleRows = rows.filter(row => {
    const matchesStatus = matchesCaseView(row, filter, me.data?.data?.itemId);
    const category = row.Category ? t(tx(`cases.category.${row.Category}`)) : "";
    return matchesStatus && [row.PatientRefCode, row.Subject, category].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  });

  return (
    <section className={isFrontDesk ? "cases-page front-desk-view" : "cases-page"}>
      <PageHeader
        title={t("cases.title")}
        subtitle={t("cases.subtitle")}
        actions={canCreate && !isFrontDesk ? (
          <ActionButton onClick={() => onNavigate("/cases/new")} icon={<Plus size={20} />}>
            {t("cases.newCta")}
          </ActionButton>
        ) : undefined}
      />
      {isFrontDesk && canCreate ? (
        <div className="front-desk-hero">
          <div>
            <h2>{t("cases.frontDeskHome.title")}</h2>
            <p>{t("cases.frontDeskHome.subtitle")}</p>
          </div>
          <ActionButton onClick={() => onNavigate("/cases/new")} icon={<Plus size={22} />}>
            {t("cases.frontDeskHome.cta")}
          </ActionButton>
        </div>
      ) : null}
      {cases.isSuccess ? <ResolutionOverview rows={rows} /> : null}
      <div className="case-toolbar">
        <div className="case-filters" role="group" aria-label={t("cases.filter")}>
          {(["all", "active", "done"] as const).map(value => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {t(tx(`cases.filter.${value}`))}
            </button>
          ))}
        </div>
        <label className="case-view-select"><span>{t("cases.workQueue")}</span><select value={filter} onChange={event => setFilter(event.target.value)}>{CASE_VIEWS.map(value => <option key={value} value={value}>{t(tx(`cases.filter.${value}`))}</option>)}</select></label>
        <label className="search-box">
          <Search size={18} aria-hidden />
          <input type="search" aria-label={t("cases.search")} placeholder={t("cases.searchPlaceholder")} value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>
      {cases.isLoading ? (
        <div className="case-list" aria-label={t("common.loading")} aria-busy="true">
          {[0, 1, 2].map(key => <Skeleton key={key} className="case-skeleton" />)}
        </div>
      ) : cases.isError ? (
        <div className="case-load-error">
          <Alert tone="error">{t(callerRoles.some(role => ["front_desk", "branch_manager"].includes(role)) && !callerRoles.some(role => ["quality_lead", "admin", "clouduser"].includes(role)) && !me.data?.data?.BranchId ? "account.branchMissing" : "cases.loadFailed")}</Alert>
          <ActionButton variant="secondary" onClick={() => cases.refetch()}>{t("common.refresh")}</ActionButton>
        </div>
      ) : visibleRows.length === 0 ? (
        <>
          <EmptyState icon={<ListChecks size={32} />} title={t(rows.length ? "cases.noMatches" : "cases.empty")} description={t(rows.length ? "cases.noMatchesHint" : "cases.emptyHint")} />
          {search || filter !== "all" ? <ActionButton variant="ghost" onClick={() => { setSearch(""); setFilter("all"); }}>{t("cases.clearFilters")}</ActionButton> : null}
        </>
      ) : (
        <>
          <p className="case-count" aria-live="polite">{t("cases.frontDeskHome.openCount", undefined, { count: String(openCount) })}</p>
          <div className="case-list">
            {visibleRows.map((row, index) => (
              <article className="case-card" key={row.itemId ?? index}>
                <div className="case-card-top">
                  <StatusPill tone={caseStatusTone(row.Status)}>{row.Status ? t(tx(`cases.status.${row.Status}`)) : "-"}</StatusPill>
                  <span className="case-reference">{row.PatientRefCode ?? "-"}</span>
                </div>
                <div className="case-card-body">
                  <div>
                    <h2>{row.Category ? t(tx(`cases.category.${row.Category}`)) : "-"}</h2>
                    <p className="case-summary">{row.Subject ?? "-"}</p>
                  </div>
                  {row.Severity ? <span className={`case-severity ${row.Severity === "High" ? "case-severity-high" : ""}`}><AlertTriangle size={16} aria-hidden />{t(tx(`cases.severity.${row.Severity.toLowerCase()}`))}</span> : null}
                </div>
                <div className="case-card-footer">
                  <span>{row.Status ? t(tx(`cases.state.${row.Status}`)) : "-"}</span>
                  <ActionButton variant="ghost" disabled={!row.itemId} onClick={() => onNavigate(`/cases/${row.itemId}`)} aria-label={`${t("cases.open")} ${row.PatientRefCode ?? ""}`}>
                    {t("cases.open")}
                  </ActionButton>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
