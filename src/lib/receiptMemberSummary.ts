// Pure helpers for the receipt "কৃষক এবং মালিক সভ্য সদস্য" (member savings no.)
// mapping. Kept side-effect free so they can be unit-tested and reused across
// the payment / irrigation receipt builders.

export type ReceiptFarmer = {
  account_number?: string | number | null;
  voter_number?: string | number | null;
  savings_inactive?: boolean | number | string | null;
  is_voter?: boolean | number | string | null;
} | null | undefined;

// Shown when a farmer has no active savings account number.
export const NO_SAVINGS_LABEL = "নাই";

function flagIsTrue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "TRUE";
}

/** Normalise an id/number for comparison: trim and strip leading zeros. */
function normId(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const stripped = s.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

/** A farmer's usable savings account number, or null if not an active member. */
export function savingsNoOf(farmer: ReceiptFarmer): string | null {
  if (!farmer) return null;
  if (flagIsTrue(farmer.savings_inactive)) return null;
  // This receipt field must show the Savings Number only. Never fall back to
  // member_no/farmer_code/Farmer ID here; if no savings number exists, the
  // caller shows "নাই" for that side.
  const savingsNo = farmer.account_number ?? farmer.voter_number ?? null;
  if (savingsNo == null || savingsNo === "") return null;
  const value = String(savingsNo);
  // Validation guard: reject the Farmer ID (member_no/farmer_code) even if a
  // caller accidentally routed it into account_number/voter_number. Compared
  // numerically so "02933" (Farmer ID) also blocks "2933" (leading zero stripped).
  const anyFarmer = farmer as Record<string, unknown>;
  const farmerIdNorm = normId(anyFarmer.member_no) ?? normId(anyFarmer.farmer_code);
  if (farmerIdNorm != null && farmerIdNorm === normId(value)) return null;
  return value;
}

/**
 * Admin validation: true when the farmer's account_number/voter_number is really
 * just the Farmer ID (member_no/farmer_code) after stripping leading zeros —
 * i.e. a fake savings number that must not be trusted in receipts or reports.
 */
export function isFakeSavingsNumber(farmer: ReceiptFarmer): boolean {
  if (!farmer) return false;
  const anyFarmer = farmer as Record<string, unknown>;
  const raw = farmer.account_number ?? farmer.voter_number ?? null;
  if (raw == null || raw === "") return false;
  const farmerIdNorm = normId(anyFarmer.member_no) ?? normId(anyFarmer.farmer_code);
  return farmerIdNorm != null && farmerIdNorm === normId(String(raw));
}

/**
 * Member-summary shown on the receipt.
 * - Borga (sharecropped) land: "{cultivator savings no}/{owner savings no}"
 *   (cultivator = বর্গাদার first, then জমির মালিক), each falling back to "নাই".
 * - Own land: just the cultivator's savings no (or "নাই").
 */
export function buildMemberSummary(args: {
  cultivator: ReceiptFarmer;
  owner: ReceiptFarmer;
  isBorga: boolean;
}): string {
  const cultivatorNo = savingsNoOf(args.cultivator) ?? NO_SAVINGS_LABEL;
  if (!args.isBorga) return cultivatorNo;
  const ownerNo = savingsNoOf(args.owner) ?? NO_SAVINGS_LABEL;
  return `${cultivatorNo}/${ownerNo}`;
}
