/**
 * Validation for the Legacy Irrigation search box.
 * Legacy search accepts ONLY a numeric farmer code (original system behaviour).
 * Returns a stable error key, or null when the input is a valid farmer code.
 */
export type FarmerCodeError = "empty" | "non_digit" | "too_short" | "too_long";

export const FARMER_CODE_MIN = 3;
export const FARMER_CODE_MAX = 15;

export function validateFarmerCode(raw: string): FarmerCodeError | null {
  const q = raw.trim();
  if (!q) return "empty";
  if (!/^[0-9]+$/.test(q)) return "non_digit";
  if (q.length < FARMER_CODE_MIN) return "too_short";
  if (q.length > FARMER_CODE_MAX) return "too_long";
  return null;
}

/** Bilingual (English / Bangla) messages for each validation error. */
export const FARMER_CODE_MESSAGES: Record<FarmerCodeError, { en: string; bn: string }> = {
  empty: { en: "Please enter a farmer code", bn: "ফার্মার কোড লিখুন" },
  non_digit: { en: "Only digits are allowed (farmer code)", bn: "শুধু সংখ্যা লিখুন (ফার্মার কোড)" },
  too_short: { en: "Enter at least 3 digits", bn: "কমপক্ষে ৩ সংখ্যা লিখুন" },
  too_long: { en: "Too many digits", bn: "অনেক বেশি সংখ্যা" },
};
