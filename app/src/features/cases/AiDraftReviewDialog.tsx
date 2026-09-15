import { Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { hasPermission } from "../../lib/permissions";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { StatusPill } from "../../shared/ui/StatusPill";
import { scanForClinical } from "../ai/firewall";
import { useAiDraft } from "../ai/useAiDraft";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useActiveRootCauses } from "../vocab/useRootCauses";
import { useAppendCaseEvent, useCloseCase, type CaseRow } from "./useCases";

// §6.5 / §7 — AI draft review lives behind a Level 3 glass Modal, not
// inline in the detail panel. Footer splits into three actions: keep
// (primary), discard (ghost), send-and-close (destructive). The dialog
// is the only place where `draftText` is held in component state — once
// the user closes without saving, the draft is discarded.
type AiDraftReviewDialogProps = {
  caseRow: CaseRow;
  onClose: () => void;
};

type DialogPhase = "review" | "send-and-close";

export function AiDraftReviewDialog({ caseRow, onClose }: AiDraftReviewDialogProps) {
  const { t } = useT();
  const me = useCurrentUser();
  const draft = useAiDraft();
  const appendEvent = useAppendCaseEvent();
  const closeCase = useCloseCase();
  const causes = useActiveRootCauses();

  const canSendReply = hasPermission(me.data?.data, "case-send-reply");
  const canClose = hasPermission(me.data?.data, "case-close");

  const [phase, setPhase] = useState<DialogPhase>("review");
  const [draftText, setDraftText] = useState<string | undefined>();
  const [draftSource, setDraftSource] = useState<"template" | "ai">("template");
  const [originalDraft, setOriginalDraft] = useState("");
  const [replyRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | undefined>();
  const [chosenRootCause, setChosenRootCause] = useState<string | undefined>();
  const [closeNote, setCloseNote] = useState("");

  // UX-4: the AI draft lands in the dialog as soon as it opens — the
  // user reviews and either uses it or discards it. Generating on open
  // matches the spec's affordance and keeps the click count to one.
  useEffect(() => {
    void handleGenerate();
    // handleGenerate closes over stable setState; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setError(undefined);
    try {
      const { draft: text, source } = await draft.mutateAsync({
        caseRow,
        actorUserId: me.data?.data?.itemId ?? "unknown"
      });
      setDraftText(text);
      setOriginalDraft(text);
      setDraftSource(source);
      // Append an ai_draft event so the history reflects what was
      // generated (FR-7, FR-17).
      await appendEvent.mutateAsync({
        caseId: caseRow.itemId ?? "",
        eventType: "ai_draft",
        actorUserId: me.data?.data?.itemId ?? "unknown",
        text,
        aiGenerated: source !== "template",
        metadata: { source }
      });
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("cases.detail.draftFailed"));
    }
  }

  async function handleUseAsReply() {
    setError(undefined);
    const text = (draftText ?? "").trim();
    if (!text) {
      setError(t("cases.detail.replyRequired"));
      return;
    }
    const fw = scanForClinical(text);
    if (!fw.ok) {
      setError(t("cases.new.firewallBlocked", fw.message, { detail: fw.message }));
      return;
    }
    if (!canSendReply) {
      setError(t("common.error"));
      return;
    }
    try {
      await appendEvent.mutateAsync({
        caseId: caseRow.itemId ?? "",
        eventType: "sent_reply",
        requestId: replyRequestId,
        actorUserId: me.data?.data?.itemId ?? "unknown",
        text,
        aiGenerated: false,
        metadata: { draftSource, originalDraft, edited: text !== originalDraft }
      });
      onClose();
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("cases.detail.replyFailed"));
    }
  }

  async function handleSendAndClose() {
    setError(undefined);
    const text = (draftText ?? "").trim();
    if (!text) {
      setError(t("cases.detail.replyRequired"));
      return;
    }
    if (!chosenRootCause) {
      setError(t("cases.detail.rootCauseRequired"));
      return;
    }
    const fw = scanForClinical([text, closeNote].join(" "));
    if (!fw.ok) { setError(fw.message); return; }
    if (!canSendReply || !canClose) { setError(t("common.error")); return; }
    try {
      await appendEvent.mutateAsync({
        caseId: caseRow.itemId ?? "",
        eventType: "sent_reply",
        requestId: replyRequestId,
        actorUserId: me.data?.data?.itemId ?? "unknown",
        text,
        aiGenerated: false,
        metadata: { draftSource, originalDraft, edited: text !== originalDraft }
      });
      await closeCase.mutateAsync({
        caseId: caseRow.itemId ?? "",
        rootCauseId: chosenRootCause,
        actorUserId: me.data?.data?.itemId ?? "unknown",
        note: closeNote.trim() || undefined
      });
      onClose();
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("cases.detail.closeFailed"));
    }
  }

  return (
    <Modal onClose={onClose} title={t("cases.detail.aiDraftReviewTitle")}>
      <div className="ai-draft-meta">
        <StatusPill tone="info"><Sparkles size={14} />{t(draftSource === "ai" ? "cases.detail.aiDraftLabel" : "cases.detail.templateLabel")}</StatusPill>
        <span className="muted">{t("cases.detail.aiDraftMeta")}</span>
      </div>

      {draftText === undefined ? (
        <div className="ai-draft-empty">
          <p className="muted">{t("cases.detail.aiDraftEmptyHint")}</p>
          <ActionButton onClick={handleGenerate} disabled={draft.isPending}>
            <Sparkles size={18} />
            {draft.isPending ? t("cases.detail.drafting") : t("cases.detail.aiDraft")}
          </ActionButton>
        </div>
      ) : (
        <textarea
          className="ai-draft-editor"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          rows={6}
          disabled={appendEvent.isPending || closeCase.isPending}
        />
      )}
      {draft.isPending && draftText === undefined ? (
        <p className="muted">{t("cases.detail.drafting")}</p>
      ) : null}

      {phase === "send-and-close" && draftText !== undefined ? (
        <>
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
        </>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="modal-actions">
        {phase === "review" ? (
          <>
            <ActionButton variant="ghost" onClick={onClose}>
              <Trash2 size={18} />
              {t("cases.detail.discard")}
            </ActionButton>
            {canClose && caseRow.Status !== "closed" ? (
              <ActionButton
                variant="destructive"
                onClick={() => setPhase("send-and-close")}
                disabled={draftText === undefined}
              >
                <Send size={18} />
                {t("cases.detail.sendAndClose")}
              </ActionButton>
            ) : null}
            <ActionButton onClick={handleUseAsReply} disabled={draftText === undefined || appendEvent.isPending}>
              <Send size={18} />
              {appendEvent.isPending ? t("common.saving") : t("cases.detail.useAsReply")}
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton variant="ghost" onClick={() => setPhase("review")}>{t("common.cancel")}</ActionButton>
            <ActionButton
              variant="destructive"
              onClick={handleSendAndClose}
              disabled={closeCase.isPending || appendEvent.isPending}
            >
              <Send size={18} />
              {closeCase.isPending ? t("common.saving") : t("cases.detail.confirmSendAndClose")}
            </ActionButton>
          </>
        )}
      </div>
    </Modal>
  );
}
