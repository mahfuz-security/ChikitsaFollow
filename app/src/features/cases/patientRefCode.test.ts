import { describe, expect, it } from "vitest";
import { generatePatientRefCode, isPatientRefCode } from "./patientRefCode";

// DC-2: PatientRefCode is generated, non-reversible, masked.

describe("generatePatientRefCode (DC-2)", () => {
  it("starts with CF- and is followed by 8 chars from the base32 alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePatientRefCode();
      expect(code).toMatch(/^CF-[0-9A-HJ-NP-TV-Z]{8}$/);
      expect(isPatientRefCode(code)).toBe(true);
    }
  });

  it("generates unique codes across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generatePatientRefCode());
    expect(set.size).toBe(100);
  });

  it("never includes the ambiguous chars I, L, O, U", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePatientRefCode();
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
});

describe("isPatientRefCode", () => {
  it("rejects empty / wrong-prefix / wrong-length codes", () => {
    expect(isPatientRefCode("")).toBe(false);
    expect(isPatientRefCode(undefined)).toBe(false);
    expect(isPatientRefCode("CF-123")).toBe(false);
    expect(isPatientRefCode("XX-12345678")).toBe(false);
    expect(isPatientRefCode("CF-ILOU1234")).toBe(false); // ambiguous chars not allowed
  });
});
