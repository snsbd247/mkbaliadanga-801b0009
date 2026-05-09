import { supabase } from "@/integrations/supabase/client";

export type AuditModule =
  | "irrigation_payment"
  | "irrigation_invoice"
  | "delay_fee_override"
  | "promise_date"
  | "sms"
  | "receipt"
  | "permission"
  | "retry_job"
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

    const { error } = await supabase.from("system_audit_logs").insert(payload);
    if (error) console.warn("[audit] insert failed:", error.message);
  } catch (e) {
    console.warn("[audit] unexpected error:", e);
  }
}
