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

/** A farmer's usable savings account number, or null if not an active member. */
export function savingsNoOf(farmer: ReceiptFarmer): string | null {
  if (!farmer) return null;
  if (flagIsTrue(farmer.savings_inactive)) return null;
  // This receipt field must show the Savings Number only. Never fall back to
  // member_no/farmer_code/Farmer ID here; if no savings number exists, the
  // caller shows "নাই" for that side.
  const savingsNo = farmer.account_number ?? farmer.voter_number ?? null;
  if (savingsNo == null || savingsNo === "") return null;
  return String(savingsNo);
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
