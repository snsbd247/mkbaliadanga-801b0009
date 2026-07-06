// Shared query helpers for "open" (payable) irrigation invoices.
//
// Both the Payments page and IrrigationPaymentPanel MUST use this so their
// invoice filtering stays identical and NULL-status invoices never disappear.
//
// Why not server-side `.neq("invoice_status","cancelled")` or
// `.is("deleted_at", null)`?
//   PostgREST `.neq` on a column also drops rows where the value is NULL, which
//   silently hides valid unpaid invoices whose status was never set. Instead we
//   filter cancelled/deleted in JS via `isActiveInvoice` (keeps NULL = active).
//   The published Laravel/MySQL adapter also does not support the PostgREST
//   `is` operator and returns `Unknown column 'is'`; deleted filtering is kept
//   here in the shared client-side guard so both payment surfaces keep working.

import { db } from "@/lib/db";
import { isActiveInvoice, type DueInvoiceRow } from "@/lib/dues";

function splitTopLevelSelect(select: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let paren = 0;
  for (const ch of select) {
    if (ch === "(") paren += 1;
    if (ch === ")") paren -= 1;
    if (ch === "," && paren === 0) {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const t = buf.trim();
  if (t) parts.push(t);
  return parts;
}

function ensureSelectColumns(select: string, columns: string[]): string {
  if (!select || select.trim() === "*") return select || "*";
  const parts = splitTopLevelSelect(select);
  const present = new Set(
    parts
      .filter((p) => !p.includes("("))
      .map((p) => p.split(":").pop()!.split("!")[0].trim()),
  );
  const missing = columns.filter((c) => !present.has(c));
  return missing.length ? `${select},${missing.join(",")}` : select;
}

/**
 * Fetch open (due_amount > 0, not deleted, not cancelled) irrigation invoices
 * for a farmer, ordered by due_date. Pass the exact `select` string each caller
 * needs; the filtering/ordering is shared and consistent.
 */
export async function fetchOpenIrrigationInvoices<T extends DueInvoiceRow = any>(
  farmerId: string,
  select: string,
): Promise<T[]> {
  const selectWithGuardColumns = ensureSelectColumns(select, ["deleted_at"]);
  const { data, error } = await db
    .from("irrigation_invoices")
    .select(selectWithGuardColumns)
    .eq("farmer_id", farmerId)
    .gt("due_amount", 0)
    .order("due_date", { ascending: true });
  if (error) console.warn("fetchOpenIrrigationInvoices error:", error);
  // Drop cancelled in JS so NULL/empty invoice_status rows are kept.
  return ((data as any[]) ?? []).filter((r) => isActiveInvoice(r)) as T[];
}
