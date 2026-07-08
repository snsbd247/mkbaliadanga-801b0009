// Centralized, pure invoice-discount logic shared by the UI, exports and tests.
// Keeping these functions side-effect free makes them easy to unit-test and
// guarantees the same recalculation rules everywhere (no drift across modules).

import type { AppRole } from "@/auth/AuthProvider";

export interface DiscountInvoiceInput {
  irrigation_amount?: number | null;
  maintenance_amount?: number | null;
  canal_amount?: number | null;
  other_charge?: number | null;
  delay_fee?: number | null;
  paid_amount?: number | null;
  discount_amount?: number | null;
  invoice_status?: string | null;
}

const n = (v: unknown) => Number(v) || 0;

/**
 * Gross invoice amount before any discount.
 *
 * Billing model: only the irrigation (land) charge, delay fee and other charge
 * are billed to the farmer. Maintenance & canal are internal splits of the
 * irrigation amount and MUST NOT be added on top — otherwise the payable/due
 * inflates above the actual land charge (e.g. doubling when the percentages
 * add up to 100%). This mirrors `calcInvoice` in irrigationInvoice.ts and the
 * `tg_irrigation_invoice_recalc` database trigger.
 */
export function grossAmount(inv: DiscountInvoiceInput, otherCharge?: number, delayFee?: number): number {
  return (
    n(inv.irrigation_amount) +
    (otherCharge != null ? n(otherCharge) : n(inv.other_charge)) +
    (delayFee != null ? n(delayFee) : n(inv.delay_fee))
  );
}

export interface DiscountValidation {
  ok: boolean;
  /** Machine code for tests; UI maps to localized text. */
  code: "ok" | "negative" | "exceeds_invoice" | "reason_required";
}

/** Validate a proposed discount against the invoice's gross amount. */
export function validateDiscount(
  gross: number,
  discount: number,
  reason: string,
  originalDiscount: number,
): DiscountValidation {
  if (discount < 0) return { ok: false, code: "negative" };
  if (discount > gross) return { ok: false, code: "exceeds_invoice" };
  // A reason is required whenever a non-zero discount is entered, or when the
  // discount value changes from its original (even back to zero).
  if ((discount > 0 || discount !== originalDiscount) && !reason.trim())
    return { ok: false, code: "reason_required" };
  return { ok: true, code: "ok" };
}

export interface InvoiceTotals {
  gross: number;
  discount: number;
  payable: number;
  due: number;
  status: string;
}

/** Single source of truth for payable/due/status recalculation after a discount. */
export function computeInvoiceTotals(
  inv: DiscountInvoiceInput,
  discount: number,
  dueDate?: string | Date | null,
  otherCharge?: number,
  delayFee?: number,
): InvoiceTotals {
  const gross = grossAmount(inv, otherCharge, delayFee);
  const disc = Math.min(Math.max(0, n(discount)), gross);
  const payable = Math.max(0, gross - disc);
  const paid = n(inv.paid_amount);
  const due = Math.max(0, payable - paid);
  const status =
    inv.invoice_status === "cancelled"
      ? "cancelled"
      : due === 0
      ? "paid"
      : paid > 0
      ? "partial_paid"
      : dueDate && new Date(dueDate) < new Date()
      ? "overdue"
      : "generated";
  return { gross, discount: disc, payable, due, status };
}

const APPROVED_STATUSES = new Set(["paid", "partial_paid"]);

/** Roles permitted to edit invoice discounts at all. */
export function canEditInvoiceDiscount(roles: AppRole[]): boolean {
  return roles.some((r) => ["developer", "super_admin", "admin", "staff"].includes(r));
}

/** Staff may not edit already-approved (paid/partially-paid) invoices; admins may.
 *  Staff/admins are also restricted to invoices in their own office; super admins are not. */
export function canEditInvoice(
  roles: AppRole[],
  inv: DiscountInvoiceInput & { office_id?: string | null },
  opts?: { userOfficeId?: string | null },
): { ok: boolean; reason?: string } {
  if (!canEditInvoiceDiscount(roles)) return { ok: false, reason: "no_permission" };
  const isSuperAdmin = roles.some((r) => ["developer", "super_admin"].includes(r));
  const isAdmin = roles.some((r) => ["developer", "super_admin", "admin"].includes(r));
  const isApproved = APPROVED_STATUSES.has(inv.invoice_status ?? "");
  if (!isAdmin && isApproved) return { ok: false, reason: "staff_approved_locked" };
  // Office scoping mirrors the RLS policy: only super admins cross offices.
  if (!isSuperAdmin && opts && opts.userOfficeId != null && inv.office_id != null && inv.office_id !== opts.userOfficeId) {
    return { ok: false, reason: "office_mismatch" };
  }
  return { ok: true };
}
