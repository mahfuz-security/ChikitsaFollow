import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { SignupPage } from "../../features/auth/SignupPage";
import { ApprovalsPage } from "../../features/approvals/ApprovalsPage";
import { AuditPage } from "../../features/audit/AuditPage";
import { CaseDetailPage } from "../../features/cases/CaseDetailPage";
import { CasesListPage } from "../../features/cases/CasesListPage";
import { NewCasePage } from "../../features/cases/NewCasePage";
import { InvitePage } from "../../features/invites/InvitePage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { TrendsPage } from "../../features/trends/TrendsPage";
import { VocabularyAdminPage } from "../../features/vocab/VocabularyAdminPage";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import { visibleNavItems, rolesForUser } from "../layout/navItems";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { PatientHomePage } from "../../features/profile/PatientHomePage";
import { PatientComplaintPage } from "../../features/cases/PatientComplaintPage";
import { PerformancePage } from "../../features/trends/PerformancePage";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { hasPermission } from "../../lib/permissions";
import { homeView } from "../../lib/roles";

// Unified component contract. The router passes whatever it has; pages
// declare their own narrow shape via inline adapters.
type NavFn = (path: string) => void;
type AnyPageProps = { caseId?: string; onNavigate?: NavFn };

const protectedRoutes: Record<string, React.ComponentType<AnyPageProps>> = {
  "/": HomePage,
  "/profile": ProfilePage as React.ComponentType<AnyPageProps>,
  "/complaints": PatientComplaintPage as React.ComponentType<AnyPageProps>,
  "/error": ErrorPage as React.ComponentType<AnyPageProps>,
  "/invites": InvitePage as React.ComponentType<AnyPageProps>,
  "/cases": CasesListPage as React.ComponentType<AnyPageProps>,
  "/cases/new": NewCasePage as React.ComponentType<AnyPageProps>,
  "/approvals": ApprovalsPage as React.ComponentType<AnyPageProps>,
  "/trends": TrendsPage as React.ComponentType<AnyPageProps>,
  "/reports": PerformancePage as React.ComponentType<AnyPageProps>,
  "/audit": AuditPage as React.ComponentType<AnyPageProps>,
  "/admin/vocab": VocabularyAdminPage as React.ComponentType<AnyPageProps>
};

function HomePage({ onNavigate }: AnyPageProps) {
  const me = useCurrentUser();
  const { t } = useT();
  if (me.isLoading) return <LoadingScreen />;
  if (me.isError) return <Alert tone="error">{t("common.error")} <button onClick={() => void me.refetch()}>{t("common.refresh")}</button></Alert>;
  const view = homeView(me.data?.data);
  if (view === "performance") return <PerformancePage />;
  if (view === "cases") return <CasesListPage onNavigate={onNavigate ?? (() => undefined)} />;
  if (view === "patient") return <PatientHomePage onNavigate={onNavigate ?? (() => undefined)} />;
  return <Alert tone="error">{t("common.accessDenied")}</Alert>;
}

function RoleGate({ path, children }: { path: string; children: React.ReactNode }) {
  const me = useCurrentUser();
  const { t } = useT();
  if (me.isLoading) return <LoadingScreen />;
  const section = path.startsWith("/cases/") ? "/cases" : path;
  if (path === "/cases/new" && !hasPermission(me.data?.data, "case-create")) return <Alert tone="error">{t("common.accessDenied")}</Alert>;
  const unrestricted = ["/", "/profile", "/error"].includes(section);
  if (!unrestricted && !visibleNavItems(rolesForUser(me.data?.data)).some(item => item.href === section)) return <Alert tone="error">{t("common.accessDenied")}</Alert>;
  return <>{children}</>;
}

function matchParamRoute(path: string): { Component: React.ComponentType<AnyPageProps>; params: Record<string, string> } | undefined {
  const caseMatch = /^\/cases\/([^/]+)$/.exec(path);
  if (caseMatch) {
    return { Component: CaseDetailPage as React.ComponentType<AnyPageProps>, params: { caseId: caseMatch[1] ?? "" } };
  }
  return undefined;
}

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const params = new URLSearchParams(search);
    const returnTo = params.get("returnTo") || undefined;
    const signupSuccess = params.get("signup") === "ok";
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage returnTo={returnTo} signupSuccess={signupSuccess} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/signup") {
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <SignupPage onNavigate={navigate} />
      </RedirectIfAuthenticated>
    );
  }

  const match = protectedRoutes[path] ? undefined : matchParamRoute(path);
  if (match) {
    const C = match.Component;
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <AppShell activePath={path} onNavigate={navigate}>
          <RoleGate path={path}><C caseId={match.params.caseId} onNavigate={navigate} /></RoleGate>
        </AppShell>
      </RequireAuth>
    );
  }

  const C = protectedRoutes[path];
  if (!C) {
    return <NotFoundPage onNavigate={navigate} />;
  }
  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <AppShell activePath={path} onNavigate={navigate}>
        <RoleGate path={path}><C onNavigate={navigate} /></RoleGate>
      </AppShell>
    </RequireAuth>
  );
}
