/**
 * Server-mirror validation for Barga (sharecropper) splits and allocations.
 *
 * Used by the Land form (frontend) AND mirrored by the DB trigger so a split
 * that does not reconcile to the parcel can never be saved:
 *   - The sum of explicit borga areas may not exceed the parcel area.
 *   - The sum of share percentages may not exceed 100%.
 *   - Each relation must be billable (area or percentage > 0).
 *
 * Returns bilingual (Bangla + English) error objects; empty = valid.
 */
import type { BargaRelation } from "./irrigationBargaSplit";

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export interface BargaValidationError {
  /** Bangla message (default UI language). */
  bn: string;
  /** English message. */
  en: string;
}

export interface BargaValidationInput {
  parcel_area: number;
  relations: BargaRelation[];
}

export function validateBargaSplit(input: BargaValidationInput): BargaValidationError[] {
  const errors: BargaValidationError[] = [];
  const total = num(input.parcel_area);
  if (total <= 0) {
    errors.push({
      bn: "জমির পরিমাণ অবশ্যই ০ এর বেশি হতে হবে।",
      en: "Parcel area must be greater than 0.",
    });
  }

  let areaSum = 0;
  let pctSum = 0;
  (input.relations ?? []).forEach((r, i) => {
    if (!r.sharecropper_farmer_id) return;
    const area = num(r.area_decimal);
    const pct = num(r.share_percentage);
    if (area <= 0 && pct <= 0) {
      errors.push({
        bn: `বর্গাদার #${i + 1}: ক্ষেত্রফল অথবা শতকরা হার দিতে হবে।`,
        en: `Sharecropper #${i + 1}: area or share percentage is required.`,
      });
    }
    areaSum += area;
    pctSum += pct;
  });

  if (areaSum - total > 0.0001) {
    errors.push({
      bn: `বর্গা ক্ষেত্রফলের যোগফল (${areaSum}) জমির পরিমাণ (${total}) এর বেশি হতে পারে না। অমিল: ${Math.round((areaSum - total) * 100) / 100}।`,
      en: `Total borga area (${areaSum}) cannot exceed parcel area (${total}). Mismatch: ${Math.round((areaSum - total) * 100) / 100}.`,
    });
  }
  if (pctSum - 100 > 0.0001) {
    errors.push({
      bn: `শতকরা হারের যোগফল (${pctSum}%) ১০০% এর বেশি হতে পারে না। অমিল: ${Math.round((pctSum - 100) * 100) / 100}%।`,
      en: `Total share percentage (${pctSum}%) cannot exceed 100%. Mismatch: ${Math.round((pctSum - 100) * 100) / 100}%.`,
    });
  }
  return errors;
}

export function isBargaSplitValid(input: BargaValidationInput): boolean {
  return validateBargaSplit(input).length === 0;
}

/** Convenience: flatten errors to messages for a given language. */
export function bargaErrorMessages(
  errors: BargaValidationError[],
  lang: "bn" | "en" = "bn",
): string[] {
  return errors.map((e) => e[lang]);
}
