import { Activity, Hospital, UserPlus } from "lucide-react";
import { useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { useEnabledOrganizations } from "../organizations/useEnabledOrganizations";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";

type SignupPageProps = { onNavigate: (path: string) => void };

type SignupFormState = {
  confirmPassword: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  password: string;
};

const EMPTY_FORM: SignupFormState = {
  confirmPassword: "",
  email: "",
  firstName: "",
  lastName: "",
  organizationId: "",
  password: ""
};

// Minimal email shape check -- IAM owns the full password policy and the
// authoritative "already in use" answer; the duplicate check below
// (emailAvailable) gives a faster failure UX without trusting the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage({ onNavigate }: SignupPageProps) {
  const { t } = useT();
  const orgs = useEnabledOrganizations();
  const [form, setForm] = useState<SignupFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  function update<K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!EMAIL_RE.test(form.email)) {
      setError(t("auth.signup.invalidEmail"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("auth.signup.passwordTooShort"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("auth.signup.passwordMismatch"));
      return;
    }
    if (!form.organizationId) {
      setError(t("auth.signup.orgRequired"));
      return;
    }

    setPending(true);
    try {
      // Optional pre-check: faster "email already in use" UX without
      // trusting the client to decide -- IAM still validates on signup.
      const availability = await blocksClient.iam.users.emailAvailable({ email: form.email });
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
      await blocksClient.auth.signup({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        organizationId: form.organizationId,
        password: form.password,
        roleSlugs: ["patient"]
      });

      // Best-effort: write the initial PatientMembership row so future
      // multi-org grants have somewhere to attach. If the schema hasn't
      // been pushed yet (Phase B gate not yet approved), we log and
      // continue -- the IAM membership is the authoritative one for
      // auth purposes.
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
        await blocksClient.data.collection("PatientMembership").create({
          CrossOrgShare: false,
          DataAccessMode: "read",
          ExpiresAt: expiresAt.toISOString(),
          GranteeOrgId: form.organizationId,
          GrantedAt: now.toISOString(),
          GrantMethod: "signup",
          HomeOrgId: form.organizationId,
          Notes: "Initial signup consent (home org)",
          PatientUserId: form.email, // best-available until IAM returns the user id
          Scope: "complaint-only",
          Status: "active"
        });
      } catch (membershipError) {
        // Logged for ops; UX is unaffected because auth is already done.
        // eslint-disable-next-line no-console
        console.warn("PatientMembership row could not be created (schema may not be pushed yet):", membershipError);
      }

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
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-brand">
          <span className="brand-mark"><Activity size={18} /></span>
          <span>{t("app.name")}</span>
        </div>
        <h2>{t("auth.signup.title")}</h2>
        <p>{t("auth.signup.subtitle")}</p>

        <label className="form-field">
          <span>{t("auth.signup.firstName")}</span>
          <input
            type="text"
            autoComplete="given-name"
            required
            value={form.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            disabled={pending}
          />
        </label>

        <label className="form-field">
          <span>{t("auth.signup.lastName")}</span>
          <input
            type="text"
            autoComplete="family-name"
            required
            value={form.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            disabled={pending}
          />
        </label>

        <label className="form-field">
          <span>{t("auth.signup.email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            disabled={pending}
          />
        </label>

        <label className="form-field">
          <span>
            <Hospital size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {t("auth.signup.org")}
          </span>
          <select
            required
            value={form.organizationId}
            onChange={(event) => update("organizationId", event.target.value)}
            disabled={pending || orgs.isLoading || (orgs.data ?? []).length === 0}
          >
            <option value="">
              {orgs.isLoading
                ? t("common.loading")
                : (orgs.data ?? []).length === 0
                  ? t("auth.signup.orgEmpty")
                  : t("auth.signup.orgPlaceholder")}
            </option>
            {(orgs.data ?? []).map((org) => (
              <option key={org.itemId} value={org.itemId}>
                {org.name}
              </option>
            ))}
          </select>
          {orgs.isError ? (
            <small className="muted">{t("auth.signup.orgLoadError")}</small>
          ) : !orgs.isLoading && (orgs.data ?? []).length === 0 ? (
            <small className="muted">{t("auth.signup.orgEmptyHint")}</small>
          ) : null}
        </label>

        <label className="form-field">
          <span>{t("auth.signup.password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            disabled={pending}
          />
        </label>

        <label className="form-field">
          <span>{t("auth.signup.confirmPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            disabled={pending}
          />
        </label>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <button type="submit" className="primary-button auth-submit" disabled={pending}>
          <UserPlus size={18} />
          {pending ? t("auth.signup.submitting") : t("auth.signup.submit")}
        </button>

        <button
          type="button"
          className="icon-button"
          style={{ justifyContent: "center" }}
          onClick={() => onNavigate("/login")}
          disabled={pending}
        >
          {t("auth.signup.haveAccount")}
        </button>
      </form>
    </div>
  );
}
