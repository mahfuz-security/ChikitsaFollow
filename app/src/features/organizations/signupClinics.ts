import { signupClinicCatalog } from "./signupClinicCatalog";

export function signupClinicsForProject(tenantId: string) {
  return tenantId === signupClinicCatalog.tenantId ? signupClinicCatalog.clinics : [];
}
