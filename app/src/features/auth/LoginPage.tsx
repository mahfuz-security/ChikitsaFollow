import { Activity, LoaderCircle, LogIn, Pause, Play, ShieldCheck, UserPlus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { ThemeToggle } from "../../app/layout/ThemeToggle";
import { useAuth } from "../../app/providers/AuthProvider";
import { isLoginConfigured } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { BrandMark } from "../../shared/ui/BrandMark";
import { LanguageSwitcher } from "../../app/layout/LanguageSwitcher";

const LoginScene = lazy(() => import("./LoginScene"));

export function LoginPage({ returnTo, signupSuccess }: { returnTo?: string; signupSuccess?: boolean }) {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { t } = useT();
  const configured = isLoginConfigured();
  const [paused, setPaused] = useState(false);

  async function handleLogin() {
    setError(undefined);
    setPending(true);
    try {
      await login(returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.failed"));
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
    <div className="login-screen">
      <Suspense fallback={null}><LoginScene paused={paused} /></Suspense>
      <header className="login-header">
        <div className="login-wordmark"><BrandMark /><span>{t("app.name")}</span></div>
        <div className="login-tools">
          <button type="button" className="icon-button login-motion" aria-label={t(paused ? "auth.resumeMotion" : "auth.pauseMotion")} title={t(paused ? "auth.resumeMotion" : "auth.pauseMotion")} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>
      <div className="login-body">
      <section className="login-content" aria-labelledby="login-title">
        <p className="login-welcome">{t("auth.welcome")}</p>
        <h1 id="login-title">{t("app.name")}</h1>
        <p className="login-intro">{t("auth.loginIntro")}</p>
        <div className="login-actions" aria-busy={pending}>
        {!configured ? (
          <Alert tone="warn">
            {t("auth.loginUnavailable")}
          </Alert>
        ) : null}
        {signupSuccess ? <Alert tone="info">{t("auth.signup.checkInbox")}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <button type="button" className="btn-base btn-primary auth-submit" disabled={!configured || pending} onClick={handleLogin}>
          {pending ? <LoaderCircle size={20} className="signup-spinner" /> : <LogIn size={20} />} {pending ? t("auth.redirecting") : t("auth.continue")}
        </button>
        <div className="login-divider"><span>{t("auth.newHere")}</span></div>
        <button className="btn-base btn-secondary auth-submit" type="button" disabled={pending} onClick={handleSignup}>
          <UserPlus size={18} /> {t("auth.signUp")}
        </button>
        </div>
        <p className="login-security"><ShieldCheck size={18} aria-hidden />{t("auth.securedBy")}</p>
      </section>
      </div>
      <footer className="login-footer"><span>{new Date().getFullYear()} {t("app.name")}</span><span>{t("auth.footerNote")}</span></footer>
    </div>
  );
}
