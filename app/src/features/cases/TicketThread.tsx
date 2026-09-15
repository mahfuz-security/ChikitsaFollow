import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Reply, Send } from "lucide-react";
import { privateApi } from "../refunds/privateApi";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { useCurrentUser } from "../profile/useCurrentUser";
import { usePatientHospitals } from "../profile/PatientHospitals";
import { rolesForUser } from "../../lib/roles";
type Ticket = { id: string; reference: string; subject: string; status: string; category: string; severity: string; promisedAt: string | null; updatedAt: string | null };
type Message = { id: string; side: string; kind: string; text: string; replyTo?: string; createdAt: string };
type Thread = { ticket: Ticket; hospitalPatientId?: string | null; messages: Message[]; canReply: boolean };

export function PatientTickets() {
  const { t } = useT(), me = useCurrentUser();
  const [selected, setSelected] = useState<string>();
  const hospitals = usePatientHospitals();
  const org = hospitals.data?.activeOrganizationId;
  const tickets = useQuery({ queryKey: ["tickets", "mine", me.data?.data?.itemId, org], queryFn: () => privateApi<{ tickets: Ticket[] }>(`/tickets?organizationId=${encodeURIComponent(org!)}`), enabled: Boolean(org), retry: false, refetchInterval: 30000 });
  useEffect(() => setSelected(undefined), [org]);
  if (!org) return null;
  return <section className="patient-tickets"><h2>{t("tickets.mine")}</h2>
    {selected ? <><ActionButton variant="ghost" onClick={() => setSelected(undefined)} icon={<ArrowLeft size={18} />}>{t("common.back")}</ActionButton><TicketThread key={selected} caseId={selected} /></> : <>
      {tickets.isPending ? <p>{t("common.loading")}</p> : tickets.isError ? <Alert tone="error">{t("tickets.unavailable")} <button onClick={() => void tickets.refetch()}>{t("common.retry")}</button></Alert> : !tickets.data?.tickets.length ? <p>{t("tickets.empty")}</p> : <div className="patient-ticket-list">{tickets.data.tickets.map(ticket => <article className="patient-ticket" key={ticket.id}>
        <span className="mono">{ticket.reference}</span><h3>{ticket.subject}</h3><p>{t(tx(`cases.status.${ticket.status}`))}</p><ActionButton variant="secondary" icon={<MessageSquare size={16} />} onClick={() => setSelected(ticket.id)}>{t("tickets.open")}</ActionButton>
      </article>)}</div>}
    </>}
  </section>;
}

export function TicketThread({ caseId }: { caseId: string }) {
  const { t, language } = useT(), queries = useQueryClient(), me = useCurrentUser();
  const hospitals = usePatientHospitals();
  const patient = rolesForUser(me.data?.data).includes("patient");
  const org = patient ? hospitals.data?.activeOrganizationId : undefined;
  const scope = patient ? `?organizationId=${encodeURIComponent(org ?? "")}` : "";
  const query = useQuery({ queryKey: ["tickets", caseId, me.data?.data?.itemId, org], queryFn: () => privateApi<Thread>(`/tickets/${encodeURIComponent(caseId)}${scope}`), enabled: !patient || Boolean(org), retry: false, refetchInterval: 15000 });
  const [text, setText] = useState(""), [kind, setKind] = useState("comment"), [replyTo, setReplyTo] = useState<string>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({ mutationFn: () => privateApi(`/tickets/${encodeURIComponent(caseId)}/messages${scope}`, "POST", { requestId, text, kind, ...(replyTo ? { replyTo } : {}) }), retry: false,
    onSuccess: async () => { setText(""); setReplyTo(undefined); setRequestId(crypto.randomUUID()); await queries.invalidateQueries({ queryKey: ["tickets"] }); } });
  useEffect(() => { setText(""); setReplyTo(undefined); setRequestId(crypto.randomUUID()); mutation.reset(); }, [caseId, org]);
  if (query.isPending) return <p>{t("common.loading")}</p>;
  if (query.isError) return <Alert tone="error">{t("tickets.unavailable")} <button onClick={() => void query.refetch()}>{t("common.retry")}</button></Alert>;
  const data = query.data!;
  return <section className="ticket-thread">
    {data.hospitalPatientId ? <p>{t("hospitals.patientId")}: <span className="mono">{data.hospitalPatientId}</span></p> : null}
    <header><h2>{t("tickets.conversation")}</h2><p><span className="mono">{data.ticket.reference}</span> · {t(tx(`cases.status.${data.ticket.status}`))}</p><h3>{data.ticket.subject}</h3>{data.ticket.promisedAt ? <p>{t("cases.followupDeadline")}: {new Date(data.ticket.promisedAt).toLocaleString(language)}</p> : null}</header>
    <div className="ticket-current">{["patient", "staff"].map(side => { const current = [...data.messages].reverse().find(message => message.side === side && message.kind === "problem_update"); return <div key={side}><h3>{t(side === "patient" ? "tickets.patientProblem" : "tickets.staffProblem")}</h3><p>{current?.text || t("tickets.noUpdate")}</p></div>; })}</div>
    <p className="muted">{t("tickets.sharedNotice")}</p>
    <ol className="ticket-messages" aria-label={t("tickets.conversation")}>{data.messages.map(message => <li key={message.id} className={`ticket-message ticket-${message.side}`}><header><strong>{t(message.side === "patient" ? "tickets.patient" : "tickets.staff")}</strong><span>{t(tx(`tickets.${message.kind}`))}</span><time>{new Date(message.createdAt).toLocaleString(language)}</time></header>{message.replyTo ? <blockquote>{data.messages.find(parent => parent.id === message.replyTo)?.text || t("tickets.reply")}</blockquote> : null}<p>{message.text}</p>{data.canReply ? <ActionButton variant="ghost" icon={<Reply size={16} />} onClick={() => { setReplyTo(message.id); setKind("reply"); }}>{t("tickets.reply")}</ActionButton> : null}</li>)}</ol>
    {!data.messages.length ? <p>{t("tickets.noMessages")}</p> : null}
    {data.canReply ? <form className="ticket-compose" onSubmit={event => { event.preventDefault(); if (text.trim() && !mutation.isPending) mutation.mutate(); }}>
      {replyTo ? <div className="row-actions"><span>{t("tickets.replying")}</span><ActionButton variant="ghost" onClick={() => setReplyTo(undefined)}>{t("common.cancel")}</ActionButton></div> : null}
      <label className="form-field"><span>{t("tickets.messageType")}</span><select value={kind} onChange={event => setKind(event.target.value)} disabled={mutation.isPending}>{["comment", "reply", "problem_update"].map(value => <option key={value} value={value}>{t(tx(`tickets.${value}`))}</option>)}</select></label>
      <label className="form-field"><span>{t("tickets.message")}</span><textarea rows={3} maxLength={1000} value={text} onChange={event => setText(event.target.value)} required disabled={mutation.isPending} /></label>
      {mutation.isError ? <Alert tone="error">{t(mutation.error.message === "unsafe_ticket_text" ? "complaint.clinical" : "tickets.sendFailed")}</Alert> : null}
      <ActionButton type="submit" icon={<Send size={18} />} disabled={!text.trim() || mutation.isPending}>{t("tickets.send")}</ActionButton>
    </form> : null}
  </section>;
}
