// Centralized i18n mapping for internal table / key names → UI labels.
// Use this everywhere instead of hardcoding raw table names like `shares`
// or `loans` in the UI or in Excel/PDF exports.

export type Lang = "en" | "bn";

const TABLE_LABELS: Record<string, { en: string; bn: string }> = {
  shares: { en: "Shares", bn: "শেয়ার" },
  loans: { en: "Loans", bn: "ঋণ" },
  loan_repayments: { en: "Loan Repayments", bn: "ঋণ পরিশোধ" },
  loan_payments: { en: "Loan Payments", bn: "ঋণ পেমেন্ট" },
  loan_installments: { en: "Loan Installments", bn: "ঋণ কিস্তি" },
  savings_accounts: { en: "Savings Accounts", bn: "সঞ্চয় হিসাব" },
  savings_transactions: { en: "Savings Transactions", bn: "সঞ্চয় লেনদেন" },
  lands: { en: "Lands", bn: "জমি" },
  land_relations: { en: "Land Relations", bn: "জমির সম্পর্ক" },
  irrigation_invoices: { en: "Irrigation Invoices", bn: "সেচ ইনভয়েস" },
  irrigation_invoice_payments: { en: "Irrigation Payments", bn: "সেচ পেমেন্ট" },
  irrigation_charges: { en: "Irrigation Charges", bn: "সেচ চার্জ" },
  payments: { en: "Payments", bn: "পেমেন্ট" },
  payment_allocations: { en: "Payment Allocations", bn: "পেমেন্ট বণ্টন" },
  journal_entries: { en: "Journal Entries", bn: "জার্নাল এন্ট্রি" },
  journal_entry_lines: { en: "Journal Lines", bn: "জার্নাল লাইন" },
  sms_logs: { en: "SMS Logs", bn: "এসএমএস লগ" },
  receipts: { en: "Receipts", bn: "রশিদ" },
  ledger_entries: { en: "Ledger Entries", bn: "লেজার এন্ট্রি" },
  expenses: { en: "Expenses", bn: "খরচ" },
};

/** Translate an internal table/key name to its UI label for the given language. */
export function tableLabel(key: string, lang: Lang = "bn"): string {
  const entry = TABLE_LABELS[key];
  if (!entry) return key;
  return lang === "bn" ? entry.bn : entry.en;
}

/** All known internal keys — handy for tests that guard against raw names. */
export const KNOWN_TABLE_KEYS = Object.keys(TABLE_LABELS);
