/**
 * ধাপ ৫ — Receipt, Paid History ও Receipt Number
 *
 * Pure helpers that, given the Step 4 generated invoices and a list of
 * payments, produce:
 *  1. A deterministic receipt number for a new payment (reuses the shared
 *     PREFIX-YYYYMMDD-XXXXXX format, or a monthly serial when provided).
 *  2. A reconciled paid-history ledger (running balance per payment).
 *  3. A receipt model (lines + totals) for printing / export.
 *
 * Guarantees:
 *  - Running balance never goes below zero and ends at (payable - total paid).
 *  - Receipt totals always equal the sum of their lines.
 */
import { autoReceiptNo, type ReceiptKind } from "./receiptNo";

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface PaidEntry {
  receipt_no?: string | null;
  amount: number;
  paid_at: string;
  method?: string | null;
}

export interface PaidHistoryRow extends PaidEntry {
  receipt_no: string;
  applied: number;
  balance_after: number;
}

/** Build a receipt number; prefers a supplied monthly serial, else auto-format. */
export function buildReceiptNo(
  supplied: string | null | undefined,
  kind: ReceiptKind,
  seed: string,
  when: Date = new Date(),
): string {
  const v = (supplied ?? "").trim();
  return v.length > 0 ? v.toUpperCase() : autoReceiptNo(kind, seed, when);
}

/**
 * Reconcile a chronological list of payments against a payable amount,
 * assigning a receipt number to any entry missing one and computing a
 * running balance that is clamped to [0, payable].
 */
export function buildPaidHistory(
  payable: number,
  payments: PaidEntry[],
  opts: { kind?: ReceiptKind; seed?: string } = {},
): PaidHistoryRow[] {
  const cap = Math.max(num(payable), 0);
  const kind = opts.kind ?? "IRR";
  const seed = opts.seed ?? "RCPT";
  const sorted = [...payments].sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1));
  let remaining = cap;
  return sorted.map((p, i) => {
    const wanted = Math.max(num(p.amount), 0);
    const applied = r2(Math.min(wanted, remaining));
    remaining = r2(Math.max(remaining - applied, 0));
    return {
      ...p,
      receipt_no: buildReceiptNo(p.receipt_no, kind, `${seed}-${i}`, new Date(p.paid_at)),
      amount: r2(wanted),
      applied,
      balance_after: remaining,
    };
  });
}

export interface ReceiptLine {
  label: string;
  amount: number;
}
export interface ReceiptModel {
  receipt_no: string;
  paid_at: string;
  method: string | null;
  lines: ReceiptLine[];
  total: number;
  payable: number;
  paid_to_date: number;
  balance_due: number;
}

/** Produce a printable receipt model for a single paid-history row. */
export function buildReceiptModel(
  row: PaidHistoryRow,
  payable: number,
  lines: ReceiptLine[] = [],
): ReceiptModel {
  const effLines = lines.length ? lines : [{ label: "সেচ চার্জ", amount: row.applied }];
  const total = r2(effLines.reduce((s, l) => s + num(l.amount), 0));
  const cap = Math.max(num(payable), 0);
  return {
    receipt_no: row.receipt_no,
    paid_at: row.paid_at,
    method: row.method ?? null,
    lines: effLines,
    total,
    payable: r2(cap),
    paid_to_date: r2(cap - row.balance_after),
    balance_due: r2(row.balance_after),
  };
}
