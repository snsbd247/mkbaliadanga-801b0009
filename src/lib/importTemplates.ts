// CSV template generator for the universal importer.
// Returns a CSV string with a comment header (instructions) + columns + 1 sample row.

type Tpl = { columns: string[]; sample: Record<string, any>; instructions?: string };

const TEMPLATES: Record<string, Tpl> = {
  lands: {
    columns: ["account_number", "dag_no", "land_size", "land_size_unit", "owner_type", "field_type", "mouza"],
    sample: { account_number: "10001", dag_no: "123, 124/A, 125-B", land_size: 33, land_size_unit: "shotok", owner_type: "owner", field_type: "medium_land", mouza: "Mouza A" },
    instructions: "land_size stored as শতক (shotok). land_size_unit = shotok|katha|bigha|acre (default shotok); katha/bigha/acre auto-converted (1 বিঘা=33 শতক=20 কাঠা, 1 একর≈100 শতক). dag_no can hold multiple dag numbers per land — comma separated, canonical format like \"123, 124/A, 125-B\" (only digits/letters/'/'/'-' allowed). owner_type = owner|borgadar. field_type = high_land|medium_land|low_land.",
  },
  land_relations: {
    columns: ["owner_account_number", "tenant_account_number", "dag_no", "share_percentage", "valid_from", "valid_to", "note"],
    sample: { owner_account_number: "10001", tenant_account_number: "10002", dag_no: "123, 124/A", share_percentage: 50, valid_from: "2026-01-01", valid_to: "", note: "" },
    instructions: "dag_no must EXACTLY match the owner's land record (canonical comma-separated form, e.g. \"123, 124/A\"). share_percentage 0-100. valid_to optional.",
  },
  payments: {
    columns: ["account_number", "kind", "amount", "method", "note"],
    sample: { account_number: "10001", kind: "savings", amount: 500, method: "cash", note: "Monthly" },
    instructions: "kind = savings | loan | irrigation. method = cash | bkash | bank.",
  },
  irrigation: {
    columns: ["account_number","dag_no","season_year","season_type","quantity","base_charge","canal_charge","maintenance_charge","other_charge","previous_due_brought","penalty_amount","entry_date","note"],
    sample: { account_number: "10001", dag_no: "123, 124/A", season_year: 2026, season_type: "boro", quantity: 0.33, base_charge: 200, canal_charge: 50, maintenance_charge: 20, other_charge: 0, previous_due_brought: 0, penalty_amount: 0, entry_date: "2026-02-01", note: "" },
    instructions: "season_type = boro | aman | aus. dag_no must already exist for that farmer (canonical comma-separated form supported, e.g. \"123, 124/A\").",
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
  shares: {
    columns: ["account_number", "balance"],
    sample: { account_number: "10001", balance: 500 },
    instructions: "Sets share capital balance per farmer (one row per farmer). Existing balance is overwritten.",
  },
  loans: {
    columns: ["account_number", "principal", "interest_rate", "total_payable", "issued_on", "note"],
    sample: { account_number: "10001", principal: 10000, interest_rate: 12, total_payable: 11200, issued_on: "2026-01-15", note: "Crop loan" },
    instructions: "Creates an approved loan per row. interest_rate in percent (0-100). total_payable optional (defaults to principal).",
  },
  loan_payments: {
    columns: ["account_number", "amount", "paid_on", "note"],
    sample: { account_number: "10001", amount: 1000, paid_on: "2026-02-15", note: "1st installment" },
    instructions: "Applied to the farmer's most recent active/approved loan. Use Loan module to create the loan first.",
  },
  loan_installments: {
    columns: ["account_number", "installment_no", "due_date", "amount", "status"],
    sample: { account_number: "10001", installment_no: 1, due_date: "2026-02-15", amount: 1000, status: "due" },
    instructions: "status = due | paid | missed | partial. installment_no starts at 1.",
  },
  savings: {
    columns: ["account_number", "type", "amount", "txn_date", "note"],
    sample: { account_number: "10001", type: "deposit", amount: 500, txn_date: "2026-02-01", note: "Monthly deposit" },
    instructions: "type = deposit | withdrawal. All rows are inserted as approved.",
  },
  ledger: {
    columns: ["entry_date", "account_code", "debit", "credit", "description", "reference_type"],
    sample: { entry_date: "2026-02-01", account_code: "1010", debit: 500, credit: 0, description: "Cash adjustment", reference_type: "manual" },
    instructions: "Super-admin only. account_code must exist in Chart of Accounts. Provide debit OR credit (not both zero).",
  },
  patwaris: {
    columns: ["name", "name_bn", "mobile", "nid", "address", "mouza", "note"],
    sample: { name: "Md. Rahim", name_bn: "মোঃ রহিম", mobile: "01700000000", nid: "1234567890", address: "Village A", mouza: "Mouza A", note: "" },
    instructions: "Bulk-add patwaris. mouza is matched by name to an existing mouza (optional). Patwaris are created as active.",
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
