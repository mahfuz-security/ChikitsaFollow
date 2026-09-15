import { ArrowUpRight, CheckCheck, ClipboardList, HeartHandshake, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import { useCurrentUser, userDisplayName } from "./useCurrentUser";
import { ActionButton } from "../../shared/ui/ActionButton";
import { rolesForUser } from "./useHasRole";
import { PatientTickets } from "../cases/TicketThread";
import { PatientHospitalOnboarding } from "./PatientHospitals";

export function PatientHomePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const me = useCurrentUser();
  const { t } = useT();
  const patient = rolesForUser(me.data?.data).includes("patient");
  return <section className="patient-home">
    <header className="patient-heading">
      <span className="patient-symbol"><HeartHandshake size={30} /></span>
      <p className="muted">{t("patient.welcome", undefined, { name: me.data?.data?.firstName || userDisplayName(me.data?.data) || t("profile.member") })}</p>
      <h1>{t("patient.title")}</h1><p>{t("patient.subtitle")}</p>
    </header>
    {patient ? <><PatientHospitalOnboarding /><PatientTickets /></> : null}
    <div className="patient-actions">
      <article className="patient-action"><span className="depth-icon"><MessageCircle size={24} /></span><h2>{t("patient.concern")}</h2><p>{t(patient ? "complaint.intro" : "patient.concernText")}</p><ActionButton onClick={() => patient ? onNavigate("/complaints") : window.dispatchEvent(new Event("chikitsa:help"))} icon={<MessageCircle size={18} />}>{t(patient ? "complaint.title" : "patient.help")}</ActionButton></article>
      <article className="patient-action"><span className="depth-icon depth-blue"><UserRound size={24} /></span><h2>{t("patient.account")}</h2><p>{t("patient.accountText")}</p><ActionButton variant="secondary" onClick={() => onNavigate("/profile")} icon={<ArrowUpRight size={18} />}>{t("patient.profile")}</ActionButton></article>
    </div>
    <section className="patient-journey"><h2>{t("patient.steps")}</h2><ol>{[ClipboardList, HeartHandshake, CheckCheck].map((Icon, index) => <li key={index}><Icon size={22} /><div><h3>{t(tx(`patient.step${index + 1}`))}</h3><p>{t(tx(`patient.step${index + 1}Text`))}</p></div></li>)}</ol></section>
    <section className="patient-privacy"><ShieldCheck size={24} /><div><h2>{t("patient.privacy")}</h2><p>{t("patient.privacyText")}</p></div></section>
  </section>;
}
