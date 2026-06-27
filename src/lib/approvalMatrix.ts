/**
 * অগ্রাধিকার ৫ — Approval Matrix
 *
 * Single source of truth for which money-movements need committee approval.
 *
 * Rule:
 *  - Collections (money IN) are approval-free → auto "approved".
 *      • irrigation charge collection
 *      • savings deposit
 *      • share collection
 *      • loan repayment (installment collection)
 *  - Payouts / liabilities (money OUT or new debt) require approval → "pending".
 *      • savings withdrawal
 *      • loan disbursement (new loan)
 *      • office payment / office payout / expense
 */

export type ApprovalFlow =
  | "irrigation_collection"
  | "savings_deposit"
  | "share_collection"
  | "loan_repayment"
  | "savings_withdrawal"
  | "loan_disbursement"
  | "office_payout";

const APPROVAL_FREE: ReadonlySet<ApprovalFlow> = new Set<ApprovalFlow>([
  "irrigation_collection",
  "savings_deposit",
  "share_collection",
  "loan_repayment",
]);

/** Whether a money-movement flow needs committee approval before it posts. */
export function requiresApproval(flow: ApprovalFlow): boolean {
  return !APPROVAL_FREE.has(flow);
}

/** Initial status to stamp on a record for a given flow. */
export function initialStatus(flow: ApprovalFlow): "pending" | "approved" {
  return requiresApproval(flow) ? "pending" : "approved";
}

/**
 * Map a `payments` row (kind = loan | savings | irrigation) to its flow.
 * `payments` only ever holds collections, so all of them are approval-free.
 */
export function paymentFlow(kind: "loan" | "savings" | "irrigation"): ApprovalFlow {
  switch (kind) {
    case "irrigation":
      return "irrigation_collection";
    case "savings":
      return "savings_deposit";
    case "loan":
      return "loan_repayment";
  }
}

/** Convenience: initial status for a `payments` insert by kind. */
export function paymentInitialStatus(kind: "loan" | "savings" | "irrigation"): "pending" | "approved" {
  return initialStatus(paymentFlow(kind));
}
