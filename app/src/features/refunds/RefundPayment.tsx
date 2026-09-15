import { Banknote, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { privateApi } from "./privateApi";
import type { PayoutInput, RefundSummary } from "./payoutTypes";

export function RefundPayment({ caseId, approvalId }: { caseId: string; approvalId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return <><ActionButton variant="secondary" icon={<Banknote size={16} />} onClick={() => setOpen(true)}>{t("refund.record")}</ActionButton>{open ? <Modal title={t("refund.record")} onClose={() => setOpen(false)}><PaymentDetails caseId={caseId} approvalId={approvalId} /></Modal> : null}</>;
}
function PaymentDetails({ caseId, approvalId }: { caseId: string; approvalId: string }) {
  const { t } = useT();
  const refund = useQuery({ queryKey: ["private", "refund", caseId], queryFn: () => privateApi<RefundSummary>(`/refunds/${encodeURIComponent(caseId)}`), retry: false, gcTime: 0 });
  const [destination, setDestination] = useState<PayoutInput>();
  const [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false);
  const reveal = useMutation({ mutationFn: async () => { const result = await privateApi<{ destination: PayoutInput }>(`/refunds/${encodeURIComponent(caseId)}/reveal`, "POST", { approvalId }); setDestination(result.destination); }, gcTime: 0 });
  const paid = useMutation({ mutationFn: () => privateApi(`/refunds/${encodeURIComponent(caseId)}/paid`, "POST", { approvalId, transactionReference: reference, confirmed }), onSuccess: () => { setDestination(undefined); setReference(""); void refund.refetch(); } });
  useEffect(() => { if (!destination) return; const timeout = setTimeout(() => setDestination(undefined), 60000); const hide = () => { if (document.hidden) setDestination(undefined); }; document.addEventListener("visibilitychange", hide); return () => { clearTimeout(timeout); document.removeEventListener("visibilitychange", hide); }; }, [destination]);
  if (refund.isPending) return <p>{t("common.loading")}</p>;
  if (refund.isError) return <Alert tone="error">{t(refund.error.message === "refund_not_found" ? "refund.noDestination" : "payout.unavailable")}</Alert>;
  if (refund.data?.paid || paid.isSuccess) return <p role="status">{t("refund.recorded")}</p>;
  return <form className="profile-edit" onSubmit={event => { event.preventDefault(); paid.mutate(); }}>
    <p>{t("refund.manual")}</p><p>{refund.data?.method} - **** {refund.data?.last4}</p>
    {destination ? <><dl className="profile-data">{Object.entries(destination).map(([key, value]) => <div key={key}><dt>{t(tx(`payout.${key}`))}</dt><dd>{value}</dd></div>)}</dl><ActionButton variant="icon" title={t("refund.hide")} icon={<X size={18} />} onClick={() => setDestination(undefined)} /></> : <ActionButton variant="secondary" icon={<Eye size={16} />} onClick={() => reveal.mutate()} disabled={reveal.isPending}>{t("refund.reveal")}</ActionButton>}
    <label className="form-field"><span>{t("refund.transaction")}</span><input value={reference} onChange={event => setReference(event.target.value)} minLength={4} maxLength={80} required autoComplete="off" disabled={paid.isPending} /></label>
    <label className="refund-checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={paid.isPending} />{t("refund.confirmPaid")}</label>
    {paid.isError || reveal.isError ? <Alert tone="error">{t("refund.failed")}</Alert> : null}
    <ActionButton type="submit" icon={<Banknote size={16} />} disabled={!confirmed || reference.trim().length < 4 || paid.isPending}>{t("refund.record")}</ActionButton>
  </form>;
}
