import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { useAppendCaseEvent } from "./useCases";

export function CaseNotes({ caseId }: { caseId: string }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const append = useAppendCaseEvent();
  return <form className="reply-box" onSubmit={async event => {
    event.preventDefault();
    if (!text.trim() || append.isPending) return;
    try { await append.mutateAsync({ caseId, eventType: "note", actorUserId: "", text: text.trim() }); setText(""); }
    catch { /* Mutation error remains visible and text is retained. */ }
  }}><p className="muted">{t("tickets.internalNotice")}</p><label className="form-field"><span>{t("cases.actionNote")}</span><textarea rows={3} maxLength={500} required value={text} disabled={append.isPending} onChange={event => setText(event.target.value)} /></label>
    {append.isError ? <Alert tone="error">{append.error.message}</Alert> : null}
    <ActionButton type="submit" icon={<MessageSquarePlus size={18} />} disabled={!text.trim() || append.isPending}>{t(append.isPending ? "common.saving" : "cases.review.addComment")}</ActionButton>
  </form>;
}
