/**
 * Display formatter for 5-digit IDs (Farmer ID, Voter Number, Savings A/C No).
 *
 * Any digit-only value (e.g. "0000003", "00000000002", "3") is normalized
 * to a zero-padded 5-digit string ("00003"). Non-digit / empty values pass
 * through unchanged so legacy data is still visible.
 */
export function formatId5(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  // Extract digits only.
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  const stripped = digits.replace(/^0+/, "") || "0";
  return stripped.padStart(5, "0");
}
