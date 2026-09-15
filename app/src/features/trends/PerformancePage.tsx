import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Alert } from "../../shared/ui/Alert";
import { useCases } from "../cases/useCases";
import { useCaseBranches } from "../organizations/useCaseBranches";
import { useActiveRootCauses } from "../vocab/useRootCauses";
import { ResolutionOverview } from "./ResolutionOverview";
import { branchPerformance, complaintBreakdown } from "./performance";
import { QualityPatterns } from "./QualityPatterns";
import { useCurrentUser } from "../profile/useCurrentUser";
import { rolesForUser } from "../../lib/roles";

export function PerformancePage() {
  const { t, language } = useT();
  const me = useCurrentUser();
  const roles = rolesForUser(me.data?.data);
  const manager = roles.includes("branch_manager") && !roles.some(role => ["quality_lead", "admin", "clouduser"].includes(role));
  const cases = useCases(), roots = useActiveRootCauses(), branches = useCaseBranches();
  const rows = cases.data ?? [];
  const result = branchPerformance(rows, branches.data?.map(row => row.itemId));
  const number = (value?: number) => value === undefined ? "-" : new Intl.NumberFormat(language).format(value);
  return <section className="performance-page"><PageHeader title={t(manager ? "account.managerDashboard" : "account.qualityDashboard")} subtitle={t("performance.subtitle")} />
    {cases.isError ? <Alert tone="error">{t(manager && !me.data?.data?.BranchId ? "account.branchMissing" : "cases.loadFailed")} <button onClick={() => void cases.refetch()}>{t("common.refresh")}</button></Alert> : cases.isLoading ? <p role="status">{t("common.loading")}</p> : <>
      {branches.isError ? <Alert tone="error">{t("complaint.branchesFailed")}</Alert> : null}
      <ResolutionOverview rows={rows} />
      <section><h2>{t("performance.branches")}</h2><div className="performance-table"><table className="data-table"><thead><tr>{["branch", "total", "open", "resolved", "verified", "unverified", "rate", "average"].map(key => <th key={key}>{t(tx(key === "branch" ? "trends.colBranch" : `dashboard.${key}`))}</th>)}</tr></thead><tbody>{result.map(row => <tr key={row.branchId}><th scope="row">{branches.data?.find(branch => branch.itemId === row.branchId)?.name ?? row.branchId}</th>{(["total", "open", "resolved", "verified", "unverified", "rate", "average"] as const).map(key => <td key={key}>{number(row[key])}{key === "rate" && row[key] !== undefined ? "%" : ""}</td>)}</tr>)}</tbody></table></div></section>
      <div className="performance-breakdowns">{(["Category", "Severity", "RootCauseId"] as const).map(field => <section key={field}><h2>{t(tx(`performance.${field}`))}</h2><dl>{complaintBreakdown(rows, field).map(group => <div key={group.value}><dt>{field === "RootCauseId" ? roots.data?.find(root => root.itemId === group.value)?.DisplayName ?? group.value : t(tx(field === "Category" ? `cases.category.${group.value}` : `cases.severity.${group.value.toLowerCase()}`))}</dt><dd>{number(group.count)}</dd></div>)}</dl></section>)}</div>
      <section><h2>{t("performance.spikes")}</h2><p className="muted">{t("performance.spikeRule")}</p>{result.some(row => row.spike) ? result.filter(row => row.spike).map(row => <p key={row.branchId}>{branches.data?.find(branch => branch.itemId === row.branchId)?.name ?? row.branchId}: {number(row.recent)} / {number(row.previous)}</p>) : <p>{t("performance.noSpikes")}</p>}</section>
      <QualityPatterns />
    </>}
  </section>;
}
