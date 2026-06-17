// Optional scheduled cash-report backup snapshots.
// Stores a per-browser schedule (off / daily / weekly) and the timestamp of the
// last automatic snapshot. `maybeScheduledBackup` runs a snapshot only when the
// configured interval has elapsed — called before DemoManager / QuickSeed seeds.
import { downloadCashReportBackup } from "@/lib/cashReportBackup";

export type BackupSchedule = "off" | "daily" | "weekly";

const SCHEDULE_KEY = "cash_report_backup_schedule";
const LAST_RUN_KEY = "cash_report_backup_last_scheduled_run";

const INTERVAL_MS: Record<Exclude<BackupSchedule, "off">, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export function getBackupSchedule(): BackupSchedule {
  try {
    const v = localStorage.getItem(SCHEDULE_KEY);
    if (v === "daily" || v === "weekly" || v === "off") return v;
  } catch { /* ignore */ }
  return "off";
}

export function setBackupSchedule(s: BackupSchedule): void {
  try { localStorage.setItem(SCHEDULE_KEY, s); } catch { /* ignore */ }
}

export function getLastScheduledRun(): number | null {
  try {
    const v = localStorage.getItem(LAST_RUN_KEY);
    return v ? Number(v) : null;
  } catch { return null; }
}

export function isScheduledBackupDue(now = Date.now()): boolean {
  const schedule = getBackupSchedule();
  if (schedule === "off") return false;
  const last = getLastScheduledRun();
  if (!last) return true;
  return now - last >= INTERVAL_MS[schedule];
}

// Run a snapshot if the schedule is active and the interval has elapsed.
// Returns "skipped" when not due, "ok"/"failed" otherwise.
export async function maybeScheduledBackup(
  officeId?: string | null,
): Promise<{ status: "skipped" | "ok" | "failed"; rows?: number; tables?: number; error?: string }> {
  if (!isScheduledBackupDue()) return { status: "skipped" };
  try {
    const r = await downloadCashReportBackup(officeId);
    try { localStorage.setItem(LAST_RUN_KEY, String(Date.now())); } catch { /* ignore */ }
    return { status: "ok", rows: r.rows, tables: r.tables };
  } catch (e: any) {
    return { status: "failed", error: e?.message ?? "Failed" };
  }
}
