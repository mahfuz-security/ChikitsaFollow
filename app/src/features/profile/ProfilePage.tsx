import { Check, LogOut, Mail, Pencil, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { ThemeToggle } from "../../app/layout/ThemeToggle";
import { blocksClient } from "../../lib/blocks/client";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useCurrentUser, userDisplayName, userInitials } from "./useCurrentUser";
import { PayoutProfile } from "../refunds/PayoutProfile";
import { rolesForUser } from "./useHasRole";
import { PatientHospitals } from "./PatientHospitals";

export function ProfilePage() {
  const me = useCurrentUser();
  const { logout } = useAuth();
  const { t, language, languages, setLanguage } = useT();
  const queryClient = useQueryClient();
  const profile = me.data?.data;
  const roles = rolesForUser(profile);
  const staff = roles.some(role => ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"].includes(role));
  const branchScoped = roles.some(role => ["front_desk", "branch_manager"].includes(role)) && !roles.some(role => ["quality_lead", "admin", "clouduser"].includes(role));
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const response = await blocksClient.iam.updateMe({ firstName: firstName.trim(), lastName: lastName.trim() });
      if (response.isSuccess === false || (Array.isArray(response.errors) && response.errors.length)) throw new Error("Profile update rejected");
      return response;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["iam", "me"] }); setEditing(false); setSaved(true); }
  });
  function edit() { setFirstName(profile?.firstName ?? ""); setLastName(profile?.lastName ?? ""); setEditing(true); setSaved(false); save.reset(); }

  return <section className="profile-page">
    <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />
    {me.isLoading ? <Skeleton className="skeleton-line-lg" /> : me.isError ? <Alert tone="error">{t("common.error")} <button onClick={() => me.refetch()}>{t("common.refresh")}</button></Alert> : <>
      <header className="profile-identity">
        <span className="avatar avatar-lg profile-avatar">{userInitials(profile)}</span>
        <div><p className="muted">{staff ? roles.map(role => t(tx(`account.role.${role}`), role)).join(", ") : t("profile.member")}</p><h2>{userDisplayName(profile)}</h2><p className="profile-email"><Mail size={16} />{profile?.email}</p><span className="profile-verified"><ShieldCheck size={16} />{t("profile.session")}</span></div>
      </header>
      {saved ? <Alert tone="info">{t("profile.saved")}</Alert> : null}
      <div className="profile-sections">
        {roles.includes("patient") && !staff ? <PatientHospitals /> : null}
        {staff ? <section className="profile-section"><h2>{t("account.access")}</h2><dl className="profile-data"><div><dt>{t("account.roles")}</dt><dd>{roles.map(role => t(tx(`account.role.${role}`), role)).join(", ")}</dd></div><div><dt>{t("account.scope")}</dt><dd>{branchScoped ? String(profile?.BranchId || t("account.unassigned")) : t("account.crossBranch")}</dd></div></dl>{branchScoped && !profile?.BranchId ? <Alert tone="error">{t("account.branchMissing")}</Alert> : null}</section> : null}
        {profile?.itemId && roles.includes("patient") && !staff ? <PayoutProfile key={profile.itemId} owner={profile.itemId} /> : null}
        <section className="profile-section">
          <div className="profile-section-heading"><span className="depth-icon"><UserRound size={22} /></span><h2>{t("profile.personal")}</h2>{!editing ? <ActionButton variant="icon" title={t("profile.edit")} onClick={edit} icon={<Pencil size={18} />} /> : null}</div>
          {editing ? <form onSubmit={event => { event.preventDefault(); if (firstName.trim() && lastName.trim()) save.mutate(); }} className="profile-edit">
            <label className="form-field"><span>{t("auth.signup.firstName")}</span><input autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={80} required disabled={save.isPending} /></label>
            <label className="form-field"><span>{t("auth.signup.lastName")}</span><input autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} maxLength={80} required disabled={save.isPending} /></label>
            {save.isError ? <Alert tone="error">{t("profile.failed")}</Alert> : null}
            <div className="row-actions"><ActionButton type="submit" disabled={save.isPending || !firstName.trim() || !lastName.trim()} icon={<Check size={18} />}>{t(save.isPending ? "common.saving" : "common.save")}</ActionButton><ActionButton variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>{t("common.cancel")}</ActionButton></div>
          </form> : <dl className="profile-data"><div><dt>{t("auth.signup.firstName")}</dt><dd>{profile?.firstName || "-"}</dd></div><div><dt>{t("auth.signup.lastName")}</dt><dd>{profile?.lastName || "-"}</dd></div><div><dt>{t("auth.signup.email")}</dt><dd>{profile?.email || "-"}</dd></div></dl>}
          <p className="profile-note">{t("profile.emailNote")}</p>
        </section>
        <section className="profile-section"><div className="profile-section-heading"><span className="depth-icon depth-blue"><SlidersHorizontal size={22} /></span><h2>{t("profile.preferences")}</h2></div><p className="profile-note">{t("profile.preferencesText")}</p>
          <label className="preference-row"><span>{t("profile.language")}</span><select value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(entry => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</select></label>
          <div className="preference-row"><span>{t("profile.appearance")}</span><ThemeToggle /></div>
        </section>
        <section className="profile-section"><div className="profile-section-heading"><span className="depth-icon"><ShieldCheck size={22} /></span><h2>{t("profile.security")}</h2></div><p className="profile-note">{t("profile.securityText")}</p><ActionButton variant="secondary" onClick={() => logout()} icon={<LogOut size={18} />}>{t("profile.signOut")}</ActionButton></section>
      </div>
      <p className="profile-private"><ShieldCheck size={18} />{t("profile.privacy")}</p>
    </>}
  </section>;
}
