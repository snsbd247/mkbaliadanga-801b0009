/**
 * Pure reconciliation between the three places an irrigation payment must land:
 *   1. payments                     — the money received (source of truth)
 *   2. receipts (kind: irrigation)  — the Cash Book income stream
 *   3. journal_entries              — the double-entry Accounts posting
 *
 * For every payment we check whether a matching Cash Book receipt row and a
 * matching journal entry exist and agree on the amount. Any mismatch is a
 * discrepancy the admin must repair (or auto-retry can re-post).
 */

export interface ReconPayment {
  id: string;
  receipt_no?: string | null;
  amount?: number | null;
  office_id?: string | null;
  created_at?: string | null;
}

export interface ReconReceipt {
  receipt_no?: string | null;
  reference_id?: string | null;
  amount?: number | null;
}

export interface ReconJournal {
  reference?: string | null;
  total_debit?: number | null;
  total_credit?: number | null;
}

export type PostingState = "ok" | "missing" | "amount_mismatch" | "unbalanced";

export interface PaymentReconRow {
  payment_id: string;
  receipt_no: string;
  amount: number;
  cashbook: PostingState;
  cashbook_amount: number | null;
  journal: PostingState;
  journal_debit: number | null;
  journal_credit: number | null;
  ok: boolean;
}

export interface PostingReconResult {
  rows: PaymentReconRow[];
  totalPayments: number;
  totalPaymentAmount: number;
  cashbookOk: number;
  journalOk: number;
  discrepancies: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

const eq = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Stable journal reference the payment panel writes: `IRR-PAY-<first 8 of payment id>`. */
export const journalRefForPayment = (paymentId: string) => `IRR-PAY-${paymentId.slice(0, 8)}`;

export function reconcilePostings(
  payments: ReconPayment[],
  receipts: ReconReceipt[],
  journals: ReconJournal[],
): PostingReconResult {
  const receiptByNo = new Map<string, ReconReceipt>();
  for (const r of receipts) {
    if (r.receipt_no) receiptByNo.set(String(r.receipt_no), r);
  }
  const journalByRef = new Map<string, ReconJournal>();
  for (const j of journals) {
    if (j.reference) journalByRef.set(String(j.reference), j);
  }

  const rows: PaymentReconRow[] = payments.map((p) => {
    const amount = num(p.amount);
    const receiptNo = String(p.receipt_no ?? "");

    // Cash Book state
    const rec = receiptNo ? receiptByNo.get(receiptNo) : undefined;
    let cashbook: PostingState = "ok";
    const cashbookAmount = rec ? num(rec.amount) : null;
    if (!rec) cashbook = "missing";
    else if (!eq(num(rec.amount), amount)) cashbook = "amount_mismatch";

    // Journal state
    const jr = journalByRef.get(journalRefForPayment(p.id));
    let journal: PostingState = "ok";
    let debit: number | null = null;
    let credit: number | null = null;
    if (!jr) journal = "missing";
    else {
      debit = num(jr.total_debit);
      credit = num(jr.total_credit);
      if (!eq(debit, credit)) journal = "unbalanced";
      else if (!eq(debit, amount)) journal = "amount_mismatch";
    }

    const ok = cashbook === "ok" && journal === "ok";
    return {
      payment_id: p.id,
      receipt_no: receiptNo || p.id.slice(0, 8),
      amount,
      cashbook,
      cashbook_amount: cashbookAmount,
      journal,
      journal_debit: debit,
      journal_credit: credit,
      ok,
    };
  });

  return {
    rows,
    totalPayments: rows.length,
    totalPaymentAmount: rows.reduce((s, r) => s + r.amount, 0),
    cashbookOk: rows.filter((r) => r.cashbook === "ok").length,
    journalOk: rows.filter((r) => r.journal === "ok").length,
    discrepancies: rows.filter((r) => !r.ok).length,
  };
}
