/**
 * ধাপ ৪ — Invoice Generation, Filter ও Due হিসাব
 *
 * Pure helpers that:
 *  1. Generate one invoice row per billed farmer (owner remainder + each
 *     sharecropper) from a parcel, reusing the Barga split + invoice calc.
 *  2. Filter a set of generated invoices (office / season / farmer / status /
 *     date range / overdue only).
 *  3. Aggregate the filtered invoices into payable / paid / due / overdue totals.
 *
 * Guarantees:
 *  - Σ(per-farmer payable) === whole-parcel payable (no double-billing).
 *  - Filtering never mutates amounts; due totals always reconcile with the rows.
 */
import { calcInvoice, type ChargeSettings, type CalculationBasis, type InvoiceStatus } from "./irrigationInvoice";
import { splitBillableArea, type BargaRelation } from "./irrigationBargaSplit";

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const rTaka = (v: number) => Math.round(Number(v) || 0);

export interface GeneratedInvoice {
  billed_farmer_id: string;
  owner_farmer_id: string;
  is_borga: boolean;
  billed_area: number;
  office_id: string | null;
  season_id: string | null;
  invoice_date: string;
  due_date: string;
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
  is_overdue: boolean;
  status: InvoiceStatus;
}

export interface GenerateInvoicesInput {
  office_id?: string | null;
  season_id?: string | null;
  owner_farmer_id: string;
  parcel_area: number;
  rate_per_shotok: number;
  basis?: CalculationBasis;
  settings: ChargeSettings;
  invoice_date: string;
  due_date: string;
  as_of?: string | Date;
  relations: BargaRelation[];
  /** Total paid against the whole parcel, allocated proportionally to payable. */
  paid_amount?: number;
}

/** Generate one invoice per billed farmer for a single parcel. */
export function generateInvoices(input: GenerateInvoicesInput): GeneratedInvoice[] {
  const splits = splitBillableArea({
    owner_farmer_id: input.owner_farmer_id,
    parcel_area: input.parcel_area,
    relations: input.relations,
  });

  const calced = splits.map((s) => ({
    split: s,
    calc: calcInvoice({
      land_size_shotok: s.billed_area,
      rate_per_shotok: input.rate_per_shotok,
      basis: input.basis,
      settings: input.settings,
      due_date: input.due_date,
      as_of: input.as_of,
    }),
  }));

  const totalPayable = calced.reduce((sum, c) => sum + c.calc.payable_amount, 0);
  const totalPaid = Math.min(num(input.paid_amount), totalPayable);

  return calced.map(({ split, calc }) => {
    const paid = totalPayable > 0 ? r2((calc.payable_amount / totalPayable) * totalPaid) : 0;
    const due = r2(Math.max(calc.payable_amount - paid, 0));
    let status: InvoiceStatus;
    if (paid >= calc.payable_amount && calc.payable_amount > 0) status = "paid";
    else if (paid > 0) status = "partial_paid";
    else if (calc.is_overdue) status = "overdue";
    else status = "generated";
    return {
      billed_farmer_id: split.billed_farmer_id,
      owner_farmer_id: split.owner_farmer_id,
      is_borga: split.is_borga,
      billed_area: split.billed_area,
      office_id: input.office_id ?? null,
      season_id: input.season_id ?? null,
      invoice_date: input.invoice_date,
      due_date: input.due_date,
      payable_amount: calc.payable_amount,
      paid_amount: paid,
      due_amount: due,
      is_overdue: calc.is_overdue,
      status,
    };
  });
}

export interface InvoiceFilter {
  office_id?: string | null;
  season_id?: string | null;
  farmer_id?: string | null;
  status?: InvoiceStatus | null;
  from?: string | null;
  to?: string | null;
  overdue_only?: boolean;
}

/** Filter generated invoices without mutating any amounts. */
export function filterInvoices(rows: GeneratedInvoice[], f: InvoiceFilter = {}): GeneratedInvoice[] {
  return rows.filter((r) => {
    if (f.office_id && r.office_id !== f.office_id) return false;
    if (f.season_id && r.season_id !== f.season_id) return false;
    if (f.farmer_id && r.billed_farmer_id !== f.farmer_id) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.from && r.invoice_date < f.from) return false;
    if (f.to && r.invoice_date > f.to) return false;
    if (f.overdue_only && !(r.due_amount > 0 && r.is_overdue)) return false;
    return true;
  });
}

export interface DueSummary {
  payable: number;
  paid: number;
  due: number;
  overdue: number;
  invoiceCount: number;
}

/** Aggregate filtered invoices into reconciled totals. */
export function summarizeDue(rows: GeneratedInvoice[]): DueSummary {
  let payable = 0, paid = 0, due = 0, overdue = 0;
  for (const r of rows) {
    payable += num(r.payable_amount);
    paid += num(r.paid_amount);
    due += num(r.due_amount);
    if (r.due_amount > 0 && r.is_overdue) overdue += num(r.due_amount);
  }
  return {
    payable: r2(payable),
    paid: r2(paid),
    due: r2(due),
    overdue: r2(overdue),
    invoiceCount: rows.length,
  };
}
