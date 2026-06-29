import { db } from "@/lib/db";
export type ReceiptAuditLog = {
  id: string;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string;
  office_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  user_id: string | null;
};

export type ReceiptAuditFilters = {
  receiptNo?: string;
  officeId?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  paymentId?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Single source of truth for reading payment/receipt edit audit logs
 * (before/after values + reason). Used by both the receipt edit dialog and
 * the admin audit log report so the two never diverge.
 */
export async function fetchReceiptAuditLogs(
  filters: ReceiptAuditFilters = {},
): Promise<{ rows: ReceiptAuditLog[]; count: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  let q = db
    .from("audit_logs" as any)
    .select("id,created_at,action,entity,entity_id,office_id,old_values,new_values,meta,user_id", { count: "exact" })
    .eq("entity", "payments")
    .order("created_at", { ascending: filters.ascending ?? false })
    // Stable secondary key so rows never reorder across pages on identical timestamps.
    .order("id", { ascending: filters.ascending ?? false });

  if (filters.paymentId) q = q.eq("entity_id", filters.paymentId);
  if (filters.officeId) q = q.eq("office_id", filters.officeId);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
  if (filters.receiptNo) q = q.contains("meta", { receipt_no: filters.receiptNo });

  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data as any) ?? [], count: count ?? 0 };
}
