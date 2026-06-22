/**
 * Irrigation Invoice domain logic — pure functions + Supabase helpers.
 *
 * Charge model (per-office settings stored in `irrigation_charge_settings`):
 *   irrigation_amount depends on the category calculation basis:
 *     per_shotok / custom → rate × land_size_shotok
 *     per_bigha           → rate × (land_size_shotok / 33)
 *     flat                → rate (fixed fee, area-independent)
 *   maintenance       = irrigation_amount × maintenance_percent / 100
 *   canal             = irrigation_amount × canal_percent / 100
 *   delay_fee         = (irrigation+maintenance+canal) × delay_fee_percent / 100   (only if overdue past grace_days and auto_apply_delay_fee)
 *   payable           = irrigation + maintenance + canal + delay_fee + other
 *   due               = max(payable - paid, 0)
 *
 * Borga (sharecropper) rule:
 *   If an active land_relations row (valid_from..valid_to) has a sharecropper_farmer_id,
 *   bill the sharecropper. Otherwise bill the land owner.
 */
import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "draft" | "generated" | "partial_paid" | "paid" | "overdue" | "cancelled";

export interface ChargeSettings {
  delay_fee_percent: number;
  maintenance_percent: number;
  canal_percent: number;
  grace_days: number;
  auto_apply_delay_fee: boolean;
}

export const DEFAULT_SETTINGS: ChargeSettings = {
  delay_fee_percent: 0,
  maintenance_percent: 0,
  canal_percent: 0,
  grace_days: 0,
  auto_apply_delay_fee: true,
};

const n = (v: any): number => {
  const x = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export const SHATAK_PER_BIGHA = 33;
export type CalculationBasis = "per_shotok" | "per_bigha" | "flat" | "custom";

/** Base irrigation charge respecting the category's calculation basis. */
export function baseIrrigationAmount(land_size_shotok: number, rate: number, basis: CalculationBasis = "per_shotok"): number {
  const land = n(land_size_shotok);
  const r = n(rate);
  switch (basis) {
    case "flat":
      return r2(r);
    case "per_bigha":
      return r2((land / SHATAK_PER_BIGHA) * r);
    case "per_shotok":
    case "custom":
    default:
      return r2(land * r);
  }
}

export interface InvoiceCalcInput {
  land_size_shotok: number;
  rate_per_shotok: number;
  /** Category calculation basis; defaults to per_shotok. */
  basis?: CalculationBasis;
  settings: ChargeSettings;
  due_date: string | Date;        // ISO date
  as_of?: string | Date;          // for delay-fee calc; defaults to today
  other_charge?: number;
  paid_amount?: number;
}

export interface InvoiceCalcResult {
  irrigation_amount: number;
  maintenance_amount: number;
  canal_amount: number;
  delay_fee: number;
  other_charge: number;
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
  is_overdue: boolean;
  status: InvoiceStatus;
}

export function calcInvoice(input: InvoiceCalcInput): InvoiceCalcResult {
  const irrigation = baseIrrigationAmount(input.land_size_shotok, input.rate_per_shotok, input.basis ?? "per_shotok");
  const maintenance = r2((irrigation * n(input.settings.maintenance_percent)) / 100);
  const canal = r2((irrigation * n(input.settings.canal_percent)) / 100);
  const other = r2(n(input.other_charge));

  const dueDate = new Date(input.due_date);
  const today = input.as_of ? new Date(input.as_of) : new Date();
  const graceMs = n(input.settings.grace_days) * 24 * 60 * 60 * 1000;
  const overdueAt = new Date(dueDate.getTime() + graceMs);
  const is_overdue = today > overdueAt;

  let delay_fee = 0;
  if (is_overdue && input.settings.auto_apply_delay_fee) {
    delay_fee = r2(((irrigation + maintenance + canal) * n(input.settings.delay_fee_percent)) / 100);
  }

  const payable = r2(irrigation + maintenance + canal + delay_fee + other);
  const paid = Math.min(r2(n(input.paid_amount)), payable);
  const due = r2(payable - paid);

  let status: InvoiceStatus;
  if (paid >= payable && payable > 0) status = "paid";
  else if (paid > 0) status = "partial_paid";
  else if (is_overdue) status = "overdue";
  else status = "generated";

  return {
    irrigation_amount: irrigation,
    maintenance_amount: maintenance,
    canal_amount: canal,
    delay_fee,
    other_charge: other,
    payable_amount: payable,
    paid_amount: paid,
    due_amount: due,
    is_overdue,
    status,
  };
}

/**
 * Resolve who should be billed for a land at the given date.
 * Returns { billed_farmer_id, owner_farmer_id, is_borga }.
 */
export async function resolveBilledFarmer(land_id: string, as_of: string = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await supabase.rpc("get_billed_farmer_for_land", { _land_id: land_id, _as_of: as_of });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    billed_farmer_id: row?.farmer_id as string,
    owner_farmer_id: row?.owner_farmer_id as string,
    is_borga: !!row?.is_borga,
  };
}

export interface BillingSplit {
  billed_farmer_id: string;
  owner_farmer_id: string;
  is_borga: boolean;
  billed_area: number;
}

/**
 * Split a land's billable area between owner and active sharecroppers (Phase 4).
 * Sharecroppers are billed for their borga area; the owner is billed for the remainder.
 * Falls back to a single owner/sharecropper row if the RPC returns nothing.
 */
export async function resolveBillingSplits(
  land_id: string,
  as_of: string = new Date().toISOString().slice(0, 10),
): Promise<BillingSplit[]> {
  const { data, error } = await supabase.rpc("get_land_billing_split" as any, { _land_id: land_id, _as_of: as_of });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as any[];
  const splits = rows
    .map((r) => ({
      billed_farmer_id: r.farmer_id as string,
      owner_farmer_id: r.owner_farmer_id as string,
      is_borga: !!r.is_borga,
      billed_area: Number(r.billed_area) || 0,
    }))
    .filter((s) => s.billed_farmer_id && s.billed_area > 0);
  if (splits.length) return splits;
  const fallback = await resolveBilledFarmer(land_id, as_of);
  return [{ ...fallback, billed_area: 0 }];
}


export async function getChargeSettings(office_id: string | null): Promise<ChargeSettings> {
  if (!office_id) return DEFAULT_SETTINGS;
  const { data } = await supabase
    .from("irrigation_charge_settings")
    .select("delay_fee_percent,maintenance_percent,canal_percent,grace_days,auto_apply_delay_fee")
    .eq("office_id", office_id)
    .maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...(data as any) } : DEFAULT_SETTINGS;
}

export async function generateInvoiceNo(): Promise<string> {
  const { data, error } = await supabase.rpc("generate_invoice_no" as any);
  if (error) throw error;
  return data as string;
}
