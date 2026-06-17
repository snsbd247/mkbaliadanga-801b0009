// Pure helpers for the combined/irrigation receipt edit flow.
// These are server-authoritative formulas mirrored on the client so we can:
//  1) show a recalculated preview (section totals + due/paid) before saving, and
//  2) run a save-time consistency check that blocks saving when the recalculated
//     due/paid totals don't agree across invoice, allocation, and payment rows.

export type EditBaseline = {
  payable_amount: number;
  due_amount: number;
  paid_amount: number;
  delay_fee: number;
  amount: number; // payment / allocation amount before edit
};

export type EditInput = {
  delay_fee: number; // new penalty
  amount: number; // new payment amount
};

export type EditPreview = {
  payable: number;
  due: number;
  paid: number;
  status: "unpaid" | "partial" | "paid";
  feeDiff: number;
  amountDiff: number;
};

const n = (v: unknown) => Number(v || 0);

/** Recalculate invoice payable/due/paid from a baseline + the edited values. */
export function previewEdit(base: EditBaseline, input: EditInput): EditPreview {
  const feeDiff = Math.round(n(input.delay_fee)) - Math.round(n(base.delay_fee));
  const amountDiff = Math.round(n(input.amount)) - Math.round(n(base.amount));
  const payable = n(base.payable_amount) + feeDiff;
  const due = Math.max(0, n(base.due_amount) + feeDiff - amountDiff);
  const paid = Math.max(0, n(base.paid_amount) + amountDiff);
  const status: EditPreview["status"] = paid <= 0 ? "unpaid" : paid >= payable ? "paid" : "partial";
  return { payable, due, paid, status, feeDiff, amountDiff };
}

export type ConsistencySnapshot = {
  invoicePaid: number;
  allocationAmount: number;
  paymentAmount: number;
  payable: number;
  due: number;
};

export type ConsistencyResult = { ok: boolean; errors: string[] };

/**
 * Save-time consistency check. The payment amount, the allocation amount and the
 * invoice's applied paid delta must agree, and payable must equal paid + due.
 * Returns the list of mismatches (empty when consistent).
 */
export function checkConsistency(s: ConsistencySnapshot): ConsistencyResult {
  const errors: string[] = [];
  const eq = (a: number, b: number) => Math.abs(n(a) - n(b)) < 0.01;
  if (!eq(s.paymentAmount, s.allocationAmount)) {
    errors.push("Payment amount and allocation amount do not match");
  }
  if (!eq(s.payable, s.invoicePaid + s.due)) {
    errors.push("Invoice payable does not equal paid + due");
  }
  if (s.invoicePaid < 0 || s.due < 0 || s.paymentAmount < 0) {
    errors.push("Negative due/paid/amount is not allowed");
  }
  return { ok: errors.length === 0, errors };
}
