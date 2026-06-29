// Records a QuickSeed / DemoManager run in the demo operations audit log.
// Captures who ran it, when, which modules, backup status and validation results.
import { db } from "@/lib/db";
import type { CashCountRow } from "@/lib/cashReportBackup";

const sb = db as any;

export type DemoRunAudit = {
  source: "QuickSeed" | "DemoManager";
  action: string;
  modules: string[];
  size?: number;
  success: boolean;
  errorMessage?: string;
  backupStatus: "skipped" | "ok" | "failed";
  validation?: CashCountRow[] | null;
};

export async function logDemoRun(
  user: { id?: string; email?: string } | null,
  audit: DemoRunAudit,
): Promise<void> {
  if (!user?.id) return;
  const mismatches = (audit.validation ?? []).filter((r) => !r.ok).map((r) => r.table);
  try {
    await sb.from("demo_operations_log").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: audit.action,
      modules: audit.modules,
      size: audit.size ?? null,
      success: audit.success,
      error_message: audit.errorMessage ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      summary: {
        source: audit.source,
        backup_status: audit.backupStatus,
        validation: audit.validation ?? null,
        validation_mismatches: mismatches,
      },
    });
  } catch { /* audit logging is best-effort */ }
}
