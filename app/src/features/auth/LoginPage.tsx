import { Activity, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { isLoginConfigured } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";

export function LoginPage({ returnTo, signupSuccess }: { returnTo?: string; signupSuccess?: boolean }) {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { t } = useT();
  const configured = isLoginConfigured();

  async function handleLogin() {
    setError(undefined);
    setPending(true);
    try {
      await login(returnTo);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  function handleSignup() {
    // Preserve returnTo so a "log in or sign up" choice round-trips back.
    const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    window.history.pushState({}, "", `/signup${query}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Activity size={18} /></span><span>{t("app.name")}</span></div>
        <h2>{t("auth.welcome")}</h2>
        <p>{t("auth.subtitle")}</p>
        {!configured ? (
          <Alert tone="warn">
            {t("auth.notConfigured")} <code>{window.location.origin}/login/callback</code>
          </Alert>
        ) : null}
        {signupSuccess ? <Alert tone="info">{t("auth.signup.checkInbox")}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <button className="primary-button auth-submit" disabled={!configured || pending} onClick={handleLogin}>
          <LogIn size={18} /> {pending ? t("auth.redirecting") : t("auth.continue")}
        </button>
        <button className="icon-button auth-submit" type="button" disabled={pending} onClick={handleSignup}>
          <UserPlus size={18} /> {t("auth.signUp")}
        </button>
      </div>
    </div>
  );
}
