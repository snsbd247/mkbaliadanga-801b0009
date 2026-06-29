import { db } from "@/lib/db";
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
  const { data: existing, error: e1 } = await db
    .from("asset_stocks" as any)
    .select("id, quantity")
    .eq("asset_id", asset_id)
    .eq("location_id", location_id)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) {
    const next = applyStockDelta(Number((existing as any).quantity), delta);
    const { error } = await db
      .from("asset_stocks" as any)
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq("id", (existing as any).id);
    if (error) throw error;
    return next;
  } else if (delta > 0) {
    const { error } = await db
      .from("asset_stocks" as any)
      .insert({ asset_id, office_id, location_id, quantity: delta });
    if (error) throw error;
    return delta;
  }
  return 0;
}

/**
 * Records a movement. When `requiresApproval` is true, the row is inserted
 * as pending and stock is NOT adjusted until approveAssetMovement() runs.
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
  requiresApproval?: boolean;
}) {
  const { asset_id, office_id, from_location_id, to_location_id,
          quantity, movement_date, remarks, moved_by, requiresApproval = false } = params;
  if (quantity <= 0) throw new Error("quantity must be > 0");
  if (!from_location_id && !to_location_id) throw new Error("at least one location required");

  const payload: Record<string, unknown> = {
    asset_id, office_id, from_location_id, to_location_id,
    quantity, movement_date, remarks: remarks ?? null, moved_by: moved_by ?? null,
    requested_by: moved_by ?? null,
    approval_status: requiresApproval ? "pending" : "approved",
    applied: !requiresApproval,
    approved_by: requiresApproval ? null : moved_by ?? null,
    approved_at: requiresApproval ? null : new Date().toISOString(),
  };

  const { data: row, error } = await db.from("asset_movements" as any)
    .insert(payload).select("id").maybeSingle();
  if (error) throw error;

  if (!requiresApproval) {
    if (from_location_id) await adjustAssetStock({ asset_id, office_id, location_id: from_location_id, delta: -quantity });
    if (to_location_id)   await adjustAssetStock({ asset_id, office_id, location_id: to_location_id,   delta: +quantity });
  }
  return (row as any)?.id as string | undefined;
}

/** Approve a pending movement: apply stock and mark approved. Idempotent. */
export async function approveAssetMovement(movementId: string, approverUserId: string | null) {
  const { data: m, error: e1 } = await db.from("asset_movements" as any)
    .select("id, asset_id, office_id, from_location_id, to_location_id, quantity, approval_status, applied")
    .eq("id", movementId).maybeSingle();
  if (e1) throw e1;
  if (!m) throw new Error("Movement not found");
  const row = m as any;
  if (row.approval_status === "approved" && row.applied) return;
  if (row.approval_status === "rejected") throw new Error("Already rejected");

  if (!row.applied) {
    if (row.from_location_id) await adjustAssetStock({ asset_id: row.asset_id, office_id: row.office_id, location_id: row.from_location_id, delta: -Number(row.quantity) });
    if (row.to_location_id)   await adjustAssetStock({ asset_id: row.asset_id, office_id: row.office_id, location_id: row.to_location_id,   delta: +Number(row.quantity) });
  }
  const { error } = await db.from("asset_movements" as any)
    .update({ approval_status: "approved", applied: true, approved_by: approverUserId, approved_at: new Date().toISOString() })
    .eq("id", movementId);
  if (error) throw error;
}

/** Reject a pending movement with a reason. */
export async function rejectAssetMovement(movementId: string, approverUserId: string | null, reason: string) {
  const { error } = await db.from("asset_movements" as any)
    .update({ approval_status: "rejected", approved_by: approverUserId, approved_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", movementId).eq("approval_status", "pending");
  if (error) throw error;
}
