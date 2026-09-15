import { useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { useActiveRootCauses } from "../vocab/useRootCauses";
import { useTransitionCase, type CaseRow } from "./useCases";

export function CaseWorkflow({ row }: { row: CaseRow }) {
  const { t } = useT();
  const causes = useActiveRootCauses();
  const transition = useTransitionCase();
  const [rootCause, setRootCause] = useState("");
  const next = row.Status === "in_progress" ? "resolved" : "in_progress";
  if (!["open", "awaiting_approval", "in_progress"].includes(row.Status ?? "")) return null;
  return <form className="workflow-form" onSubmit={event => { event.preventDefault(); transition.mutate({ caseId: row.itemId ?? "", status: next, rootCauseId: rootCause || undefined }); }}>
    <label className="form-field"><span>{t("cases.colStatus")}</span><select value={next} disabled={transition.isPending}><option value={next}>{t(next === "resolved" ? "cases.status.resolved" : "cases.status.in_progress")}</option></select></label>
    {next === "resolved" ? <label className="form-field"><span>{t("cases.detail.rootCauseLabel")}</span><select required value={rootCause} onChange={event => setRootCause(event.target.value)} disabled={transition.isPending}><option value="">-</option>{causes.data?.map(cause => <option key={cause.itemId} value={cause.itemId}>{cause.DisplayName}</option>)}</select></label> : null}
    <ActionButton type="submit" disabled={transition.isPending || (next === "resolved" && !rootCause)}>{t(transition.isPending ? "common.saving" : "common.save")}</ActionButton>
    {transition.isError ? <Alert tone="error">{transition.error.message}</Alert> : null}
  </form>;
}
