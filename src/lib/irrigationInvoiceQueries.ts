// Shared query helpers for "open" (payable) irrigation invoices.
//
// Both the Payments page and IrrigationPaymentPanel MUST use this so their
// invoice filtering stays identical and NULL-status invoices never disappear.
//
// Why not a server-side `.neq("invoice_status","cancelled")`?
//   PostgREST `.neq` on a column also drops rows where the value is NULL, which
//   silently hides valid unpaid invoices whose status was never set. Instead we
//   filter cancelled/deleted in JS via `isActiveInvoice` (keeps NULL = active).

import { db } from "@/lib/db";
import { isActiveInvoice, type DueInvoiceRow } from "@/lib/dues";

/**
 * Fetch open (due_amount > 0, not deleted, not cancelled) irrigation invoices
 * for a farmer, ordered by due_date. Pass the exact `select` string each caller
 * needs; the filtering/ordering is shared and consistent.
 */
export async function fetchOpenIrrigationInvoices<T extends DueInvoiceRow = any>(
  farmerId: string,
  select: string,
): Promise<T[]> {
  const { data, error } = await db
    .from("irrigation_invoices")
    .select(select)
    .eq("farmer_id", farmerId)
    .is("deleted_at", null)
    .gt("due_amount", 0)
    .order("due_date", { ascending: true });
  if (error) console.warn("fetchOpenIrrigationInvoices error:", error);
  // Drop cancelled in JS so NULL/empty invoice_status rows are kept.
  return ((data as any[]) ?? []).filter((r) => isActiveInvoice(r)) as T[];
}
