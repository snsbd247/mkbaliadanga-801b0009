// CSV template generator for the universal importer.
// Returns a CSV string with a comment header (instructions) + columns + 1 sample row.

type Tpl = { columns: string[]; sample: Record<string, any>; instructions?: string };

const TEMPLATES: Record<string, Tpl> = {
  payments: {
    columns: ["account_number", "kind", "amount", "method", "note"],
    sample: { account_number: "100000000001", kind: "savings", amount: 500, method: "cash", note: "Monthly" },
    instructions: "kind = savings | loan | irrigation. method = cash | bkash | bank.",
  },
  irrigation: {
    columns: ["account_number","dag_no","season_year","season_type","quantity","base_charge","canal_charge","maintenance_charge","other_charge","previous_due_brought","penalty_amount","entry_date","note"],
    sample: { account_number: "100000000001", dag_no: "123/A", season_year: 2026, season_type: "boro", quantity: 0.33, base_charge: 200, canal_charge: 50, maintenance_charge: 20, other_charge: 0, previous_due_brought: 0, penalty_amount: 0, entry_date: "2026-02-01", note: "" },
    instructions: "season_type = boro | aman | aus. dag_no must already exist for that farmer.",
  },
  cashbook_receipts: {
    columns: ["receipt_date", "kind", "account_number", "amount", "method", "note"],
    sample: { receipt_date: "2026-02-01", kind: "donation", account_number: "", amount: 1000, method: "cash", note: "" },
    instructions: "kind = irrigation|bigha_rent|pond|crop_sale|scrap|loan_taken|donation|savings_deposit|share|other. account_number optional.",
  },
  cashbook_expenses: {
    columns: ["expense_date", "head", "payee", "amount", "method", "note"],
    sample: { expense_date: "2026-02-01", head: "Office", payee: "Stationery", amount: 500, method: "cash", note: "" },
  },
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsvTemplate(module: keyof typeof TEMPLATES): string {
  const tpl = TEMPLATES[module];
  const header = tpl.columns.join(",");
  const sample = tpl.columns.map((c) => csvEscape((tpl.sample as any)[c])).join(",");
  const lines: string[] = [];
  if (tpl.instructions) lines.push(`# ${tpl.instructions}`);
  lines.push(header, sample);
  return lines.join("\n");
}

export function downloadCsvTemplate(module: keyof typeof TEMPLATES) {
  const csv = buildCsvTemplate(module);
  // Prepend UTF-8 BOM so Excel opens Bangla/Unicode CSV correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CSV_TEMPLATE_MODULES = Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[];
