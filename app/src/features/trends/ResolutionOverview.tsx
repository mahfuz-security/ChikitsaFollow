import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import type { CaseRow } from "../cases/useCases";
import { caseMetrics } from "./metrics";

export function ResolutionOverview({ rows }: { rows: CaseRow[] }) {
  const { t, language } = useT();
  const metrics = caseMetrics(rows);
  return <section aria-label={t("dashboard.title")}><dl className="dashboard-metrics">{(["total", "open", "overdue", "resolved", "verified", "unverified", "rate", "average"] as const).map(key => <div key={key}><dt>{t(tx(`dashboard.${key}`))}</dt><dd>{metrics[key] === undefined ? "-" : new Intl.NumberFormat(language).format(metrics[key])}{key === "rate" && metrics[key] !== undefined ? "%" : ""}</dd></div>)}</dl></section>;
}
