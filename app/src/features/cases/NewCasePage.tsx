import { AlertTriangle, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { scanForClinical } from "../ai/firewall";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useEnabledOrganizations } from "../organizations/useEnabledOrganizations";
import { useCreateCase, type CaseCategory, type CaseSeverity } from "./useCases";

const CATEGORIES: { value: CaseCategory; labelKey: string }[] = [
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
  const me = useCurrentUser();
  const orgs = useEnabledOrganizations();
  const create = useCreateCase();

  // Branch is locked to the user's home branch. The home branch comes
  // from the org context for now (first enabled org for the manager;
  // manager of the org for the front-desk). A real per-user branch
  // assignment ships in a later slice.
  const homeOrg = orgs.data?.[0];
  const branchId = homeOrg?.itemId ?? "";

  const [category, setCategory] = useState<CaseCategory>("wait_time");
  const [severity, setSeverity] = useState<CaseSeverity>("Medium");
  const [subject, setSubject] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
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
        branchId,
        category,
        severity,
        subject: subject.trim(),
        promisedAt: promisedAt ? new Date(promisedAt).toISOString() : undefined,
        actorUserId: me.data?.data?.itemId ?? "unknown"
      });
      onNavigate(`/cases/${result.caseRow.itemId ?? ""}`);
    } catch (caught) {
      const err = caught as { message?: string; data?: { message?: string } };
      setError(err?.data?.message || err?.message || t("cases.new.submitFailed"));
    }
  }

  return (
    <section>
      <PageHeader
        title={t("cases.new.title")}
        subtitle={t("cases.new.subtitle")}
        actions={
          <ActionButton onClick={() => onNavigate("/cases")}>
            <ChevronLeft size={18} />
            {t("common.back")}
          </ActionButton>
        }
      />

      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel-title">
          <AlertTriangle size={16} />
          <span>{t("cases.new.formTitle")}</span>
        </div>
        <p className="muted">
          {t("cases.new.branchLabel")}: <strong>{homeOrg?.name ?? "—"}</strong>
        </p>

        <div className="form-row">
          <fieldset className="form-field">
            <legend>{t("cases.new.category")}</legend>
            <div className="chip-row">
              {CATEGORIES.map((c) => (
                <label key={c.value} className={`chip ${category === c.value ? "chip-on" : ""}`}>
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

          <fieldset className="form-field">
            <legend>{t("cases.new.severity")}</legend>
            <div className="chip-row">
              {SEVERITIES.map((s) => (
                <label key={s} className={`chip ${severity === s ? "chip-on" : ""}`}>
                  <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} />
                  {t(tx(`cases.severity.${s.toLowerCase()}`))}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="form-field">
          <span>{t("cases.new.subject")}</span>
          <input
            type="text"
            maxLength={120}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={create.isPending}
            placeholder={t("cases.new.subjectPlaceholder")}
            required
          />
          <small className="muted">{t("cases.new.subjectHint")}</small>
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

        <ActionButton type="submit" disabled={create.isPending}>
          {create.isPending ? t("cases.new.submitting") : t("cases.new.submit")}
        </ActionButton>
      </form>
    </section>
  );
}
