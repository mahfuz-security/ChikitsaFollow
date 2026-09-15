import { gatewayCollection } from "../../lib/blocks/gateway";
import { Mail, Send, ShieldCheck, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useEnabledOrganizations } from "../organizations/useEnabledOrganizations";
import { useCurrentUser } from "../profile/useCurrentUser";
import { rolesForUser } from "../profile/useHasRole";
import { useCancelInvite, useCreateInvite, useInvitesForOrg, type InviteRow, type InviteStatus } from "./useInvites";

const INVITABLE_ROLES = ["doctor", "nurse"] as const;
const MANAGER_ONLY_ROLES = ["branch_manager"] as const;

// Roles the current caller is allowed to invite. branch_manager can invite
// doctor + nurse; admin/clouduser can additionally invite branch_manager.
function rolesCallerCanInvite(callerRoles: string[]): string[] {
  const set = new Set<string>();
  for (const role of INVITABLE_ROLES) {
    if (callerRoles.includes("branch_manager") || callerRoles.includes("admin") || callerRoles.includes("clouduser")) {
      set.add(role);
    }
  }
  if (callerRoles.includes("admin") || callerRoles.includes("clouduser")) {
    for (const role of MANAGER_ONLY_ROLES) set.add(role);
  }
  return Array.from(set);
}

function statusTone(status: InviteStatus | undefined): "good" | "warn" | "neutral" {
  if (status === "pending") return "warn";
  if (status === "accepted") return "good";
  return "neutral";
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function InvitePage() {
  const me = useCurrentUser();
  const orgs = useEnabledOrganizations();
  const { t } = useT();

  const callerRoles = useMemo(() => rolesForUser(me.data?.data), [me.data?.data]);
  const inviteableRoles = useMemo(() => rolesCallerCanInvite(callerRoles), [callerRoles]);

  // The "home org" for a branch_manager is the org they were assigned to
  // at signup. For now we take the first enabled org -- a real selection
  // mechanism (or per-user org context) ships in Phase E.
  const homeOrg = orgs.data?.[0];
  const invites = useInvitesForOrg(homeOrg?.itemId);
  const create = useCreateInvite();
  const cancel = useCancelInvite();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(inviteableRoles[0] ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const isInviter = callerRoles.includes("branch_manager") || callerRoles.includes("admin") || callerRoles.includes("clouduser");

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!homeOrg) {
      setError(t("invites.noOrg"));
      return;
    }
    if (!email || !email.includes("@")) {
      setError(t("invites.invalidEmail"));
      return;
    }
    if (!role) {
      setError(t("invites.roleRequired"));
      return;
    }
    try {
      await create.mutateAsync({
        email,
        orgId: homeOrg.itemId,
        roleSlug: role,
        invitedByUserId: me.data?.data?.itemId ?? "unknown",
        note: note || undefined
      });
      setEmail("");
      setNote("");
    } catch (caught) {
      const err = caught as { message?: string; data?: { message?: string } };
      setError(err?.data?.message || err?.message || t("invites.createFailed"));
    }
  }

  async function handleCancel(invite: InviteRow) {
    if (!homeOrg || !invite.InviteId) return;
    try {
      await cancel.mutateAsync({ inviteId: invite.InviteId, orgId: homeOrg.itemId });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("invites.cancelFailed"));
    }
  }

  async function handleResend(invite: InviteRow) {
    if (!homeOrg) return;
    setError(undefined);
    try {
      // Re-create a fresh invite with the same email + role, same TTL.
      // (Phase E will swap this for IAM's `users.invite` once email
      // delivery is wired in. For now we just add a new row.)
      await gatewayCollection("Invite").create({
        InviteId: invite.InviteId, // carry id so the row reads as the same invite
        Email: invite.Email,
        RoleSlug: invite.RoleSlug,
        OrgId: homeOrg.itemId,
        InvitedByUserId: me.data?.data?.itemId ?? "unknown",
        Status: "pending" as InviteStatus,
        CreatedAt: new Date().toISOString(),
        ExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("invites.resendFailed"));
    }
  }

  if (!isInviter) {
    return (
      <section>
        <PageHeader title={t("invites.title")} subtitle={t("invites.subtitle")} />
        <Alert tone="warn">{t("invites.forbidden")}</Alert>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={t("invites.title")}
        subtitle={t("invites.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => invites.refetch()} icon={<Send size={18} />} title="Refresh invites" />}
      />

      {!homeOrg ? (
        <Alert tone="info">{t("invites.noOrgAvailable")}</Alert>
      ) : (
        <>
          <form className="panel" onSubmit={handleCreate}>
            <div className="panel-title"><UserPlus size={16} /><span>{t("invites.formTitle")}</span></div>
            <p className="muted">{`Inviting into ${homeOrg.name ?? ""}.`}</p>
            <div className="form-row">
              <label className="form-field">
                <span>{t("invites.email")}</span>
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={create.isPending} />
              </label>
              <label className="form-field">
                <span>{t("invites.role")}</span>
                <select value={role} onChange={(event) => setRole(event.target.value)} disabled={create.isPending}>
                  {inviteableRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>{t("invites.note")}</span>
              <input type="text" value={note} onChange={(event) => setNote(event.target.value)} disabled={create.isPending} />
            </label>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <ActionButton type="submit" disabled={create.isPending}>
              <Mail size={18} />
              {create.isPending ? t("invites.sending") : t("invites.send")}
            </ActionButton>
          </form>

          <div className="panel">
            <div className="panel-title"><ShieldCheck size={16} /><span>{t("invites.listTitle")}</span></div>
            {invites.isLoading ? (
              <Skeleton className="skeleton-line" />
            ) : !invites.data || invites.data.length === 0 ? (
              <p className="muted">{t("invites.empty")}</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("invites.colEmail")}</th>
                    <th>{t("invites.colRole")}</th>
                    <th>{t("invites.colStatus")}</th>
                    <th>{t("invites.colCreated")}</th>
                    <th>{t("invites.colExpires")}</th>
                    <th>{t("invites.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.data.map((invite) => (
                    <tr key={invite.InviteId ?? invite.itemId}>
                      <td>{invite.Email ?? "—"}</td>
                      <td>{invite.RoleSlug ?? "—"}</td>
                      <td><StatusPill tone={statusTone(invite.Status)}>{invite.Status ?? "unknown"}</StatusPill></td>
                      <td>{formatDate(invite.CreatedAt)}</td>
                      <td>{formatDate(invite.ExpiresAt)}</td>
                      <td>
                        {invite.Status === "pending" ? (
                          <div className="row-actions">
                            <ActionButton variant="icon" onClick={() => handleResend(invite)} title="Resend"><Mail size={16} /></ActionButton>
                            <ActionButton variant="icon" onClick={() => handleCancel(invite)} title="Cancel"><X size={16} /></ActionButton>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
