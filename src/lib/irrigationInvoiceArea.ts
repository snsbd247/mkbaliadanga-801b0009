/**
 * Canonical invoice land-area resolver.
 *
 * For irrigation invoices, display and exports must use the area frozen on the
 * invoice (`billed_area_shotok`) before falling back to the current land row.
 * This is especially important for borga/sharecropper invoices where the
 * parcel may be 0.4000 but the billed share is only 0.2000.
 */

function parseSnapshot(snapshot: unknown): any {
  if (!snapshot) return {};
  if (typeof snapshot === "string") {
    try { return JSON.parse(snapshot); } catch { return {}; }
  }
  return snapshot;
}

function positive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function areaFromRoundedCharge(inv: any, snap: any): number | undefined {
  const amount = positive(inv?.irrigation_amount)
    ?? positive(snap?.calc?.irrigation_amount)
    ?? positive(snap?.irrigation_amount);
  const rate = positive(inv?.applied_rate)
    ?? positive(inv?.season_rate)
    ?? positive(inv?.rate_per_shotok)
    ?? positive(snap?.applied_rate)
    ?? positive(snap?.rate_per_shotok)
    ?? positive(snap?.calc?.rate_per_shotok);
  if (!amount || !rate) return undefined;

  const basis = String(
    inv?.calculation_basis
      ?? inv?.rate_type
      ?? snap?.basis
      ?? snap?.calculation_basis
      ?? snap?.rate_type
      ?? snap?.calc?.basis
      ?? "per_shotok",
  );
  if (basis === "flat") return undefined;

  const raw = basis === "per_bigha" ? (amount / rate) * 33 : amount / rate;
  if (!Number.isFinite(raw) || raw <= 0) return undefined;

  // Invoice amounts are rounded to whole taka, so reverse-calculation can be
  // 0.19989 for an exact 0.2000-shotok share. Snap tiny differences to 3dp.
  const rounded3 = Math.round(raw * 1000) / 1000;
  const rounded4 = Math.round(raw * 10000) / 10000;
  return Math.abs(raw - rounded3) <= 0.00035 ? rounded3 : rounded4;
}

  // If the invoice's own charge ÷ rate disagrees meaningfully with the stored
  // area (legacy rows where billed_area_shotok was backfilled from the wrong
  // parcel value), prefer the reverse-calculated area so the printed শতক always
  // matches the printed চার্জ. Same-value or missing charge-area → keep stored.
  if (chargeArea && stored) {
    const ratio = chargeArea / stored;
    if (ratio < 0.9 || ratio > 1.1) return chargeArea;
  }
  return stored ?? chargeArea;
}

export function invoiceParcelArea(inv: any): number | undefined {
  const snap = parseSnapshot(inv?.calculation_snapshot);
  return positive(inv?.parcel_area_shotok)
    ?? positive(snap?.parcel_size_shotok)
    ?? positive(snap?.parcel_area_shotok)
    ?? positive(inv?.lands?.land_size)
    ?? positive(inv?.land?.land_size);
}

export function isPartialBorgaInvoice(inv: any): boolean {
  const billed = invoiceBilledArea(inv);
  const parcel = invoiceParcelArea(inv);
  return !!inv?.is_borga && billed != null && parcel != null && Math.abs(parcel - billed) > 0.0001;
}