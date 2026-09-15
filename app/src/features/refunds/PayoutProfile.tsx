import { Check, Landmark, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { privateApi } from "./privateApi";
import { payoutInput, type PayoutInput, type PayoutSummary } from "./payoutTypes";

export function usePayout(owner?: string, enabled = true) {
  return useQuery({ queryKey: ["private", "payout", owner], queryFn: () => privateApi<{ payout: PayoutSummary | null }>("/payout"), enabled, retry: false, gcTime: 0 });
}
export function PayoutProfile({ owner }: { owner: string }) {
  const { t } = useT(), queryClient = useQueryClient();
  const payout = usePayout(owner);
  const [editing, setEditing] = useState(false), [removing, setRemoving] = useState(false), [saved, setSaved] = useState(false);
  const [method, setMethod] = useState<PayoutInput["method"]>("bkash");
  const [fields, setFields] = useState({ accountName: "", accountNumber: "", bankName: "", branchName: "", routingNumber: "" });
  const [invalid, setInvalid] = useState(false);
  const mutate = useMutation({ gcTime: 0, mutationFn: ({ method: verb, body }: { method: string; body?: PayoutInput }) => privateApi("/payout", verb, body),
    onSuccess: async () => { setFields({ accountName: "", accountNumber: "", bankName: "", branchName: "", routingNumber: "" }); setEditing(false); setRemoving(false); setSaved(true); mutate.reset(); await queryClient.invalidateQueries({ queryKey: ["private", "payout"] }); } });
  function cancel() { setEditing(false); setFields({ accountName: "", accountNumber: "", bankName: "", branchName: "", routingNumber: "" }); setInvalid(false); mutate.reset(); }
  const summary = payout.data?.payout;
  return <section className="profile-section payout-section">
    <div className="profile-section-heading"><span className="depth-icon"><Landmark size={22} /></span><h2>{t("payout.title")}</h2></div>
    <p className="profile-note"><ShieldCheck size={16} /> {t("payout.privacy")}</p>
    {payout.isPending ? <p>{t("common.loading")}</p> : payout.isError ? <Alert tone="error">{t("payout.unavailable")} <button onClick={() => void payout.refetch()}>{t("common.retry")}</button></Alert> : <>
      {saved ? <p role="status">{t("payout.saved")}</p> : null}
      {!editing ? <><p>{summary ? `${t(tx(`payout.${summary.method}`))} - **** ${summary.last4}` : t("payout.empty")}</p><div className="row-actions"><ActionButton variant="secondary" icon={<Pencil size={16} />} onClick={() => { setEditing(true); setSaved(false); mutate.reset(); }}>{t(summary ? "payout.replace" : "payout.add")}</ActionButton>{summary ? <ActionButton variant="icon" title={t("payout.remove")} icon={<Trash2 size={18} />} onClick={() => setRemoving(true)} /> : null}</div></> : <form className="profile-edit" autoComplete="off" onSubmit={event => {
        event.preventDefault();
        const parsed = payoutInput.safeParse(method === "bank" ? { method, ...fields } : { method, accountName: fields.accountName, accountNumber: fields.accountNumber });
        setInvalid(!parsed.success); if (parsed.success) mutate.mutate({ method: "PUT", body: parsed.data });
      }}>
        <label className="form-field"><span>{t("payout.method")}</span><select value={method} onChange={event => { setMethod(event.target.value as PayoutInput["method"]); setFields(current => ({ ...current, accountNumber: "" })); }} disabled={mutate.isPending}>{(["bank", "bkash", "nagad"] as const).map(value => <option key={value} value={value}>{t(tx(`payout.${value}`))}</option>)}</select></label>
        {(["accountName", "accountNumber", ...(method === "bank" ? ["bankName", "branchName", "routingNumber"] as const : [])] as const).map(key => <label className="form-field" key={key}><span>{t(tx(`payout.${key}`))}</span><input type={key === "accountNumber" ? "password" : "text"} inputMode={key === "accountNumber" || key === "routingNumber" ? "numeric" : "text"} autoComplete="off" maxLength={key === "accountNumber" ? method === "bank" ? 34 : 11 : key === "routingNumber" ? 9 : 100} value={fields[key]} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} required disabled={mutate.isPending} /></label>)}
        {invalid ? <Alert tone="error">{t("payout.invalid")}</Alert> : null}
        <div className="row-actions"><ActionButton type="submit" disabled={mutate.isPending} icon={<Check size={16} />}>{t(mutate.isPending ? "common.saving" : "common.save")}</ActionButton><ActionButton variant="ghost" onClick={cancel} disabled={mutate.isPending}>{t("common.cancel")}</ActionButton></div>
      </form>}
      {removing ? <div className="payout-confirm"><p>{t("payout.removeConfirm")}</p><ActionButton onClick={() => mutate.mutate({ method: "DELETE" })} disabled={mutate.isPending}>{t("payout.remove")}</ActionButton><ActionButton variant="ghost" onClick={() => setRemoving(false)} disabled={mutate.isPending}>{t("common.cancel")}</ActionButton></div> : null}
      {mutate.isError ? <Alert tone="error">{t("payout.failed")}</Alert> : null}
    </>}
  </section>;
}
