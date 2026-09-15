import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { useSetCaseDeadline } from "./useCases";
export function CaseDeadline({ caseId }: { caseId: string }) {
  const { t } = useT();
  const [deadline, setDeadline] = useState("");
  const mutation = useSetCaseDeadline();
  return <form className="workflow-form" onSubmit={event => { event.preventDefault(); if (deadline) mutation.mutate({ caseId, promisedAt: deadline }); }}>
    <label className="form-field"><span>{t("cases.followupDeadline")}</span><input type="datetime-local" required value={deadline} onChange={event => setDeadline(event.target.value)} disabled={mutation.isPending} /></label>
    <ActionButton type="submit" icon={<CalendarClock size={18} />} disabled={!deadline || mutation.isPending}>{t("cases.saveDeadline")}</ActionButton>
    {mutation.isError ? <Alert tone="error">{mutation.error.message}</Alert> : mutation.isSuccess ? <p role="status">{t("cases.deadlineSaved")}</p> : null}
  </form>;
}
