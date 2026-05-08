/**
 * Whitelist of writable columns on the `farmers` table.
 * Joined relations (offices, villages, divisions, districts, upazilas,
 * unions, wards, mouzas) are intentionally excluded so they never leak
 * into an update payload and trigger a Postgres "schema cache" error.
 *
 * NOTE: `voter_number` IS included — the DB immutability trigger
 * preserves an existing value while still allowing the first assignment.
 */
export const FARMER_WRITABLE_COLUMNS = [
  "name_en", "name_bn", "father_name", "mother_name",
  "nid", "mobile", "post_office", "address",
  "voter_number", "is_voter",
  "office_id", "status", "photo_url",
  "division_id", "district_id", "upazila_id",
  "union_id", "ward_id", "village_id", "mouza_id",
  "village", "upazila", "district", "division", // legacy text fields
  "account_number", "member_no",
] as const;

export type FarmerWritableColumn = typeof FARMER_WRITABLE_COLUMNS[number];

/**
 * Build a schema-safe payload for `farmers` updates by whitelisting
 * only writable columns. Empty `voter_number` is dropped so we don't
 * try to clear an existing value (immutability trigger would reject it).
 */
export function toFarmerUpdatePayload(
  input: Record<string, any>,
  extras: Partial<Record<FarmerWritableColumn, any>> = {}
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of FARMER_WRITABLE_COLUMNS) {
    if (key in input && input[key] !== undefined) out[key] = input[key];
  }
  Object.assign(out, extras);
  if (out.voter_number === "" || out.voter_number == null) delete out.voter_number;
  if (out.office_id === "") out.office_id = null;
  // Voter = Savings: voter_number থাকলেই active সদস্য (auto-derive)
  if ("voter_number" in out && out.voter_number) {
    out.is_voter = true;
    if (!out.account_number) out.account_number = out.voter_number;
  }
  return out;
}
