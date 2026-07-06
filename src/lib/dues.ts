// Shared, canonical irrigation-due computation.
//
// IMPORTANT: Both the Farmer List and FarmerDetail MUST use this helper so the
// irrigation due value is always identical between the two views.
//
// Rules (matching the payment/collection logic):
//  - Only `irrigation_invoices` is a valid source. The legacy `irrigation_charges`
//    table is deprecated and must never be summed for dues.
//  - Rows with `deleted_at` set are excluded (soft-deleted).
//  - Rows with `invoice_status === "cancelled"` are excluded.
//    NOTE: a NULL/empty invoice_status is treated as ACTIVE (not cancelled),
//    so we must filter in JS — a PostgREST `.neq("invoice_status","cancelled")`
//    silently drops NULL-status rows and hides valid dues.
//  - Negative due_amount is clamped to 0.

export interface DueInvoiceRow {
  farmer_id?: string | null;
  due_amount?: number | string | null;
  invoice_status?: string | null;
  deleted_at?: string | null;
}

export function isActiveInvoice(row: DueInvoiceRow): boolean {
  if (row.deleted_at) return false;
  if (row.invoice_status === "cancelled") return false;
  return true;
}

/** Sum irrigation due across a set of invoice rows (any farmer). */
export function computeIrrigationDue(rows: DueInvoiceRow[] | null | undefined): number {
  return (rows ?? []).reduce((sum, r) => {
    if (!isActiveInvoice(r)) return sum;
    return sum + Math.max(0, Number(r.due_amount || 0));
  }, 0);
}

/** Sum irrigation due per farmer_id. */
export function computeIrrigationDueByFarmer(
  rows: DueInvoiceRow[] | null | undefined,
): Record<string, number> {
  const map: Record<string, number> = {};
  (rows ?? []).forEach((r) => {
    if (!r.farmer_id || !isActiveInvoice(r)) return;
    map[r.farmer_id] = (map[r.farmer_id] || 0) + Math.max(0, Number(r.due_amount || 0));
  });
  return map;
}

// ---------------------------------------------------------------------------
// Legacy-source guard.
//
// Any due calculation (client query or RPC/SQL) must read from
// `irrigation_invoices`, never the deprecated `irrigation_charges`. This guard
// lets callers assert a query/source string does not reference legacy tables and
// logs an error if it does, so regressions surface loudly in dev/logs.
// ---------------------------------------------------------------------------

export const DEPRECATED_DUE_SOURCES = ["irrigation_charges"] as const;

export function assertNoLegacyDueSource(source: string, context = "due calculation"): boolean {
  const hit = DEPRECATED_DUE_SOURCES.find((t) =>
    new RegExp(`\\b${t}\\b`).test(source),
  );
  if (hit) {
    console.error(
      `[dues] Deprecated due source "${hit}" detected in ${context}. ` +
        `Due calculations must use "irrigation_invoices" only.`,
    );
    return false;
  }
  return true;
}
