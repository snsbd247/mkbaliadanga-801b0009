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

export function invoiceBilledArea(inv: any): number | undefined {
  const snap = parseSnapshot(inv?.calculation_snapshot);
  return positive(inv?.billed_area_shotok)
    ?? positive(snap?.backfill_new?.billed_area_shotok)
    ?? positive(snap?.new?.billed_area_shotok)
    ?? positive(snap?.billed_area_shotok)
    ?? positive(snap?.land_size_shotok)
    ?? positive(snap?.calc?.land_size_shotok)
    ?? positive(inv?.lands?.billed_area_shotok)
    ?? positive(inv?.land?.billed_area_shotok)
    ?? positive(inv?.lands?.land_size)
    ?? positive(inv?.land?.land_size);
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