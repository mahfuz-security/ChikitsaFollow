import type { ReactNode } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePatientHospitals } from "../../features/profile/PatientHospitals";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import { privateApi } from "../../features/refunds/privateApi";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function HospitalSwitcher() {
  const query = usePatientHospitals(), client = useQueryClient(), me = useCurrentUser(), { t } = useT();
  const pendingWrites = useIsMutating();
  const change = useMutation({ mutationFn: (organizationId: string) => privateApi("/patient-hospitals/active", "POST", { organizationId }), onSuccess: async (_result, organizationId) => {
    await client.cancelQueries({ queryKey: ["tickets"] });
    client.removeQueries({ queryKey: ["tickets"] });
    client.setQueryData(["patient-hospitals", me.data?.data?.itemId], { ...query.data, activeOrganizationId: organizationId });
    await client.invalidateQueries({ queryKey: ["patient-hospitals"] });
  } });
  return <label className="hospital-switcher"><span className="sr-only">{t("hospitals.active")}</span><select aria-label={t("hospitals.active")} value={query.data?.activeOrganizationId ?? ""} disabled={query.isPending || query.isError || pendingWrites > 0} onChange={event => {
    if (window.confirm(t("hospitals.switchConfirm"))) change.mutate(event.target.value);
  }}><option value="">{t("auth.signup.orgPlaceholder")}</option>{query.data?.hospitals.filter(hospital => hospital.selected).map(hospital => <option key={hospital.itemId} value={hospital.itemId}>{hospital.name}</option>)}</select>{change.isError || query.isError ? <span role="alert">{t("hospitals.failed")}</span> : null}</label>;
}

export function PatientHospitalScope({ children }: { children: ReactNode }) {
  const query = usePatientHospitals();
  // Remount forms and open threads on a context change: drafts never move hospitals.
  return <div key={query.data?.activeOrganizationId ?? "none"}>{children}</div>;
}
