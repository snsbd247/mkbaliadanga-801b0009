import { supabase } from "@/integrations/supabase/client";

import { db } from "@/lib/db";
export type AuditModule =
  | "irrigation_payment"
  | "irrigation_invoice"
  | "delay_fee_override"
  | "promise_date"
  | "sms"
  | "receipt"
  | "permission"
  | "retry_job"
  | "season"
  | "other";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "recalculate"
  | "override"
  | "send"
  | "fail"
  | "retry"
  | "approve"
  | "reject"
  | "export";

export interface LogAuditInput {
  office_id?: string | null;
  module: AuditModule | string;
  action_type: AuditAction | string;
  reference_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
}

let cachedUA: string | null = null;
function getUA(): string | null {
  if (cachedUA !== null) return cachedUA;
  if (typeof navigator !== "undefined") cachedUA = navigator.userAgent || "";
  return cachedUA;
}

/**
 * Fire-and-forget audit logger. Never throws — failures are logged to console
 * so that the originating business operation is not affected.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData?.user?.id ?? null;

    const payload = {
      office_id: input.office_id ?? null,
      user_id,
      module: input.module,
      action_type: input.action_type,
      reference_id: input.reference_id ?? null,
      old_data: input.old_data ?? null,
      new_data: input.new_data ?? null,
      ip: null,
      user_agent: getUA(),
    };

    const { error } = await db.from("system_audit_logs").insert([payload as any]);
    if (error) console.warn("[audit] insert failed:", error.message);
  } catch (e) {
    console.warn("[audit] unexpected error:", e);
  }
}

/**
 * Fire-and-forget audit log for report/data exports. Records which report was
 * exported, in what format, with the active filters, so exports are searchable
 * by office and date range in the Audit Timeline.
 */
export function auditExport(
  report: string,
  meta: Record<string, unknown> = {},
  office_id?: string | null,
): void {
  void logAudit({
    office_id: office_id ?? null,
    module: "other",
    action_type: "export",
    reference_id: report,
    new_data: { report, ...meta },
  });
}
