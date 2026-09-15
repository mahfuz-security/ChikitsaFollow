import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hospital, Plus } from "lucide-react";
import { privateApi } from "../refunds/privateApi";
import { useCurrentUser } from "./useCurrentUser";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { ActionButton } from "../../shared/ui/ActionButton";
import { rolesForUser } from "../../lib/roles";

export type PatientHospital = { itemId: string; name: string; selected: boolean; branchId: string | null; patientIdLast4: string | null; patientIdVerified: boolean };
export type PatientHospitalsResponse = { hospitals: PatientHospital[]; primaryOrganizationId: string | null; activeOrganizationId: string | null };
export function usePatientHospitals() {
  const me = useCurrentUser();
  return useQuery({ queryKey: ["patient-hospitals", me.data?.data?.itemId], queryFn: () => privateApi<PatientHospitalsResponse>("/patient-hospitals"), enabled: Boolean(me.data?.data?.itemId) && rolesForUser(me.data?.data).includes("patient"), retry: false });
}
export function PatientHospitals() {
  const { t } = useT(), query = usePatientHospitals(), client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [patientId, setPatientId] = useState("");
  const add = useMutation({ mutationFn: () => privateApi("/patient-hospitals", "POST", { organizationId: selected, patientId }), onSuccess: async () => { setSelected(""); setPatientId(""); await client.invalidateQueries({ queryKey: ["patient-hospitals"] }); } });
  const available = query.data?.hospitals ?? [];
  return <section className="profile-section patient-hospitals"><div className="profile-section-heading"><Hospital size={22} /><h2>{t("hospitals.title")}</h2></div>
    {query.isPending ? <p>{t("common.loading")}</p> : query.isError ? <Alert tone="error">{t("hospitals.failed")} <button onClick={() => void query.refetch()}>{t("common.retry")}</button></Alert> : <>
      {!query.data?.hospitals.some(hospital => hospital.selected) ? <Alert tone="info">{t("hospitals.required")}</Alert> : <ul>{query.data.hospitals.filter(hospital => hospital.selected).map(hospital => <li key={hospital.itemId}>{hospital.name}{hospital.itemId === query.data.primaryOrganizationId ? ` (${t("hospitals.primary")})` : ""}<p>{t("hospitals.patientId")}: {hospital.patientIdLast4 ? `****${hospital.patientIdLast4}` : t("hospitals.idRequired")}</p></li>)}</ul>}
      {available.length ? <form onSubmit={event => { event.preventDefault(); if (selected && patientId.trim()) add.mutate(); }}><label className="form-field"><span>{t("hospitals.add")}</span><select required value={selected} onChange={event => { setSelected(event.target.value); setPatientId(""); }} disabled={add.isPending}><option value="">{t("auth.signup.orgPlaceholder")}</option>{available.map(hospital => <option key={hospital.itemId} value={hospital.itemId}>{hospital.name}</option>)}</select></label><label className="form-field"><span>{t("hospitals.patientId")}</span><input required minLength={2} maxLength={64} autoComplete="off" value={patientId} onChange={event => setPatientId(event.target.value)} disabled={add.isPending} /></label><p className="muted">{t("hospitals.idNotice")}</p><ActionButton type="submit" icon={<Plus size={18} />} disabled={!selected || !patientId.trim() || add.isPending}>{t("common.save")}</ActionButton></form> : null}
      {add.isError ? <Alert tone="error">{t("hospitals.failed")}</Alert> : null}
    </>}
  </section>;
}

export function PatientHospitalOnboarding() {
  const query = usePatientHospitals();
  return query.isSuccess && !query.data.hospitals.some(hospital => hospital.selected) ? <PatientHospitals /> : null;
}
