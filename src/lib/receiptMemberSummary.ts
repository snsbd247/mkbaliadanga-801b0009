// Pure helpers for the receipt "কৃষক এবং মালিক সভ্য সদস্য" (member savings no.)
// mapping. Kept side-effect free so they can be unit-tested and reused across
// the payment / irrigation receipt builders.

export type ReceiptFarmer = {
  account_number?: string | number | null;
  savings_inactive?: boolean | null;
} | null | undefined;

/** A farmer's usable savings account number, or null if not an active member. */
export function savingsNoOf(farmer: ReceiptFarmer): string | null {
  if (!farmer) return null;
  if (farmer.savings_inactive) return null;
  if (farmer.account_number == null || farmer.account_number === "") return null;
  return String(farmer.account_number);
}

/**
 * Member-summary shown on the receipt.
 * - Borga (sharecropped) land: "{cultivator savings no}/{owner savings no}"
 *   (cultivator = বর্গাদার first, then জমির মালিক), each falling back to "N/A".
 * - Own land: just the cultivator's savings no (or "N/A").
 */
export function buildMemberSummary(args: {
  cultivator: ReceiptFarmer;
  owner: ReceiptFarmer;
  isBorga: boolean;
}): string {
  const cultivatorNo = savingsNoOf(args.cultivator) ?? "N/A";
  if (!args.isBorga) return cultivatorNo;
  const ownerNo = savingsNoOf(args.owner) ?? "N/A";
  return `${cultivatorNo}/${ownerNo}`;
}
