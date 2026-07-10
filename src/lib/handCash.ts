// Shared Hand Cash (Irrigation cash) calculation.
// Used by both the Dashboard "Hand Cash" card and the Cash Book
// "Irrigation cash" stream so the two always agree for the same inputs.

// Receipt kinds that feed the irrigation cash stream (income side).
export const IRRIGATION_INCOME_KINDS = new Set([
  "irrigation",
  "bigha_rent",
  "pond",
  "crop_sale",
  "scrap",
]);

export type HandCashReceipt = { kind?: string | null; amount?: number | null; receipt_no?: string | null };
export type HandCashPayment = {
  amount?: number | null;
  receipt_no?: string | null;
  kind?: string | null;
  status?: string | null;
};
export type HandCashExpense = { amount?: number | null };

export interface HandCashInput {
  receipts: HandCashReceipt[];
  /** Approved irrigation payments (used only when they carry a receipt_no not already in `receipts`). */
  payments?: HandCashPayment[];
  /** Irrigation-stream expenses (already filtered to stream = "irrigation"). */
  expenses: HandCashExpense[];
  /** Opening balance carried into the period (defaults to 0). */
  opening?: number;
}

export interface HandCashResult {
  receiptIncome: number;
  paymentIncome: number;
  income: number;
  expense: number;
  opening: number;
  closing: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const sum = (arr: { amount?: number | null }[]) => arr.reduce((s, x) => s + n(x.amount), 0);

/**
 * Compute the irrigation hand-cash figures from raw rows.
 * closing = opening + (receiptIncome + paymentIncome) - expense
 */
export function computeHandCash(input: HandCashInput): HandCashResult {
  const { receipts, payments = [], expenses, opening = 0 } = input;

  const receiptNos = new Set(
    receipts.map((r) => String(r.receipt_no ?? "")).filter(Boolean),
  );

  const receiptIncome = sum(receipts.filter((r) => IRRIGATION_INCOME_KINDS.has(String(r.kind ?? ""))));

  // Approved irrigation payments that have a receipt_no not already represented
  // by a receipts row (avoids double counting).
  const paymentIncome = sum(
    payments.filter(
      (p) =>
        String(p.kind ?? "irrigation") === "irrigation" &&
        String(p.status ?? "approved") === "approved" &&
        p.receipt_no &&
        !receiptNos.has(String(p.receipt_no)),
    ),
  );

  const expense = sum(expenses);
  const income = receiptIncome + paymentIncome;
  const open = n(opening);

  return {
    receiptIncome,
    paymentIncome,
    income,
    expense,
    opening: open,
    closing: open + income - expense,
  };
}
