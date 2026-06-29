import { supabase } from "@/integrations/supabase/client";

import { db } from "@/lib/db";
export interface AssetAuditInput {
  office_id?: string | null;
  asset_id?: string | null;
  entity: string;
  entity_id?: string | null;
  action_type:
    | "create" | "update" | "delete"
    | "transfer" | "install" | "repair"
    | "damage" | "dispose" | "stock_adjust" | "purchase";
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  remarks?: string | null;
}

/** Fire-and-forget audit logger for the asset module. Never throws. */
export async function logAssetAudit(input: AssetAuditInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData?.user?.id ?? null;
    const payload = {
      office_id: input.office_id ?? null,
      user_id,
      asset_id: input.asset_id ?? null,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      action_type: input.action_type,
      old_data: input.old_data ?? null,
      new_data: input.new_data ?? null,
      remarks: input.remarks ?? null,
    };
    const { error } = await db.from("asset_audit_logs" as any).insert([payload as any]);
    if (error) console.warn("[asset-audit] insert failed:", error.message);
  } catch (e) {
    console.warn("[asset-audit] unexpected error:", e);
  }
}
