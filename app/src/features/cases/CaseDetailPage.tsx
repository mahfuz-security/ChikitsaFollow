import { ChevronLeft, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { tx, useT } from "../../lib/i18n/LocalizationProvider";
import { hasPermission } from "../../lib/permissions";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { scanForClinical } from "../ai/firewall";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useActiveRootCauses } from "../vocab/useRootCauses";
import { useAppendCaseEvent, useCase, useCaseEvents, useCloseCase, type CaseRow } from "./useCases";
import { AiDraftReviewDialog } from "./AiDraftReviewDialog";

type CaseDetailPageProps = { caseId: string; onNavigate: (path: string) => void };

export function CaseDetailPage({ caseId, onNavigate }: CaseDetailPageProps) {
  const { t } = useT();
  const me = useCurrentUser();
  const caseRow = useCase(caseId);
  const events = useCaseEvents(caseId);
  const appendEvent = useAppendCaseEvent();
  const closeCase = useCloseCase();
  const causes = useActiveRootCauses();

  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [closing, setClosing] = useState(false);
  const [chosenRootCause, setChosenRootCause] = useState<string | undefined>();
  const [closeNote, setCloseNote] = useState("");
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);

  const canAiDraft = hasPermission(me.data?.data, "case-ai-draft");
  const canSendReply = hasPermission(me.data?.data, "case-send-reply");
  const canClose = hasPermission(me.data?.data, "case-close");

  async function handleSendReply() {
    setError(undefined);
    if (!replyText.trim()) {
      setError(t("cases.detail.replyRequired"));
      return;
    }
    const fw = scanForClinical(replyText);
    if (!fw.ok) {
      setError(t("cases.new.firewallBlocked", fw.message, { detail: fw.message }));
      return;
    }
    try {
      await appendEvent.mutateAsync({
        caseId,
        eventType: "sent_reply",
        actorUserId: me.data?.data?.itemId ?? "unknown",
        text: replyText.trim(),
        aiGenerated: false
      });
      setReplyText("");
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("cases.detail.replyFailed"));
    }
  }

  async function handleConfirmClose() {
    setError(undefined);
    if (!chosenRootCause) {
      setError(t("cases.detail.rootCauseRequired"));
      return;
    }
    try {
      await closeCase.mutateAsync({
        caseId,
        rootCauseId: chosenRootCause,
        actorUserId: me.data?.data?.itemId ?? "unknown",
        note: closeNote.trim() || undefined
      });
      setClosing(false);
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("cases.detail.closeFailed"));
    }
  }

  if (caseRow.isLoading) {
    return (
      <section>
        <PageHeader title={t("cases.detail.title")} subtitle={t("common.loading")} />
        <Skeleton className="skeleton-line" />
      </section>
    );
  }

  const c = caseRow.data as CaseRow | undefined;

  if (!c) {
    return (
      <section>
        <PageHeader title={t("cases.detail.title")} subtitle={t("cases.detail.notFound")} />
        <ActionButton onClick={() => onNavigate("/cases")}>
          <ChevronLeft size={18} />
          {t("common.back")}
        </ActionButton>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={`${t("cases.detail.title")} · ${c.PatientRefCode ?? ""}`}
        subtitle={c.Subject ?? ""}
        actions={
          <ActionButton onClick={() => onNavigate("/cases")}>
            <ChevronLeft size={18} />
            {t("common.back")}
          </ActionButton>
        }
      />

      <div className="panel">
        <div className="case-meta">
          <div><span className="muted">{t("cases.colStatus")}: </span><StatusPill tone={c.Status === "closed" ? "good" : "warn"}>{c.Status ?? "—"}</StatusPill></div>
          <div><span className="muted">{t("cases.colCategory")}: </span>{c.Category ? t(tx(`cases.category.${c.Category}`)) : "—"}</div>
          <div><span className="muted">{t("cases.colSeverity")}: </span>{c.Severity ?? "—"}</div>
          {c.PromisedAt ? <div><span className="muted">{t("cases.detail.promisedAt")}: </span>{new Date(c.PromisedAt).toLocaleString()}</div> : null}
        </div>

        {canAiDraft ? (
          <div className="row-actions">
            <ActionButton variant="secondary" onClick={() => setDraftDialogOpen(true)}>
              <Sparkles size={18} />
              {t("cases.detail.aiDraftCta")}
            </ActionButton>
          </div>
        ) : null}

        {canSendReply ? (
          <div className="reply-box">
            <label className="form-field">
              <span>{t("cases.detail.replyLabel")}</span>
              <textarea
                rows={3}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={t("cases.detail.replyPlaceholder")}
              />
            </label>
            <ActionButton onClick={handleSendReply} disabled={appendEvent.isPending || !replyText.trim()}>
              <Send size={18} />
              {t("cases.detail.sendReply")}
            </ActionButton>
          </div>
        ) : null}

        {canClose && c.Status !== "closed" ? (
          <div className="row-actions">
            <ActionButton onClick={() => setClosing(true)}>
              <X size={18} />
              {t("cases.detail.closeCta")}
            </ActionButton>
          </div>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      <div className="panel">
        <div className="panel-title">{t("cases.detail.history")}</div>
        {events.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : !events.data || events.data.length === 0 ? (
          <p className="muted">{t("cases.detail.noEvents")}</p>
        ) : (
          <ol className="event-list">
            {events.data.map((event) => (
              <li key={event.itemId} className="event-row">
                <div className="event-head">
                  <strong>{t(tx(`cases.event.${event.EventType ?? "note"}`))}</strong>
                  {event.AiGenerated ? <StatusPill tone="neutral">AI</StatusPill> : null}
                </div>
                {event.Text ? <p>{event.Text}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {closing ? (
        <Modal onClose={() => setClosing(false)} title={t("cases.detail.closeTitle")}>
          <div className="form-field">
            <span>{t("cases.detail.rootCauseLabel")}</span>
            <select value={chosenRootCause ?? ""} onChange={(event) => setChosenRootCause(event.target.value)}>
              <option value="">—</option>
              {(causes.data ?? []).map((rc) => (
                <option key={rc.itemId} value={rc.itemId ?? ""}>{rc.DisplayName ?? rc.Slug ?? "—"}</option>
              ))}
            </select>
          </div>
          <label className="form-field">
            <span>{t("cases.detail.closeNote")}</span>
            <textarea rows={3} value={closeNote} onChange={(event) => setCloseNote(event.target.value)} />
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="row-actions">
            <ActionButton onClick={() => setClosing(false)}>{t("common.cancel")}</ActionButton>
            <ActionButton onClick={handleConfirmClose} disabled={closeCase.isPending}>
              {closeCase.isPending ? t("common.saving") : t("cases.detail.confirmClose")}
            </ActionButton>
          </div>
        </Modal>
      ) : null}

      {draftDialogOpen ? <AiDraftReviewDialog caseRow={c} onClose={() => setDraftDialogOpen(false)} /> : null}
    </section>
  );
}
