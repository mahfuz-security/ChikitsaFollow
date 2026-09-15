import { blocksClient } from "../../lib/blocks/client";
import { rolesForUser } from "../profile/useHasRole";
import { scanForClinical } from "../ai/firewall";
import { isReviewOnlyManager } from "../../lib/permissions";
import { privateApi } from "../refunds/privateApi";
import type { PatientHospitalsResponse } from "../profile/PatientHospitals";

export const COMPLAINT_CATEGORIES = ["report_delay", "instructions", "missed_follow_up", "wait_time", "billing", "staff_behavior", "facility", "communication", "other"] as const;
export type ComplaintBranch = { itemId: string; Name: string; branchId: string | null };

export async function complaintBranches(): Promise<ComplaintBranch[]> {
  const response = await privateApi<PatientHospitalsResponse>("/patient-hospitals");
  return response.hospitals.filter(hospital => hospital.selected)
    .map(hospital => ({ itemId: hospital.itemId, Name: hospital.name, branchId: hospital.branchId }));
}

export async function submitPatientComplaint(input: { organizationId: string; branchId?: string; category: string; subject: string; refundRequested?: boolean; requestId?: string }) {
  const profile = (await blocksClient.iam.me()).data;
  if (!profile?.itemId || !rolesForUser(profile).includes("patient") || isReviewOnlyManager(profile)) throw new Error("patient_required");
  const subject = input.subject.trim();
  if (!subject || subject.length > 120 || !COMPLAINT_CATEGORIES.some(category => category === input.category)) throw new Error("invalid_complaint");
  if (!scanForClinical(subject).ok) throw new Error("clinical_content");
  if (!input.requestId) throw new Error("invalid_complaint");
  const result = await privateApi<{ reference: string }>("/patient-complaints", "POST", {
    organizationId: input.organizationId, branchId: input.branchId, category: input.category, subject, requestId: input.requestId, refundRequested: Boolean(input.refundRequested)
  });
  return result.reference;
}
