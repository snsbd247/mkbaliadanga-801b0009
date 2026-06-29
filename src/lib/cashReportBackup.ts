// Shared helpers for the cash-report demo workflow:
//  - listing the tables that feed Cash Book / Hand Cash / Cash Statement reports
//  - counting their rows (post-seed validation)
//  - taking a JSON snapshot backup of just those tables before seeding
// Kept side-effect-light so the count/flag logic can be unit-tested.
import { db } from "@/lib/db";
const sb = db as any;

// Tables backing the cash reports for BOTH irrigation (সেচ) and society (সমিতি).
export const CASH_REPORT_TABLES = [
  "receipts",
  "office_incomes",
  "cashbook_submissions",
  "hand_cash_submissions",
  "expenses",
  "payments",
  "bank_transactions",
  "savings_transactions",
  "loan_payments",
] as const;

export type CashReportTable = (typeof CASH_REPORT_TABLES)[number];

// Tables that MUST contain rows after seeding the cash modules; others are optional.
export const CASH_REQUIRED_TABLES: CashReportTable[] = [
  "receipts",
  "office_incomes",
  "expenses",
];

export type CashCountRow = {
  table: CashReportTable;
  count: number;
  required: boolean;
  ok: boolean; // required tables must be > 0
};

export async function fetchCashReportCounts(officeId?: string | null): Promise<CashCountRow[]> {
  const rows = await Promise.all(
    CASH_REPORT_TABLES.map(async (table) => {
      let q = sb.from(table).select("id", { count: "exact", head: true });
      if (officeId) q = q.eq("office_id", officeId);
      const { count } = await q;
      const c = Number(count ?? 0);
      const required = CASH_REQUIRED_TABLES.includes(table);
      return { table, count: c, required, ok: required ? c > 0 : true } as CashCountRow;
    }),
  );
  return rows;
}

// Pure: flag any required table that ended up empty after seeding.
export function flagCashMismatches(rows: CashCountRow[]): CashCountRow[] {
  return rows.filter((r) => !r.ok);
}

async function fetchAll(table: string, officeId?: string | null) {
  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];
  while (true) {
    let q = sb.from(table).select("*").range(from, from + PAGE - 1);
    if (officeId) q = q.eq("office_id", officeId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export type CashSnapshot = {
  kind: "cash-report-backup";
  created_at: string;
  officeId: string | null;
  tables: Record<string, any[]>;
};

const LAST_SNAPSHOT_KEY = "cash_report_last_backup";

export async function buildCashReportSnapshot(officeId?: string | null): Promise<CashSnapshot> {
  const snapshot: Record<string, any[]> = {};
  for (const table of CASH_REPORT_TABLES) {
    snapshot[table] = await fetchAll(table, officeId);
  }
  return { kind: "cash-report-backup", created_at: new Date().toISOString(), officeId: officeId ?? null, tables: snapshot };
}

// Take a JSON snapshot of the cash-report tables, remember it as the "last backup",
// and trigger a browser download. Used as a safety backup before cash-module seeds.
export async function downloadCashReportBackup(officeId?: string | null): Promise<{ tables: number; rows: number }> {
  const payload = await buildCashReportSnapshot(officeId);
  const total = Object.values(payload.tables).reduce((s, r) => s + r.length, 0);
  try { localStorage.setItem(LAST_SNAPSHOT_KEY, JSON.stringify(payload)); } catch { /* too large for localStorage — file download still works */ }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cash-report-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { tables: CASH_REPORT_TABLES.length, rows: total };
}

export function getLastSnapshot(): CashSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as CashSnapshot) : null;
  } catch { return null; }
}

export type RestoreResult = {
  restored: { table: string; rows: number; failed: number }[];
  totalRestored: number;
  verification: CashCountRow[];
  verified: boolean; // every restored table's count >= snapshot row count
};

// Restore a snapshot by upserting rows back (by id), then re-count to verify.
export async function restoreCashReportBackup(snapshot: CashSnapshot): Promise<RestoreResult> {
  const restored: RestoreResult["restored"] = [];
  for (const table of CASH_REPORT_TABLES) {
    const rows = snapshot.tables?.[table] ?? [];
    let failed = 0;
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500);
        const { error } = await sb.from(table).upsert(slice, { onConflict: "id" });
        if (error) failed += slice.length;
      }
    }
    restored.push({ table, rows: rows.length, failed });
  }
  const verification = await fetchCashReportCounts(snapshot.officeId);
  const verified = CASH_REPORT_TABLES.every((table) => {
    const want = (snapshot.tables?.[table] ?? []).length;
    const got = verification.find((v) => v.table === table)?.count ?? 0;
    return got >= want;
  });
  return {
    restored,
    totalRestored: restored.reduce((s, r) => s + (r.rows - r.failed), 0),
    verification,
    verified,
  };
}

