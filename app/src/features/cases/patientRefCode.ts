// DC-2: Case.PatientRefCode is generated, non-reversible, and distinct from
// any clinical MRN. Format: "CF-" + 8 base32 (Crockford-ish, no I/L/O/U
// to avoid OCR ambiguity) chars. We never accept a user-provided MRN or
// store one. This module is the only place the format is defined; the
// compliance report verifies that consumers import from here.

const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford (no I,L,O,U)

function randomBase32(length: number): string {
  let out = "";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += BASE32_ALPHABET[buf[i]! % BASE32_ALPHABET.length];
  } else {
    for (let i = 0; i < length; i++) out += BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)];
  }
  return out;
}

export function generatePatientRefCode(): string {
  return `CF-${randomBase32(8)}`;
}

export function isPatientRefCode(value: string | undefined): boolean {
  if (!value) return false;
  return /^CF-[0-9A-HJ-NP-TV-Z]{8}$/.test(value);
}
