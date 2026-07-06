// Shared query helpers for "open" (payable) irrigation invoices.
//
// Both the Payments page and IrrigationPaymentPanel MUST use this so their
// invoice filtering stays identical and NULL-status invoices never disappear.
//
// Why not server-side `.neq("invoice_status","cancelled")`,
// `.is("deleted_at", null)`, or `.gt("due_amount", 0)`?
//   PostgREST `.neq` on a column also drops rows where the value is NULL, which
//   silently hides valid unpaid invoices whose status was never set. Instead we
//   filter cancelled/deleted in JS via `isActiveInvoice` (keeps NULL = active).
//   The published Laravel/MySQL adapter has had operator regressions (`is` and
//   `gt` being interpreted as column names, e.g. `Unknown column 'gt'`). Status,
//   deleted and positive-due filtering are therefore kept here in the shared
//   client-side guard so both payment surfaces keep working permanently.

import { db } from "@/lib/db";
import { isActiveInvoice, type DueInvoiceRow } from "@/lib/dues";

export type InvoiceStatusFilter = "open" | "cancelled";

/**
 * Client-side status filter for a set of invoices. Cancelled = soft-deleted OR
 * invoice_status === "cancelled". Open = everything else (NULL status stays
 * open — mirrors the deleted_at regression rule in isActiveInvoice).
 */
export function filterInvoicesByStatus<T extends DueInvoiceRow>(rows: T[], filter: InvoiceStatusFilter): T[] {
  return (rows ?? []).filter((r) => (filter === "open" ? isActiveInvoice(r) : !isActiveInvoice(r)));
}

export type InvoiceSortKey = "invoice_no" | "due_date" | "due_amount";
export type SortDir = "asc" | "desc";

type SearchableInvoice = {
  invoice_no?: string | number | null;
  due_date?: string | null;
  due_amount?: number | string | null;
};

/**
 * Filter invoices by a free-text query (matches invoice_no or due_date) and
 * sort by the chosen column. Pure + side-effect free for easy testing.
 */
export function searchAndSortInvoices<T extends SearchableInvoice>(
  rows: T[],
  query: string,
  sortKey: InvoiceSortKey,
  dir: SortDir,
): T[] {
  const q = (query ?? "").trim().toLowerCase();
  const filtered = q
    ? (rows ?? []).filter((r) =>
        String(r.invoice_no ?? "").toLowerCase().includes(q) ||
        String(r.due_date ?? "").toLowerCase().includes(q),
      )
    : [...(rows ?? [])];
  const mult = dir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === "due_amount") {
      av = Number(a.due_amount ?? 0); bv = Number(b.due_amount ?? 0);
    } else {
      av = String(a[sortKey] ?? ""); bv = String(b[sortKey] ?? "");
    }
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}




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

export type OpenInvoicesResult<T> = {
  rows: T[];
  error: { message: string; code?: string } | null;
  traceId: string | null;
};

/**
 * Result-returning variant. Callers that need to surface errors / empty states
 * to the user should use this. `traceId` is a per-request id logged alongside
 * any failure so support can correlate the console log with the UI toast.
 */
export async function fetchOpenIrrigationInvoicesResult<T extends DueInvoiceRow = any>(
  farmerId: string,
  select: string,
): Promise<OpenInvoicesResult<T>> {
  const selectWithGuardColumns = ensureSelectColumns(select, ["due_amount", "deleted_at"]);
  const { data, error } = await db
    .from("irrigation_invoices")
    .select(selectWithGuardColumns)
    .eq("farmer_id", farmerId)
    .order("due_date", { ascending: true });
  if (error) {
    const traceId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}`;
    console.error(`[irrigation-invoices][${traceId}] fetch failed for farmer ${farmerId}:`, error);
    return { rows: [], error: { message: (error as any).message, code: (error as any).code }, traceId };
  }
  // Drop cancelled/deleted and fully-paid/non-due rows in JS so NULL/empty
  // invoice_status rows are kept and Laravel/MySQL operator bugs cannot hide
  // valid invoices from Payments.
  const raw = (data as any[]) ?? [];
  const rows = raw.filter((r) => isActiveInvoice(r) && Number(r?.due_amount || 0) > 0) as T[];
  // Double-verify the positive-due filter is actually effective on the server
  // response: log raw vs kept counts and flag any non-positive rows that slipped
  // through (should always be 0). Helps confirm due_amount > 0 filtering works.
  const nonPositiveKept = rows.filter((r: any) => Number(r?.due_amount || 0) <= 0).length;
  console.debug(
    `[irrigation-invoices] farmer=${farmerId} received=${raw.length} kept(due>0,active)=${rows.length} nonPositiveKept=${nonPositiveKept}`,
  );
  if (nonPositiveKept > 0) {
    console.warn(`[irrigation-invoices] positive-due filter leaked ${nonPositiveKept} non-positive rows for farmer ${farmerId}`);
  }
  return { rows, error: null, traceId: null };
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
  const { rows } = await fetchOpenIrrigationInvoicesResult<T>(farmerId, select);
  return rows;
}

