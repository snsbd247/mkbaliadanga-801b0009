/**
 * Barga (sharecropper) Due Logic — single source of truth.
 *
 * Combines the pure area split (`splitBillableArea`) with the invoice
 * calculation (`calcInvoice`) so each billed farmer (owner remainder +
 * each sharecropper) gets their own due derived from their billed area.
 *
 * Guarantees:
 *  - The sum of all per-farmer payable/due equals the whole-parcel
 *    payable/due (no double-billing, no lost area).
 *  - Paid amounts are allocated proportionally to each row's payable so
 *    no farmer is over- or under-credited.
 */
import { calcInvoice, type ChargeSettings, type CalculationBasis } from "./irrigationInvoice";
import { splitBillableArea, type BargaRelation } from "./irrigationBargaSplit";

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface BargaDueRow {
  billed_farmer_id: string;
  owner_farmer_id: string;
  is_borga: boolean;
  billed_area: number;
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
}

export interface BargaDueInput {
  owner_farmer_id: string;
  parcel_area: number;
  rate_per_shotok: number;
  settings: ChargeSettings;
  due_date: string | Date;
  as_of?: string | Date;
  basis?: CalculationBasis;
  relations: BargaRelation[];
  /** Total paid against the whole parcel, allocated proportionally. */
  paid_amount?: number;
}

export function computeBargaDue(input: BargaDueInput): BargaDueRow[] {
  const splits = splitBillableArea({
    owner_farmer_id: input.owner_farmer_id,
    parcel_area: input.parcel_area,
    relations: input.relations,
  });

  const base = splits.map((s) => {
    const c = calcInvoice({
      land_size_shotok: s.billed_area,
      rate_per_shotok: input.rate_per_shotok,
      basis: input.basis,
      settings: input.settings,
      due_date: input.due_date,
      as_of: input.as_of,
    });
    return { split: s, payable: c.payable_amount };
  });

  const totalPayable = base.reduce((sum, b) => sum + b.payable, 0);
  const totalPaid = Math.min(num(input.paid_amount), totalPayable);

  return base.map((b) => {
    const paid =
      totalPayable > 0 ? r2((b.payable / totalPayable) * totalPaid) : 0;
    return {
      billed_farmer_id: b.split.billed_farmer_id,
      owner_farmer_id: b.split.owner_farmer_id,
      is_borga: b.split.is_borga,
      billed_area: b.split.billed_area,
      payable_amount: b.payable,
      paid_amount: paid,
      due_amount: r2(Math.max(b.payable - paid, 0)),
    };
  });
}
