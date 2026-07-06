/**
 * Irrigation due — single source of truth.
 *
 * Every dashboard / report / statement / cashbook MUST read irrigation due via
 * one of these helpers. They read ONLY from `irrigation_invoices` and
 * `irrigation_invoice_payments` (never from the legacy `irrigation_charges`
 * table or from cached aggregates).
 *
 * Convention:
 *   payable_amount  = irrigation + delay + maintenance + canal + other
 *   paid_amount     = sum of irrigation_invoice_payments.collected_amount
 *   due_amount      = payable_amount - paid_amount   (stored on the row)
 */
import { db } from "@/lib/db";
export interface IrrigationDueAggregate {
  payable: number;
  paid: number;
  due: number;
  overdue: number;
  invoiceCount: number;
}

export interface IrrigationCollectionsRow {
  date: string; // YYYY-MM-DD
  collected: number;
  current: number;
  previous: number;
}

const num = (v: any) => Number(v ?? 0) || 0;

/** Per-farmer due — used by farmer profile / statement / receipt previews. */
export async function getIrrigationDueForFarmer(farmerId: string): Promise<IrrigationDueAggregate> {
  const { data, error } = await db
    .from("irrigation_invoices")
    .select("payable_amount,paid_amount,due_amount,due_date,invoice_status")
    .eq("farmer_id", farmerId)
    .is("deleted_at", null)
    .neq("invoice_status", "cancelled");
  if (error) throw error;
  return aggregate((data ?? []).filter((r: any) => r.invoice_status !== "carried_forward"));
}

/** Org-wide aggregate (optionally office-scoped). */
export async function getIrrigationDueAggregate(opts?: { officeId?: string | null; seasonId?: string | null }): Promise<IrrigationDueAggregate> {
  let q = db
    .from("irrigation_invoices")
    .select("payable_amount,paid_amount,due_amount,due_date,invoice_status,office_id,season_id")
    .is("deleted_at", null)
    .neq("invoice_status", "cancelled");
  if (opts?.officeId) q = q.eq("office_id", opts.officeId);
  if (opts?.seasonId) q = q.eq("season_id", opts.seasonId);
  const { data, error } = await q;
  if (error) throw error;
  return aggregate((data ?? []).filter((r: any) => r.invoice_status !== "carried_forward"));
}

/** Daily collections summary from irrigation_invoice_payments (split by current/previous). */
export async function getIrrigationCollections(opts: { from: string; to: string; officeId?: string | null }): Promise<IrrigationCollectionsRow[]> {
  let q = db
    .from("irrigation_invoice_payments")
    .select("created_at,collected_amount,current_invoice_collected,previous_due_collected,office_id")
    .gte("created_at", opts.from)
    .lte("created_at", opts.to);
  if (opts.officeId) q = q.eq("office_id", opts.officeId);
  const { data, error } = await q;
  if (error) throw error;
  const map = new Map<string, IrrigationCollectionsRow>();
  for (const r of data ?? []) {
    const date = String((r as any).created_at ?? "").slice(0, 10);
    if (!date) continue;
    const cur = num((r as any).current_invoice_collected);
    const prev = num((r as any).previous_due_collected);
    const total = num((r as any).collected_amount) || cur + prev;
    const row = map.get(date) ?? { date, collected: 0, current: 0, previous: 0 };
    row.collected += total;
    row.current += cur;
    row.previous += prev;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregate(rows: Array<Record<string, any>>): IrrigationDueAggregate {
  const today = new Date().toISOString().slice(0, 10);
  let payable = 0, paid = 0, due = 0, overdue = 0, invoiceCount = 0;
  for (const r of rows) {
    payable += num(r.payable_amount);
    paid += num(r.paid_amount);
    const d = num(r.due_amount);
    due += d;
    invoiceCount += 1;
    if (d > 0 && r.due_date && String(r.due_date) < today) overdue += d;
  }
  return { payable, paid, due, overdue, invoiceCount };
}

/**
 * Single source of truth for an invoice's due + status given payable & paid.
 *
 * Guard rules (prevent double-add / over-count):
 *  - paid is clamped to [0, payable]; due = payable - paid, never negative.
 *  - This is the ONLY place receipt / edit / cancel flows should derive
 *    due_amount + invoice_status, so a re-applied payment can never double-count.
 */
export interface InvoiceDueState {
  payable: number;
  paid: number;
  due: number;
  status: "unpaid" | "partial" | "paid";
}

export function computeInvoiceDue(payable: unknown, paid: unknown): InvoiceDueState {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const pay = Math.max(num(payable), 0);
  const collected = Math.min(Math.max(num(paid), 0), pay);
  const due = r2(Math.max(pay - collected, 0));
  const status: InvoiceDueState["status"] =
    collected <= 0 ? "unpaid" : collected >= pay && pay > 0 ? "paid" : "partial";
  return { payable: r2(pay), paid: r2(collected), due, status };
}
