import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

interface VoidOptions {
  actorId?: string | null;
  reason?: string;
}

/**
 * Void all payments received against a given irrigation invoice.
 *
 * - Collects payment ids from `irrigation_invoice_payments` (link table) and
 *   from `payment_allocations` (kind='irrigation', reference_id=invoiceId).
 * - Soft-voids each `payments` receipt (status='voided') so it disappears from
 *   the active receipt list while keeping an audit trail.
 * - Removes the `irrigation_invoice_payments` link rows.
 * - Writes an audit log entry per voided payment.
 *
 * Never throws — returns the number of payments voided.
 */
export async function voidPaymentsForInvoice(
  invoiceId: string,
  opts: VoidOptions = {},
): Promise<{ voided: number }> {
  const reason =
    opts.reason ?? "ইনভয়েস মুছে ফেলা/আনপেইড করার কারণে পেমেন্ট বাতিল";

  const ids = new Set<string>();

  // 1a. Link table
  const { data: linkRows } = await db
    .from("irrigation_invoice_payments" as any)
    .select("payment_id")
    .eq("invoice_id", invoiceId);
  for (const r of (linkRows ?? []) as any[]) {
    if (r?.payment_id) ids.add(r.payment_id);
  }

  // 1b. Payment allocations
  const { data: allocRows } = await db
    .from("payment_allocations" as any)
    .select("payment_id")
    .eq("kind", "irrigation")
    .eq("reference_id", invoiceId);
  for (const r of (allocRows ?? []) as any[]) {
    if (r?.payment_id) ids.add(r.payment_id);
  }

  let voided = 0;

  // 2. Void each payment receipt (skip already-voided ones).
  for (const pid of ids) {
    const { data: updated } = await db
      .from("payments" as any)
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: opts.actorId ?? null,
        void_reason: reason,
      } as any)
      .eq("id", pid)
      .is("voided_at", null)
      .select("id, office_id, receipt_no, amount");

    const row = (updated ?? [])[0] as any;
    if (row) {
      voided += 1;
      logAudit({
        module: "irrigation_payment",
        action_type: "void",
        office_id: row.office_id ?? null,
        reference_id: row.id,
        old_data: { status: "approved", invoice_id: invoiceId },
        new_data: { status: "voided", reason, receipt_no: row.receipt_no },
      });
    }
  }

  // 3. Remove link rows for this invoice.
  await db
    .from("irrigation_invoice_payments" as any)
    .delete()
    .eq("invoice_id", invoiceId);

  return { voided };
}
