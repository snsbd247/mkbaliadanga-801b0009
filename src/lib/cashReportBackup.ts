// Shared helpers for the cash-report demo workflow:
//  - listing the tables that feed Cash Book / Hand Cash / Cash Statement reports
//  - counting their rows (post-seed validation)
//  - taking a JSON snapshot backup of just those tables before seeding
// Kept side-effect-light so the count/flag logic can be unit-tested.
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

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

// Take a JSON snapshot of the cash-report tables and trigger a browser download.
// Used as an automatic safety backup before running cash-module demo seeds.
export async function downloadCashReportBackup(officeId?: string | null): Promise<{ tables: number; rows: number }> {
  const snapshot: Record<string, any[]> = {};
  let total = 0;
  for (const table of CASH_REPORT_TABLES) {
    const rows = await fetchAll(table, officeId);
    snapshot[table] = rows;
    total += rows.length;
  }
  const payload = { kind: "cash-report-backup", created_at: new Date().toISOString(), officeId: officeId ?? null, tables: snapshot };
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
