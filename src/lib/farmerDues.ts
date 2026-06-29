import { supabase } from "@/integrations/supabase/client";

export type FarmerDuesBreakdown = {
  farmer_id: string;
  savings_balance: number;
  share_balance: number;
  loan_due: number;
  irrigation_due: number;
  net_due: number;
};

/**
 * Single source of truth for per-farmer balances.
 * Mirrors public.farmer_dues_breakdown SQL aggregates so every UI surface
 * (Voter cancel dialog, Dues Audit, Farmer profile, Scan/Pay…) shows
 * identical numbers.
 */
export async function getFarmerDues(farmerId: string): Promise<FarmerDuesBreakdown> {
  const { data, error } = await db.rpc("farmer_dues_breakdown" as any, { _farmer_id: farmerId });
  if (error) throw error;
  const row: any = Array.isArray(data) ? data[0] : data;
  return {
    farmer_id: farmerId,
    savings_balance: Number(row?.savings_balance ?? 0),
    share_balance: Number(row?.share_balance ?? 0),
    loan_due: Number(row?.loan_due ?? 0),
    irrigation_due: Number(row?.irrigation_due ?? 0),
    net_due: Number(row?.net_due ?? 0),
  };
}

export function hasBlockingDues(d: FarmerDuesBreakdown): boolean {
  return d.savings_balance !== 0 || d.loan_due > 0 || d.irrigation_due > 0;
}
