// Best-effort input screening, not a complete DLP system. The same policy
// must be enforced at the gateway before production clinical-data claims.

export type FirewallResult =
  | { ok: true }
  | { ok: false; code: "CLINICAL_CONTENT_DETECTED"; message: string; matches: string[] };

// Each entry: a category label shown to the user, and a regex that
// matches clinical content. Keep patterns case-insensitive where useful.
const CLINICAL_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "clinical condition", regex: /\b(?:has|have|with|suffers from|positive for)\s+(?:diabetes|cancer|hypertension|hepatitis|hiv|tuberculosis)\b/i },
  { label: "Bangla clinical information", regex: /রোগনির্ণয়|রোগ নির্ণয়|ডায়াবেটিস|ক্যান্সার|উচ্চ রক্তচাপ|ইনসুলিন|মেটফরমিন|প্রেসক্রিপশন/u },
  { label: "result value", regex: /(?:hba1c|glucose|creatinine|হিমোগ্লোবিন|শর্করা|ক্রিয়েটিনিন)\s*(?:result|level|is|was|ফল|মাত্রা|হলো|হল|[:=])*\s*[\d০-৯]/iu },
  { label: "diagnosis keyword", regex: /\b(diagnos(?:ed|is)|prognosis|pathology)\b/i },
  { label: "lab value", regex: /\b(?:creatinine|hemoglobin|haemoglobin|hba1c|potassium|sodium|glucose|tsh|crp|esr|wbc|rbc|platelet(?:s)?)\b\s*[:=]?\s*\d/i },
  { label: "lab unit suffix", regex: /\b\d+(?:\.\d+)?\s*(?:mg\/dl|mmol\/l|mmHg|mEq\/L|µg\/mL|ug\/mL|ng\/mL|U\/L|IU\/L)\b/i },
  { label: "medication keyword", regex: /\b(?:amoxicillin|metformin|paracetamol|acetaminophen|ibuprofen|atorvastatin|lisinopril|omeprazole|losartan|albuterol|salbutamol|ciprofloxacin|azithromycin|amoxicillin|insulin|aspirin)\b/i },
  { label: "dosage", regex: /\b\d+\s*mg\b|\b\d+\s*mcg\b/i },
  { label: "ICD-10 code", regex: /\b[A-TV-Z][0-9][0-9AB](?:\.[0-9A-Z]{1,4})?\b/ },
  { label: "SNOMED CT code", regex: /\b\d{6,18}\b/ }, // very loose; intentionally to catch any 6+ digit medical code
  { label: "LOINC code", regex: /\bLOINC[:\s-]*\d+/i },
  { label: "vital sign", regex: /\b(?:BP|blood pressure|heart rate|pulse|temperature|spo2|saturation)\b\s*[:=]?\s*\d/i },
  { label: "clinical imaging order", regex: /\b(?:MRI|CT scan|X-ray|xray|ultrasound|ECG|EKG|endoscopy|biopsy)\b.{0,30}\b(?:ordered|shows|showed|revealed|abnormal|lesion)\b/i }
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
