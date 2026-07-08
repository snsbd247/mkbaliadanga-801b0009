// Pure helpers for the receipt "কৃষক এবং মালিক সভ্য সদস্য" (member savings no.)
// mapping. Kept side-effect free so they can be unit-tested and reused across
// the payment / irrigation receipt builders.

export type ReceiptFarmer = {
  account_number?: string | number | null;
  savings_inactive?: boolean | null;
  is_voter?: boolean | null;
} | null | undefined;

// Shown when a farmer has no active savings account (not a voter / no A/C).
export const NO_SAVINGS_LABEL = "নাই";

/** A farmer's usable savings account number, or null if not an active member. */
export function savingsNoOf(farmer: ReceiptFarmer): string | null {
  if (!farmer) return null;
  // Savings A/C exists only for voter members; non-voters have no savings no.
  if (farmer.is_voter === false) return null;
  if (farmer.savings_inactive) return null;
  if (farmer.account_number == null || farmer.account_number === "") return null;
  return String(farmer.account_number);
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
