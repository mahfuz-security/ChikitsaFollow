// FR-19: server-side firewall scan blocks clinical content. The cloud
// platform doesn't ship a built-in equivalent in this tenant, so this
// module is the client mirror of the same check — every write path that
// could carry a patient's medical context runs through scanForClinical()
// before submit. The regex set is deliberately conservative: false
// positives are acceptable (the front-desk rewords); false negatives are
// not (DC-1, FR-19, FR-22).

export type FirewallResult =
  | { ok: true }
  | { ok: false; code: "CLINICAL_CONTENT_DETECTED"; message: string; matches: string[] };

// Each entry: a category label shown to the user, and a regex that
// matches clinical content. Keep patterns case-insensitive where useful.
const CLINICAL_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "diagnosis keyword", regex: /\b(diagnos(?:ed|is)|prognosis|pathology)\b/i },
  { label: "lab value", regex: /\b(?:creatinine|hemoglobin|haemoglobin|hba1c|potassium|sodium|glucose|tsh|crp|esr|wbc|rbc|platelet(?:s)?)\b\s*[:=]?\s*\d/i },
  { label: "lab unit suffix", regex: /\b\d+(?:\.\d+)?\s*(?:mg\/dl|mmol\/l|mmHg|mEq\/L|µg\/mL|ug\/mL|ng\/mL|U\/L|IU\/L)\b/i },
  { label: "medication keyword", regex: /\b(?:amoxicillin|metformin|paracetamol|acetaminophen|ibuprofen|atorvastatin|lisinopril|omeprazole|losartan|albuterol|salbutamol|ciprofloxacin|azithromycin|amoxicillin|insulin|aspirin)\b/i },
  { label: "dosage", regex: /\b\d+\s*mg\b|\b\d+\s*mcg\b/i },
  { label: "ICD-10 code", regex: /\b[A-TV-Z][0-9][0-9AB](?:\.[0-9A-Z]{1,4})?\b/ },
  { label: "SNOMED CT code", regex: /\b\d{6,18}\b/ }, // very loose; intentionally to catch any 6+ digit medical code
  { label: "LOINC code", regex: /\bLOINC[:\s-]*\d+/i },
  { label: "vital sign", regex: /\b(?:BP|blood pressure|heart rate|pulse|temperature|spo2|saturation)\b\s*[:=]?\s*\d/i },
  { label: "imaging / test", regex: /\b(?:MRI|CT scan|X-ray|xray|ultrasound|ECG|EKG|endoscopy|biopsy)\b/i }
];

export function scanForClinical(text: string | undefined | null): FirewallResult {
  if (!text) return { ok: true };
  const matches: string[] = [];
  for (const { label, regex } of CLINICAL_PATTERNS) {
    const hit = text.match(regex);
    if (hit) matches.push(`${label} ('${hit[0]}')`);
  }
  if (matches.length === 0) return { ok: true };
  return {
    ok: false,
    code: "CLINICAL_CONTENT_DETECTED",
    message: "Clinical content detected — please describe the service experience only (wait time, billing, communication, facility, staff behavior).",
    matches
  };
}
