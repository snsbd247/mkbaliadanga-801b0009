/**
 * Pure, side-effect-free mirror of the `get_land_billing_split` DB function.
 *
 * Barga (sharecropper) rule:
 *  - Each active sharecropper is billed for their borga area (explicit area,
 *    or share_percentage of the parcel).
 *  - The owner is billed for whatever area remains.
 *  - The sum of all split areas always equals the parcel area (no double-billing,
 *    no missing area).
 *
 * This lets us unit-test the split + due consistency without a database.
 */

export interface BargaRelation {
  sharecropper_farmer_id: string;
  /** Explicit borga area in shotok. Takes priority over share_percentage. */
  area_decimal?: number | null;
  /** Percentage of the parcel given to this sharecropper (0-100). */
  share_percentage?: number | null;
}

export interface BargaSplitRow {
  billed_farmer_id: string;
  owner_farmer_id: string;
  is_borga: boolean;
  billed_area: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export function splitBillableArea(opts: {
  owner_farmer_id: string;
  parcel_area: number;
  relations: BargaRelation[];
}): BargaSplitRow[] {
  const owner = opts.owner_farmer_id;
  const total = num(opts.parcel_area);
  const rows: BargaSplitRow[] = [];
  let allocated = 0;

  for (const r of opts.relations ?? []) {
    if (!r.sharecropper_farmer_id) continue;
    const area = num(r.area_decimal ?? (total * num(r.share_percentage)) / 100);
    if (area <= 0) continue;
    allocated += area;
    rows.push({
      billed_farmer_id: r.sharecropper_farmer_id,
      owner_farmer_id: owner,
      is_borga: true,
      billed_area: area,
    });
  }

  const remaining = total - allocated;
  if (allocated === 0 || remaining > 0.0001) {
    rows.push({
      billed_farmer_id: owner,
      owner_farmer_id: owner,
      is_borga: false,
      billed_area: Math.max(remaining, 0),
    });
  }
  return rows;
}
