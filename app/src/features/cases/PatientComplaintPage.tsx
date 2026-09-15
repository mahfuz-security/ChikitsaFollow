import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { COMPLAINT_CATEGORIES, submitPatientComplaint } from "./patientComplaints";
import { usePayout } from "../refunds/PayoutProfile";
import { PatientHospitals, usePatientHospitals } from "../profile/PatientHospitals";

export function PatientComplaintPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useT();
  const branches = usePatientHospitals();
  const hospitals = branches.data?.hospitals.filter(hospital => hospital.selected) ?? [];
  const submit = useMutation({ mutationFn: submitPatientComplaint, retry: false });
  const busy = useRef(false);
  const [category, setCategory] = useState("other");
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [refundRequested, setRefundRequested] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const payout = usePayout(undefined, refundRequested);
  const selectedBranch = branches.data?.activeOrganizationId || branches.data?.primaryOrganizationId || (hospitals.length === 1 ? hospitals[0]!.itemId : "");
  const destination = hospitals.find(hospital => hospital.itemId === selectedBranch);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || reference) return;
    busy.current = true;
    try { setReference(await submit.mutateAsync({ branchId: selectedBranch, category, subject, refundRequested: category === "billing" && refundRequested, requestId })); }
    catch { /* Mutation state provides the localized error below. */ }
    finally { busy.current = false; }
  }
  return <section className="case-entry patient-complaint">
    <PageHeader title={t("complaint.title")} subtitle={t("complaint.subtitle")} actions={<ActionButton variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => onNavigate("/")}>{t("common.back")}</ActionButton>} />
    {branches.isSuccess && !hospitals.length ? <PatientHospitals /> : null}
    {reference ? <div className="complaint-confirmation" role="status"><CheckCircle2 size={36} /><h2>{t("complaint.success")}</h2><p>{t("complaint.receipt")}</p><strong className="complaint-reference">{reference}</strong><ActionButton onClick={() => onNavigate("/")}>{t("nav.home")}</ActionButton></div> : <form className="case-form" onSubmit={send}>
      {branches.isError ? <Alert tone="error">{t("complaint.branchesFailed")} <ActionButton variant="ghost" onClick={() => void branches.refetch()}>{t("common.retry")}</ActionButton></Alert> : null}
      {destination && !destination.branchId ? <Alert tone="error">{t("hospitals.notReady")}</Alert> : null}
      <p><strong>{t("auth.signup.org")}: {destination?.name ?? t("auth.signup.orgPlaceholder")}</strong></p>
      {destination ? <p>{t("hospitals.patientId")}: {destination.patientIdLast4 ? `****${destination.patientIdLast4}` : t("hospitals.idRequired")}</p> : null}
      <ActionButton variant="ghost" onClick={() => onNavigate("/profile")}>{t("hospitals.manage")}</ActionButton>
      <label className="form-field"><span>{t("cases.new.category")}</span><select value={category} onChange={event => setCategory(event.target.value)} disabled={submit.isPending}>{COMPLAINT_CATEGORIES.map(value => <option key={value} value={value}>{t(tx(`cases.category.${value}`))}</option>)}</select></label>
      <label className="form-field"><span>{t("cases.new.subject")}</span><textarea required rows={4} maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} disabled={submit.isPending} aria-label={t("cases.new.subject")} aria-describedby="complaint-privacy" /><small id="complaint-privacy">{t("cases.new.subjectHint")}</small></label>
      {category === "billing" ? <section className="refund-selection"><label className="refund-checkbox"><input type="checkbox" checked={refundRequested} onChange={event => setRefundRequested(event.target.checked)} disabled={submit.isPending} />{t("refund.request")}</label>{refundRequested ? <><p>{t("refund.consent")}</p>{payout.isPending ? <p>{t("common.loading")}</p> : payout.isError ? <Alert tone="error">{t("payout.unavailable")}</Alert> : payout.data?.payout ? <p>{t(tx(`payout.${payout.data.payout.method}`))} - **** {payout.data.payout.last4}</p> : <a href="/profile" target="_blank" rel="noopener noreferrer">{t("refund.addDestination")}</a>}<ActionButton variant="ghost" onClick={() => void payout.refetch()}>{t("common.refresh")}</ActionButton></> : null}</section> : null}
      {submit.isError ? <Alert tone="error">{submit.error.message === "clinical_content" ? t("complaint.clinical") : refundRequested ? t("refund.needsReview") : t("complaint.failed")}</Alert> : null}
      <div className="form-actions"><ActionButton type="submit" icon={<Send size={18} />} disabled={submit.isPending || !destination?.branchId || !destination.patientIdLast4 || !subject.trim() || branches.isError || (category === "billing" && refundRequested && !payout.data?.payout)}>{t(submit.isPending ? "cases.new.submitting" : "complaint.submit")}</ActionButton></div>
    </form>}
  </section>;
}
