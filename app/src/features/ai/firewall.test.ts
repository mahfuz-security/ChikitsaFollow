import { describe, expect, it } from "vitest";
import { scanForClinical } from "./firewall";

// AC-5: Subject = "creatinine 1.4 mg/dL" must trip the firewall before submit.

describe("scanForClinical", () => {
  it("allows delayed test names but blocks English and Bangla result disclosures", () => {
    expect(scanForClinical("CBC and HbA1c reports were not delivered by the promised time.").ok).toBe(true);
    expect(scanForClinical("MRI report was delayed").ok).toBe(true);
    expect(scanForClinical("The patient has diabetes and the HbA1c result is 8.5.").ok).toBe(false);
    expect(scanForClinical("রোগীর ডায়াবেটিস আছে").ok).toBe(false);
    expect(scanForClinical("শর্করা ৮.৫").ok).toBe(false);
  });
  it("returns ok for plain service-experience text", () => {
    expect(scanForClinical("Long wait at the front desk and the receptionist was rude")).toEqual({ ok: true });
    expect(scanForClinical("The bill was higher than quoted")).toEqual({ ok: true });
    expect(scanForClinical(undefined)).toEqual({ ok: true });
    expect(scanForClinical("")).toEqual({ ok: true });
  });

  it("detects lab value with units (AC-5)", () => {
    const result = scanForClinical("creatinine 1.4 mg/dL");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CLINICAL_CONTENT_DETECTED");
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });

  it("detects diagnosis keywords", () => {
    expect(scanForClinical("Patient was diagnosed with hypertension").ok).toBe(false);
    expect(scanForClinical("Final prognosis unclear").ok).toBe(false);
  });

  it("detects medication + dosage", () => {
    expect(scanForClinical("Took metformin 500mg today").ok).toBe(false);
  });

  it("detects ICD-10 and SNOMED-ish codes", () => {
    expect(scanForClinical("ICD: E11.9 type 2 diabetes").ok).toBe(false);
    expect(scanForClinical("SNOMED code 123456789").ok).toBe(false);
  });

  it("detects imaging + vital signs", () => {
    expect(scanForClinical("MRI scan ordered").ok).toBe(false);
    expect(scanForClinical("BP 145/90 at triage").ok).toBe(false);
  });
});
