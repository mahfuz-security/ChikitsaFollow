import { Activity, PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { visibleNavItems } from "./navItems";
import { NotificationsMenu } from "./NotificationsMenu";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useT } from "../../lib/i18n/LocalizationProvider";
import type { TranslationKey } from "../../lib/i18n/dictionary";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import { rolesForUser } from "../../features/profile/useHasRole";
import { BrandMark } from "../../shared/ui/BrandMark";
import { HospitalSwitcher, PatientHospitalScope } from "./HospitalSwitcher";

const COLLAPSED_KEY = "blocks-app:sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 880px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppShell({ activePath, children, onNavigate }: { activePath: string; children: ReactNode; onNavigate: (path: string) => void }) {
  const isMobile = useIsMobile();
  const [collapsedPref, setCollapsedPref] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const { t } = useT();
  const me = useCurrentUser();
  const patient = rolesForUser(me.data?.data).includes("patient") && !rolesForUser(me.data?.data).some(role => ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"].includes(role));
  // On narrow screens the sidebar is always the icon-only rail -- no
  // separate hamburger/drawer/scrim needed, and no dead-end state where
  // nothing on screen can bring navigation back.
  const collapsed = collapsedPref || isMobile;
  const items = visibleNavItems(rolesForUser(me.data?.data));
  const sectionPath = activePath === "/" ? (items.some(item => item.href === "/cases") ? "/cases" : "/") : activePath.startsWith("/cases/") ? "/cases" : activePath;
  const activeItem = items.find((item) => item.href === sectionPath);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsedPref));
  }, [collapsedPref]);

  return (
    <div className="shell">
      <aside className={collapsed ? "collapsed" : ""}>
        <div className="sidebar-header">
          {collapsed ? null : (
            <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onNavigate("/"); }} aria-label={t("app.name")}>
              <BrandMark />
              <span>{t("app.name")}</span>
            </a>
          )}
          {/* Hidden on mobile by CSS (nothing to toggle -- the rail is always
             collapsed there); on desktop it's the only control that can
             re-expand the sidebar, so it must never be the thing collapsing hides. */}
          <button
            type="button"
            className="icon-button sidebar-collapse-toggle"
            onClick={() => setCollapsedPref((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={16} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map((item) => {
            const label = item.labelKey as TranslationKey;
            return (
              <a
                key={item.href}
                href={item.href}
                data-tooltip={t(label)}
                title={t(label)}
                aria-label={t(label)}
                aria-current={sectionPath === item.href ? "page" : undefined}
                className={sectionPath === item.href ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              >
                <item.icon size={18} />
                <span className={collapsed ? "nav-label-collapsed" : ""}>{t(label)}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <a className="mobile-brand" href="/" aria-label={t("app.name")} onClick={event => { event.preventDefault(); onNavigate("/"); }}><BrandMark /><span>{t("app.name")}</span></a>
          {activeItem ? (
            <div className="breadcrumb">
              <activeItem.icon size={16} />
              <span>{t(activeItem.labelKey as TranslationKey)}</span>
            </div>
          ) : null}
          <div className="topbar-spacer" />
          {patient ? <HospitalSwitcher /> : null}
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationsMenu />
          <UserMenu onNavigate={onNavigate} />
        </header>
        <main>{patient ? <PatientHospitalScope>{children}</PatientHospitalScope> : children}</main>
      </div>
    </div>
  );
}
