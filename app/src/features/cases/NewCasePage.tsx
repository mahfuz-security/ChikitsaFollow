import { ClipboardList, ChevronLeft } from "lucide-react";
import { useId, useState } from "react";
import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { scanForClinical } from "../ai/firewall";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useCaseBranches } from "../organizations/useCaseBranches";
import { useCreateCase, type CaseCategory, type CaseSeverity } from "./useCases";

const CATEGORIES: { value: CaseCategory; labelKey: string }[] = [
  { value: "report_delay", labelKey: "cases.category.report_delay" },
  { value: "instructions", labelKey: "cases.category.instructions" },
  { value: "missed_follow_up", labelKey: "cases.category.missed_follow_up" },
  { value: "wait_time", labelKey: "cases.category.wait_time" },
  { value: "billing", labelKey: "cases.category.billing" },
  { value: "staff_behavior", labelKey: "cases.category.staff_behavior" },
  { value: "facility", labelKey: "cases.category.facility" },
  { value: "communication", labelKey: "cases.category.communication" },
  { value: "other", labelKey: "cases.category.other" }
];

const SEVERITIES: CaseSeverity[] = ["Low", "Medium", "High"];

type NewCasePageProps = { onNavigate: (path: string) => void };

export function NewCasePage({ onNavigate }: NewCasePageProps) {
  const { t } = useT();
  const subjectLabelId = useId();
  const subjectHintId = useId();
  const me = useCurrentUser();
  const orgs = useCaseBranches();
  const create = useCreateCase();

  // Front-desk entry is restricted to the branch assigned by IAM.
  const branchId = (me.data?.data as { BranchId?: string } | undefined)?.BranchId ?? "";
  const homeOrg = orgs.data?.find(org => org.itemId === branchId);

  const [category, setCategory] = useState<CaseCategory>("wait_time");
  const [severity, setSeverity] = useState<CaseSeverity>("Medium");
  const [subject, setSubject] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [commitment, setCommitment] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientId, setPatientId] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!branchId) {
      setError(t("cases.new.noBranch"));
      return;
    }
    if (!subject.trim()) {
      setError(t("cases.new.subjectRequired"));
      return;
    }
    // FR-19: firewall before submit.
    const fw = scanForClinical(subject);
    if (!fw.ok) {
      setError(t("cases.new.firewallBlocked", fw.message, { detail: fw.message }));
      return;
    }
    try {
      const result = await create.mutateAsync({
        patientEmail, patientId, requestId,
        branchId,
        category,
        severity,
        subject: subject.trim(),
        commitment: commitment.trim(),
        promisedAt: promisedAt ? new Date(promisedAt).toISOString() : undefined,
        actorUserId: me.data?.data?.itemId ?? "unknown"
      });
      onNavigate(`/cases/${result.caseRow.itemId ?? ""}`);
    } catch (caught) {
      const err = caught as { message?: string; data?: { message?: string } };
      const code = err?.data?.message || err?.message;
      setError(t(code === "patient_email_not_available" ? "tickets.patientMissing" : code === "ticket_service_unavailable" ? "tickets.unavailable" : code === "ticket_submission_requires_review" ? "refund.needsReview" : "cases.new.submitFailed"));
    }
  }

  return (
    <section className="case-entry front-desk-view">
      <PageHeader
        title={t("cases.new.title")}
        subtitle={t("cases.new.subtitle")}
        actions={
          <ActionButton variant="ghost" onClick={() => onNavigate("/cases")}>
            <ChevronLeft size={18} />
            {t("common.back")}
          </ActionButton>
        }
      />

      {!me.isLoading && !branchId ? <Alert tone="error">{t("account.branchMissing")}</Alert> : null}

      <form className="case-form" onSubmit={handleSubmit}>
        <div className="panel-title">
          <ClipboardList size={18} />
          <span>{t("cases.new.formTitle")}</span>
        </div>
        <p className="muted">
          {t("cases.new.branchLabel")}: <strong>{homeOrg?.name ?? (branchId || "—")}</strong>
        </p>

        <label className="form-field"><span>{t("tickets.patientEmail")}</span><input type="email" aria-label={t("tickets.patientEmail")} value={patientEmail} onChange={event => setPatientEmail(event.target.value)} maxLength={254} autoComplete="off" required disabled={create.isPending} /><small>{t("tickets.emailHint")}</small></label>
        <label className="form-field"><span>{t("hospitals.patientId")}</span><input value={patientId} onChange={event => setPatientId(event.target.value)} minLength={2} maxLength={64} autoComplete="off" required disabled={create.isPending} /></label>
        <div className="form-row">
          <fieldset className="form-field" disabled={create.isPending}>
            <legend>{t("cases.new.category")}</legend>
            <div className="chip-row">
              {CATEGORIES.map((c) => (
                <label key={c.value} className={`chip-toggle ${category === c.value ? "chip-on" : ""}`}>
                  <input
                    type="radio"
                    name="category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                  />
                  {t(tx(c.labelKey))}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-field" disabled={create.isPending}>
            <legend>{t("cases.new.severity")}</legend>
            <div className="chip-row">
              {SEVERITIES.map((s) => (
                <label key={s} className={`chip-toggle ${severity === s ? "chip-on" : ""}`}>
                  <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} />
                  {t(tx(`cases.severity.${s.toLowerCase()}`))}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="form-field">
          <span id={subjectLabelId}>{t("cases.new.subject")}</span>
          <input
            aria-labelledby={subjectLabelId}
            aria-describedby={subjectHintId}
            type="text"
            maxLength={120}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={create.isPending}
            placeholder={t("cases.new.subjectPlaceholder")}
            required
          />
          <small id={subjectHintId} className="muted">{t("cases.new.subjectHint")}</small>
        </label>

        <label className="form-field">
          <span>{t("cases.new.commitment")}</span>
          <textarea rows={2} maxLength={500} value={commitment} onChange={event => setCommitment(event.target.value)} disabled={create.isPending} />
        </label>
        <label className="form-field">
          <span>{t("cases.new.promisedAt")}</span>
          <input
            type="datetime-local"
            value={promisedAt}
            onChange={(event) => setPromisedAt(event.target.value)}
            disabled={create.isPending}
          />
        </label>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="form-actions">
        <ActionButton type="submit" disabled={create.isPending || !branchId || me.isLoading}>
          {create.isPending ? t("cases.new.submitting") : t("cases.new.submit")}
        </ActionButton>
        </div>
      </form>
    </section>
  );
}
