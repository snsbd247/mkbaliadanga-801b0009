// Demo import presets + post-import verification config.
// Shared by DemoManager UI and unit tests. The edge function inlines the
// same shape (Deno isolation), so changes here MUST be mirrored in
// supabase/functions/demo-reset/index.ts (POST_IMPORT_VERIFY + PRESETS).

export type DemoModule =
  | "locations" | "settings" | "accounting" | "farmers"
  | "irrigation" | "loans" | "savings" | "expenses";

export type DemoPreset = {
  id: string;
  label_en: string;
  label_bn: string;
  size: number;
  modules: DemoModule[];
  description_en: string;
  description_bn: string;
  monthsBack?: number;   // spread operational rows across last N months
};


export const ALL_MODULES: DemoModule[] = [
  "locations", "settings", "accounting", "farmers",
  "irrigation", "loans", "savings", "expenses",
];

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "small", label_en: "Small (25 farmers)", label_bn: "ছোট (২৫ ফার্মার)",
    size: 25, modules: ALL_MODULES,
    description_en: "Quick test seed — all modules, 25 farmers",
    description_bn: "দ্রুত টেস্ট seed — সব মডিউল, ২৫ ফার্মার",
  },
  {
    id: "medium", label_en: "Medium (50 farmers)", label_bn: "মাঝারি (৫০ ফার্মার)",
    size: 50, modules: ALL_MODULES,
    description_en: "Default — all modules, 50 farmers",
    description_bn: "ডিফল্ট — সব মডিউল, ৫০ ফার্মার",
  },
  {
    id: "large", label_en: "Large (200 farmers)", label_bn: "বড় (২০০ ফার্মার)",
    size: 200, modules: ALL_MODULES,
    description_en: "Performance test — all modules, 200 farmers",
    description_bn: "পারফরম্যান্স টেস্ট — সব মডিউল, ২০০ ফার্মার",
  },
  {
    id: "loans_only", label_en: "Loans Only", label_bn: "শুধু ঋণ",
    size: 50, modules: ["locations", "settings", "accounting", "farmers", "loans"],
    description_en: "Farmers + loans only (no irrigation/savings)",
    description_bn: "শুধু ফার্মার + ঋণ (সেচ/সঞ্চয় বাদে)",
  },
  {
    id: "savings_only", label_en: "Savings Only", label_bn: "শুধু সঞ্চয়",
    size: 50, modules: ["locations", "settings", "accounting", "farmers", "savings"],
    description_en: "Farmers + savings only (no irrigation/loans)",
    description_bn: "শুধু ফার্মার + সঞ্চয় (সেচ/ঋণ বাদে)",
  },
  {
    id: "irrigation_only", label_en: "Irrigation Only", label_bn: "শুধু সেচ",
    size: 50, modules: ["locations", "settings", "accounting", "farmers", "irrigation"],
    description_en: "Farmers + irrigation only (no loans/savings)",
    description_bn: "শুধু ফার্মার + সেচ (ঋণ/সঞ্চয় বাদে)",
  },
];

// (table, page route, expected min rows when module selected)
export type ModuleVerifyEntry = {
  table: string;
  page: string;          // app route where data is visible
  page_label: string;
  required: boolean;     // if true and 0 rows -> fail; else warn
};

export const MODULE_VERIFY: Record<DemoModule, ModuleVerifyEntry[]> = {
  locations: [
    { table: "divisions", page: "/locations", page_label: "Locations", required: true },
    { table: "districts", page: "/locations", page_label: "Locations", required: true },
    { table: "upazilas",  page: "/locations", page_label: "Locations", required: true },
    { table: "mouzas",    page: "/locations", page_label: "Locations", required: true },
  ],
  settings: [
    { table: "company_settings",  page: "/settings", page_label: "Settings", required: true },
    { table: "card_settings",     page: "/card-designer", page_label: "Card Designer", required: false },
  ],
  accounting: [
    { table: "accounts",           page: "/accounts",      page_label: "Chart of Accounts", required: true },
    { table: "accounting_periods", page: "/period-close",  page_label: "Period Close", required: true },
  ],
  farmers: [
    { table: "farmers",        page: "/farmers",   page_label: "Farmers", required: true },
    { table: "lands",          page: "/farmers",   page_label: "Farmers (Lands)", required: true },
    { table: "patwaris",       page: "/admin/patwaris", page_label: "Patwaris", required: false },
    { table: "land_relations", page: "/farmers",   page_label: "Farmers (Borga)", required: false },
  ],
  irrigation: [
    { table: "irrigation_charge_settings", page: "/irrigation-rates",    page_label: "Irrigation Rates", required: true },
    { table: "irrigation_season_rates",    page: "/irrigation-rates",    page_label: "Irrigation Rates", required: true },
    { table: "irrigation_invoices",        page: "/irrigation-invoices", page_label: "Irrigation Invoices", required: true },
    { table: "seasons",                    page: "/seasons",             page_label: "Seasons", required: true },
  ],
  loans: [
    { table: "loan_plans",                page: "/loan-plans", page_label: "Loan Plans", required: true },
    { table: "loan_delay_fee_settings",   page: "/admin/loan-delay-settings", page_label: "Loan Delay Settings", required: true },
    { table: "loans",                     page: "/loans",      page_label: "Loans", required: true },
    { table: "loan_installments",         page: "/loans",      page_label: "Loans (Installments)", required: true },
    { table: "loan_payments",             page: "/loans",      page_label: "Loans (Payments)", required: false },
  ],
  savings: [
    { table: "savings_plans",         page: "/savings", page_label: "Savings", required: true },
    { table: "savings_transactions",  page: "/savings", page_label: "Savings (Tx)", required: true },
    { table: "shares",                page: "/share-collection", page_label: "Share Collection", required: false },
    { table: "farmer_savings_plans",  page: "/savings", page_label: "Savings (Plans)", required: false },
  ],
  expenses: [
    { table: "expenses", page: "/payments", page_label: "Payments / Expenses", required: true },
  ],
};

export function expectedTablesForModules(modules: string[]): ModuleVerifyEntry[] {
  const out: ModuleVerifyEntry[] = [];
  for (const m of modules) {
    const arr = MODULE_VERIFY[m as DemoModule];
    if (arr) out.push(...arr);
  }
  return out;
}

export type RowCountReportRow = ModuleVerifyEntry & {
  module: string;
  actual: number;
  status: "ok" | "empty_required" | "empty_optional";
};

/** Build the report given counts produced by the edge function. */
export function buildRowCountReport(
  modules: string[],
  counts: Record<string, number>,
): RowCountReportRow[] {
  const rows: RowCountReportRow[] = [];
  for (const m of modules) {
    const entries = MODULE_VERIFY[m as DemoModule];
    if (!entries) continue;
    for (const e of entries) {
      const actual = counts[e.table] ?? 0;
      const status: RowCountReportRow["status"] = actual > 0
        ? "ok"
        : e.required ? "empty_required" : "empty_optional";
      rows.push({ ...e, module: m, actual, status });
    }
  }
  return rows;
}

export function summarizeReport(rows: RowCountReportRow[]) {
  const total = rows.length;
  const ok = rows.filter((r) => r.status === "ok").length;
  const failed = rows.filter((r) => r.status === "empty_required").length;
  const warnings = rows.filter((r) => r.status === "empty_optional").length;
  return { total, ok, failed, warnings, allOk: failed === 0 };
}
