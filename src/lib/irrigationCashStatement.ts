// Pure helpers for the Irrigation Cash Statement (সেচ জমা খরচ হিসাব) report.
// Kept side-effect free so totals can be verified end-to-end against backend rows.

export const IRRIGATION_PAYMENT_KINDS = new Set(["irrigation", "bigha_rent", "pond", "crop_sale", "scrap"]);

type ReportLang = "en" | "bn";

export const KIND_LABEL: Record<string, Record<ReportLang, string>> = {
  irrigation: { en: "Irrigation charge collection (including due)", bn: "সেচ চার্জ আদায় (বকেয়া সহ)" },
  bigha_rent: { en: "Bigha rent sale", bn: "ভাড়ী বিক্রয়" },
  pond: { en: "Pond / vegetable income", bn: "পুকুর, সবজি আয়" },
  crop_sale: { en: "Crop sale", bn: "ফসল বিক্রয়" },
  scrap: { en: "Scrap sale", bn: "ভাঙ্গারি বিক্রয়" },
};

export const OFFICE_INCOME_LABEL: Record<string, Record<ReportLang, string>> = {
  scrap: { en: "Scrap sale", bn: "ভাঙ্গারি বিক্রয়" },
  hawlat: { en: "Loan received", bn: "হাওলাত গ্রহণ" },
  grant: { en: "Grant", bn: "অনুদান" },
  other: { en: "Miscellaneous income", bn: "বিবিধ আয়" },
};

export type Line = { label: string; amount: number };

export type IncomeRow = { kind?: string; income_type?: string; stream?: string; amount: number | string };
export type ExpenseRow = { stream?: string; head?: string | null; amount: number | string };

export type StatementTotals = {
  incomeLines: Line[];
  expenseLines: Line[];
  totalIncome: number;
  totalExpense: number;
  openingFund: number;
  grandIncome: number;   // মোট আয় + আগত তহবিল
  closingFund: number;   // হস্তমজুদ তহবিল
  grandExpense: number;  // মোট ব্যয় + হস্তমজুদ = সর্বমোট
};

export function computeStatement(
  income: IncomeRow[],
  expenses: ExpenseRow[],
  opening = 0,
  lang: ReportLang = "bn",
): StatementTotals {
  const incMap = new Map<string, number>();
  let totalIncome = 0;
  for (const r of income) {
    const amt = Number(r.amount || 0);
    let label: string | null = null;
    if (r.income_type !== undefined || r.stream === "sech") {
      label = OFFICE_INCOME_LABEL[r.income_type ?? ""]?.[lang] ?? (lang === "bn" ? "বিবিধ আয়" : "Miscellaneous income");
    } else if (r.kind && IRRIGATION_PAYMENT_KINDS.has(r.kind)) {
      label = KIND_LABEL[r.kind]?.[lang] ?? r.kind;
    }
    if (!label) continue;
    incMap.set(label, (incMap.get(label) ?? 0) + amt);
    totalIncome += amt;
  }

  const expMap = new Map<string, number>();
  let totalExpense = 0;
  for (const e of expenses) {
    if (e.stream !== "irrigation") continue;
    const amt = Number(e.amount || 0);
    const label = e.head || (lang === "bn" ? "বিবিধ খরচ" : "Miscellaneous expense");
    expMap.set(label, (expMap.get(label) ?? 0) + amt);
    totalExpense += amt;
  }

  const openingFund = Number(opening || 0);
  const grandIncome = totalIncome + openingFund;
  const closingFund = grandIncome - totalExpense;
  const grandExpense = totalExpense + closingFund;

  return {
    incomeLines: Array.from(incMap, ([label, amount]) => ({ label, amount })),
    expenseLines: Array.from(expMap, ([label, amount]) => ({ label, amount })),
    totalIncome,
    totalExpense,
    openingFund,
    grandIncome,
    closingFund,
    grandExpense,
  };
}

// Drill-down URL builders. Income always scopes to irrigation payments and
// expense always scopes to the irrigation stream, for the selected range.
export function incomeDrillDownUrl(from: string, to: string): string {
  const p = new URLSearchParams({ kind: "irrigation", from, to });
  return `/payments?${p.toString()}`;
}

export function expenseDrillDownUrl(from: string, to: string): string {
  const p = new URLSearchParams({ stream: "irrigation", from, to });
  return `/reports/expenses?${p.toString()}`;
}
