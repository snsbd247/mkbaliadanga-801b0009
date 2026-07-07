/**
 * Single source of truth for irrigation invoice due/status recalculation.
 *
 * Mirrors the Postgres trigger `tg_irrigation_invoice_recalc` so the UI can
 * show the same result the backend will persist. Keeping this pure makes it
 * unit-testable and guarantees the frontend never disagrees with the database.
 */
export type InvoiceStatus =
  | "paid"
  | "partial_paid"
  | "overdue"
  | "generated"
  | "draft"
  | "cancelled";

export interface RecalcResult {
  due_amount: number;
  invoice_status: InvoiceStatus;
  cleared: boolean;
}

export function recalcInvoice(
  payable: number,
  paid: number,
  opts: { dueDate?: string | Date | null; currentStatus?: string | null } = {},
): RecalcResult {
  const pay = Math.max(0, Number(payable) || 0);
  const paidAmt = Math.max(0, Number(paid) || 0);
  const due = Math.max(0, +(pay - paidAmt).toFixed(2));

  // Cancelled invoices keep their status untouched.
  if (opts.currentStatus === "cancelled") {
    return { due_amount: due, invoice_status: "cancelled", cleared: due <= 0 };
  }

  let status: InvoiceStatus;
  if (paidAmt >= pay && pay > 0) {
    status = "paid";
  } else if (paidAmt > 0) {
    status = "partial_paid";
  } else if (opts.dueDate && new Date(opts.dueDate) < new Date(new Date().toDateString())) {
    status = "overdue";
  } else if (opts.currentStatus === "draft") {
    status = "draft";
  } else {
    status = "generated";
  }
  return { due_amount: due, invoice_status: status, cleared: due <= 0 };
}
