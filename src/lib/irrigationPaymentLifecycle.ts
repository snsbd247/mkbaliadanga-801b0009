/**
 * ধাপ ৬ — Payment, Approval, Edit/Cancel
 *
 * Pure state machine for the irrigation payment lifecycle so submit / approve /
 * edit / cancel rules can be unit-tested without a database.
 *
 * States: pending → approved → (cancelled)
 *                 ↘ cancelled
 *  - pending  : just submitted, editable, awaiting approval.
 *  - approved : posted to the ledger; only cancellable (not freely editable).
 *  - cancelled: void; no further transitions.
 */
export type PaymentStatus = "pending" | "approved" | "cancelled";

export interface PaymentRecord {
  id: string;
  amount: number;
  status: PaymentStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export interface ActionResult {
  ok: boolean;
  /** Bilingual error when ok === false. */
  error?: { en: string; bn: string };
  record?: PaymentRecord;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};
const fail = (en: string, bn: string): ActionResult => ({ ok: false, error: { en, bn } });

/** Approve a pending payment. Only super/approver roles should call this. */
export function approvePayment(p: PaymentRecord, actorId: string, when = new Date().toISOString()): ActionResult {
  if (p.status === "approved") return fail("Payment is already approved.", "পেমেন্ট ইতিমধ্যে অনুমোদিত।");
  if (p.status === "cancelled") return fail("Cancelled payments cannot be approved.", "বাতিল পেমেন্ট অনুমোদন করা যায় না।");
  return { ok: true, record: { ...p, status: "approved", approved_by: actorId, approved_at: when } };
}

/** Edit the amount. Allowed only while pending. */
export function editPayment(p: PaymentRecord, newAmount: number): ActionResult {
  if (p.status !== "pending")
    return fail("Only pending payments can be edited.", "শুধু অপেক্ষমাণ পেমেন্ট সম্পাদনা করা যায়।");
  const amt = num(newAmount);
  if (amt <= 0) return fail("Amount must be greater than zero.", "পরিমাণ শূন্যের বেশি হতে হবে।");
  return { ok: true, record: { ...p, amount: Math.round(amt * 100) / 100 } };
}

/** Cancel a payment. Pending or approved can be cancelled; cancelled cannot. */
export function cancelPayment(p: PaymentRecord, actorId: string, reason: string, when = new Date().toISOString()): ActionResult {
  if (p.status === "cancelled") return fail("Payment is already cancelled.", "পেমেন্ট ইতিমধ্যে বাতিল।");
  if (!reason?.trim()) return fail("A cancellation reason is required.", "বাতিলের কারণ আবশ্যক।");
  return {
    ok: true,
    record: { ...p, status: "cancelled", cancelled_by: actorId, cancelled_at: when, cancel_reason: reason.trim() },
  };
}

/** Whether a record currently counts toward paid totals. */
export const isLivePayment = (p: PaymentRecord): boolean => p.status !== "cancelled";
