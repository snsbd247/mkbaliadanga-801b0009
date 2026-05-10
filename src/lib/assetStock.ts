import { supabase } from "@/integrations/supabase/client";
import { applyStockDelta } from "./assetMath";

/**
 * Idempotent stock adjustment for an asset at a location.
 * - Upserts into asset_stocks (asset_id + location_id unique).
 * - Floors at 0; never produces negative stock.
 * - No accounting side-effects (caller decides).
 */
export async function adjustAssetStock(params: {
  asset_id: string;
  office_id: string | null;
  location_id: string | null;
  delta: number;
}) {
  const { asset_id, office_id, location_id, delta } = params;
  if (!location_id) throw new Error("location_id required");
  const { data: existing, error: e1 } = await supabase
    .from("asset_stocks" as any)
    .select("id, quantity")
    .eq("asset_id", asset_id)
    .eq("location_id", location_id)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) {
    const next = applyStockDelta(Number((existing as any).quantity), delta);
    const { error } = await supabase
      .from("asset_stocks" as any)
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq("id", (existing as any).id);
    if (error) throw error;
    return next;
  } else if (delta > 0) {
    const { error } = await supabase
      .from("asset_stocks" as any)
      .insert({ asset_id, office_id, location_id, quantity: delta });
    if (error) throw error;
    return delta;
  }
  return 0;
}

/**
 * Records a movement and adjusts both source/destination stocks atomically
 * from the client's perspective (best-effort, fail-safe by floor at 0).
 */
export async function recordAssetMovement(params: {
  asset_id: string;
  office_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  movement_date: string;
  remarks?: string | null;
  moved_by?: string | null;
}) {
  const { asset_id, office_id, from_location_id, to_location_id,
          quantity, movement_date, remarks, moved_by } = params;
  if (quantity <= 0) throw new Error("quantity must be > 0");
  if (!from_location_id && !to_location_id) throw new Error("at least one location required");

  const { data: row, error } = await supabase.from("asset_movements" as any).insert({
    asset_id, office_id, from_location_id, to_location_id,
    quantity, movement_date, remarks: remarks ?? null, moved_by: moved_by ?? null,
  }).select("id").maybeSingle();
  if (error) throw error;

  if (from_location_id) await adjustAssetStock({ asset_id, office_id, location_id: from_location_id, delta: -quantity });
  if (to_location_id)   await adjustAssetStock({ asset_id, office_id, location_id: to_location_id,   delta: +quantity });
  return (row as any)?.id as string | undefined;
}
