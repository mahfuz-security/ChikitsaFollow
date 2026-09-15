import { Activity, Check, Circle, Hospital, LoaderCircle, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "../../app/layout/ThemeToggle";
import { blocksClient } from "../../lib/blocks/client";
import { blocksConfig } from "../../lib/blocks/config";
import { signupClinicsForProject } from "../organizations/signupClinics";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { BrandMark } from "../../shared/ui/BrandMark";
import { LanguageSwitcher } from "../../app/layout/LanguageSwitcher";

type SignupPageProps = { onNavigate: (path: string) => void };

type SignupFormState = {
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
};

const EMPTY_FORM: SignupFormState = {
  email: "",
  firstName: "",
  lastName: "",
  organizationId: ""
};

// Minimal email shape check -- IAM owns the full password policy and the
// authoritative "already in use" answer; the duplicate check below
// (emailAvailable) gives a faster failure UX without trusting the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage({ onNavigate }: SignupPageProps) {
  const { t } = useT();
  const clinics = signupClinicsForProject(blocksConfig.xBlocksKey);
  const [form, setForm] = useState<SignupFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const clinic = clinics.find(entry => entry.itemId === form.organizationId);
  const checks = [
    { label: t("auth.signup.detailsReady"), done: Boolean(form.firstName.trim() && form.lastName.trim() && EMAIL_RE.test(form.email.trim())) },
    { label: t("auth.signup.clinicReady"), done: Boolean(clinic) }
  ];
  const ready = checks.every(check => check.done);

  function update<K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t("auth.signup.nameRequired"));
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError(t("auth.signup.invalidEmail"));
      return;
    }
    if (!clinics.some(clinic => clinic.itemId === form.organizationId)) {
      setError(t("auth.signup.orgRequired"));
      return;
    }

    setPending(true);
    try {
      // Optional pre-check: faster "email already in use" UX without
      // trusting the client to decide -- IAM still validates on signup.
      const availability = await blocksClient.iam.users.emailAvailable({ email: form.email.trim() });
      const isAvailable = availability?.isAvailable ?? availability?.IsAvailable;
      if (isAvailable === false) {
        setError(t("auth.signup.emailTaken"));
        setPending(false);
        return;
      }

      // IAM owns the full account-creation contract: send the well-known
      // fields and surface its errors directly rather than pre-validating
      // (per blocks-iam-account skill: "send its expected payload and
      // render its response/errors directly rather than pre-validating
      // fields yourself").
      //
      // `organizationId` selects the org at signup so the patient lands
      // inside that workspace with the `patient` role. `roleSlugs` is
      // belt-and-braces -- signup-settings already injects `patient` as
      // the default -- but explicit beats implicit when IAM's contract
      // is evolving.
      const result = await blocksClient.auth.signup({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        organizationId: form.organizationId,
        roleSlugs: ["patient"]
      });

      if (result.isSuccess === false || (Array.isArray(result.errors) && result.errors.length)) throw new Error(t("auth.signup.failed"));

      // Account is created but not yet active -- the user must open the
      // activation email and set/confirm their password before they can
      // sign in. Redirect them to /login with a confirmation message.
      onNavigate(`/login?signup=ok`);
    } catch (caught) {
      const err = caught as { message?: string; data?: { message?: string }; error_description?: string };
      setError(err?.data?.message || err?.message || err?.error_description || t("auth.signup.failed"));
      setPending(false);
    }
  }

  return (
    <div className="signup-screen">
      <div className="signup-layout">
        <div className="signup-main">
          <header className="signup-header">
            <a className="signup-brand" href="/login" onClick={event => { event.preventDefault(); onNavigate("/login"); }}>
              <BrandMark />
              <span>{t("app.name")}</span>
            </a>
            <div className="login-tools"><ThemeToggle /><LanguageSwitcher /></div>
          </header>
          <form className="signup-form" onSubmit={handleSubmit} noValidate aria-busy={pending}>
            <div className="signup-heading">
              <h1>{t("auth.signup.title")}</h1>
              <p>{t("auth.signup.subtitle")}</p>
            </div>
            <div className="signup-name-row">
              <label className="form-field">
                <span>{t("auth.signup.firstName")}</span>
                <input type="text" autoComplete="given-name" required value={form.firstName} onChange={event => update("firstName", event.target.value)} disabled={pending} />
              </label>
              <label className="form-field">
                <span>{t("auth.signup.lastName")}</span>
                <input type="text" autoComplete="family-name" required value={form.lastName} onChange={event => update("lastName", event.target.value)} disabled={pending} />
              </label>
            </div>
            <label className="form-field">
              <span>{t("auth.signup.email")}</span>
              <input type="email" autoComplete="email" required value={form.email} onChange={event => update("email", event.target.value)} disabled={pending} />
            </label>
            <label className="form-field">
              <span>{t("auth.signup.org")}</span>
              <select required value={form.organizationId} onChange={event => update("organizationId", event.target.value)} disabled={pending || clinics.length === 0}>
                <option value="">{t(clinics.length === 0 ? "auth.signup.orgEmpty" : "auth.signup.orgPlaceholder")}</option>
                {clinics.map(org => <option key={org.itemId} value={org.itemId}>{org.name}</option>)}
              </select>
              {clinics.length === 0 ? <small className="muted">{t("auth.signup.orgEmptyHint")}</small> : null}
            </label>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <button type="submit" className="btn-base btn-primary auth-submit" disabled={pending || clinics.length === 0}>
              {pending ? <LoaderCircle size={18} className="signup-spinner" /> : <UserPlus size={18} />}
              {t(pending ? "auth.signup.submitting" : "auth.signup.submit")}
            </button>
            <button type="button" className="btn-base btn-ghost auth-submit" onClick={() => onNavigate("/login")} disabled={pending}>
              {t("auth.signup.haveAccount")}
            </button>
          </form>
          <footer className="signup-footer">{new Date().getFullYear()} {t("app.name")}</footer>
        </div>
        <section className="signup-companion" aria-labelledby="signup-checklist-title">
          <div className="signup-state" aria-live="polite">
            {pending ? <LoaderCircle size={16} className="signup-spinner" /> : ready ? <Check size={16} /> : <Circle size={12} />}
            {t(pending ? "auth.signup.submitting" : ready ? "auth.signup.ready" : "auth.signup.awaiting")}
          </div>
          <h2 id="signup-checklist-title">{t("auth.signup.setupTitle")}</h2>
          <p className="signup-companion-intro">{t("auth.signup.setupSubtitle")}</p>
          <div className="signup-checklist">
            <h3><ShieldCheck size={20} />{t("auth.signup.checklistTitle")}</h3>
            <ul>
              {checks.map(check => (
                <li key={check.label} className={check.done ? "is-complete" : ""}>
                  {check.done ? <Check size={18} aria-hidden /> : <Circle size={16} aria-hidden />}
                  <span>{check.label}<span className="sr-only">: {t(check.done ? "auth.signup.complete" : "auth.signup.incomplete")}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="signup-clinic">
            <Hospital size={24} aria-hidden />
            <div><h3>{t("auth.signup.yourClinic")}</h3><p>{clinic?.name ?? t("auth.signup.noClinicSelected")}</p></div>
          </div>
          <div className="signup-next">
            <Mail size={24} aria-hidden />
            <div><h3>{t("auth.signup.nextTitle")}</h3><p>{t("auth.signup.nextDescription")}</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
