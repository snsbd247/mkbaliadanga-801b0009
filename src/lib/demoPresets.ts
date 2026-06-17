// Demo import presets + post-import verification config.
// Shared by DemoManager UI and unit tests. The edge function inlines the
// same shape (Deno isolation), so changes here MUST be mirrored in
// supabase/functions/demo-reset/index.ts (POST_IMPORT_VERIFY + PRESETS).

export type DemoModule =
  | "locations" | "settings" | "accounting" | "farmers"
  | "irrigation" | "loans" | "savings" | "expenses"
  | "bank" | "cashbook" | "assets";

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
  "irrigation", "loans", "savings", "expenses", "bank", "assets",
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
    id: "year_ops", label_en: "Full 1-Year Operational Demo (everything)", label_bn: "১ বছরের পূর্ণ অপারেশনাল ডেমো (সব কিছু)",
    size: 50, modules: ALL_MODULES, monthsBack: 12,
    description_en: "Full year of monthly savings, expenses, bank txns, payments, loan installments, irrigation invoices + assets module: purchases, monthly depreciation schedule, maintenance, movements & a disposal — produces realistic year-end reports.",
    description_bn: "১২ মাসের মাসিক সঞ্চয়, খরচ, ব্যাংক লেনদেন, পেমেন্ট, ঋণ কিস্তি, সেচ ইনভয়েস + অ্যাসেট মডিউলের সব কিছু: ক্রয়, মাসিক অবচয়, রক্ষণাবেক্ষণ, মুভমেন্ট ও ডিসপোজাল — বাস্তবসম্মত বার্ষিক রিপোর্ট তৈরি করে।",
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
  {
    id: "recent_features", label_en: "Recent Features Showcase (May 2026)",
    label_bn: "সাম্প্রতিক ফিচার ডেমো (মে ২০২৬)",
    size: 25, modules: ALL_MODULES, monthsBack: 2,
    description_en: "Small dataset with Hawlat/Bank irrigation payments, multi-loan members, QR-verifiable receipts and combined payment samples.",
    description_bn: "ছোট ডেটাসেট — Hawlat/Bank সেচ পেমেন্ট, multi-loan member, QR-verify রসিদ ও combined payment স্যাম্পল।",
  },
  {
    id: "patwari_workflow", label_en: "Patwari Workflow Demo",
    label_bn: "পাটোয়ারী ওয়ার্কফ্লো ডেমো",
    size: 40, modules: ["locations", "settings", "accounting", "farmers", "irrigation"], monthsBack: 3,
    description_en: "Focused dataset with 10 patwaris mapped to mouzas, 40 farmers with lands and 3 months of irrigation invoices — ideal for testing patwari/land/irrigation reports.",
    description_bn: "১০ জন পাটোয়ারী মৌজার সাথে ম্যাপ করা, ৪০ ফার্মার জমিসহ এবং ৩ মাসের সেচ ইনভয়েস — পাটোয়ারী/জমি/সেচ রিপোর্ট টেস্টের জন্য আদর্শ।",
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
    { table: "farmers",                page: "/farmers",   page_label: "Farmers", required: true },
    { table: "lands",                  page: "/farmers",   page_label: "Farmers (Lands)", required: true },
    { table: "patwaris",               page: "/admin/patwaris", page_label: "Patwaris", required: false },
    { table: "land_relations",         page: "/farmers",   page_label: "Farmers (Borga)", required: false },
    { table: "land_history",           page: "/land-history", page_label: "ভূমির ইতিহাস (Land History)", required: false },
    { table: "voter_audit_logs",       page: "/voter-history", page_label: "Voter Cancel/Reactivate History", required: false },
    { table: "public_payment_intents", page: "/admin/public-payments", page_label: "পাবলিক পেমেন্ট অনুরোধ", required: false },
  ],
  irrigation: [
    { table: "irrigation_charge_settings", page: "/irrigation-rates",    page_label: "Irrigation Rates", required: true },
    { table: "irrigation_season_rates",    page: "/irrigation-rates",    page_label: "Irrigation Rates", required: true },
    { table: "irrigation_invoices",        page: "/irrigation-invoices", page_label: "Irrigation Invoices", required: true },
    { table: "seasons",                    page: "/seasons",             page_label: "Seasons", required: true },
  ],
  loans: [
    { table: "loan_plans",                page: "/loan-plans", page_label: "Loan Plans", required: true },
    { table: "loan_delay_fee_settings",   page: "/admin/loan-delay-settings", page_label: "Loan Installment Penalty Settings", required: true },
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
  bank: [
    { table: "bank_accounts",      page: "/banking", page_label: "Bank Accounts",     required: true },
    { table: "bank_transactions",  page: "/banking", page_label: "Bank Transactions", required: true },
  ],
  cashbook: [
    { table: "receipts",              page: "/cashbook",  page_label: "Cash Book (Receipts)",  required: true },
    { table: "office_incomes",        page: "/cashbook",  page_label: "Office Incomes",        required: true },
    { table: "cashbook_submissions",  page: "/cashbook",  page_label: "Cash Book Submissions", required: false },
    { table: "hand_cash_submissions", page: "/hand-cash", page_label: "Hand Cash",             required: false },
  ],
  assets: [
    { table: "asset_categories",            page: "/assets/categories",    page_label: "Asset Categories",      required: true },
    { table: "assets",                      page: "/assets",               page_label: "Asset Registry",        required: true },
    { table: "asset_stocks",                page: "/assets/stocks",        page_label: "Asset Stock",           required: true },
    { table: "asset_purchases",             page: "/assets/purchases",     page_label: "Asset Purchases",       required: true },
    { table: "asset_installations",         page: "/assets/installations", page_label: "Asset Installations",   required: false },
    { table: "asset_movements",             page: "/assets/movements",     page_label: "Asset Movements",       required: false },
    { table: "asset_maintenance_logs",      page: "/assets/maintenance",   page_label: "Asset Maintenance",     required: false },
    { table: "asset_maintenance_schedules", page: "/assets/maintenance",   page_label: "Maintenance Schedules", required: false },
    { table: "asset_depreciation_settings", page: "/assets/depreciation",  page_label: "Depreciation Setup",    required: false },
    { table: "asset_depreciation_schedule", page: "/assets/depreciation",  page_label: "Depreciation Schedule", required: false },
    { table: "asset_disposals",             page: "/assets/disposals",     page_label: "Asset Disposals",       required: false },
    { table: "asset_alerts",                page: "/assets/alerts",        page_label: "Asset Alerts",          required: false },
    { table: "asset_damage_reports",        page: "/assets",               page_label: "Damage Reports",        required: false },
    { table: "asset_scan_logs",             page: "/assets/scan-history",  page_label: "Scan History",          required: false },
    { table: "asset_audit_logs",            page: "/assets",               page_label: "Asset Audit Logs",      required: false },
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
