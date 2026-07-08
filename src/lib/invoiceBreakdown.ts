/**
 * Irrigation invoice due/payable breakdown + consistency verification.
 *
 * Single source of truth for *displaying* how an invoice's payable & due are
 * composed, and for *auditing* whether the stored values match the canonical
 * billing model:
 *
 *   payable = irrigation + delay_fee + other_charge − discount
 *   due     = max(payable − paid, 0)
 *
 * Maintenance & canal are internal splits of the irrigation charge and are
 * deliberately EXCLUDED from payable (adding them doubled the due when the
 * percentages summed to 100%). They are surfaced here only as "excluded"
 * informational lines so users can see what was left out.
 *
 * Keeping this pure makes the breakdown identical across the invoice screen,
 * the receipt and the reconciliation report — and unit-testable.
 */
import { grossAmount } from "@/lib/invoiceDiscount";

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface BreakdownInvoice {
  irrigation_amount?: number | null;
  delay_fee?: number | null;
  other_charge?: number | null;
  discount_amount?: number | null;
  maintenance_amount?: number | null;
  canal_amount?: number | null;
  previous_due_amount?: number | null;
  paid_amount?: number | null;
  payable_amount?: number | null;
  due_amount?: number | null;
  invoice_status?: string | null;
  due_date?: string | Date | null;
}

export interface BreakdownLine {
  /** stable key for React & tests */
  key: string;
  label_en: string;
  label_bn: string;
  amount: number;
  /** sign of contribution to payable: +1 added, -1 subtracted, 0 excluded/info */
  sign: 1 | -1 | 0;
  /** true when the line is shown for information only (not part of payable) */
  excluded?: boolean;
}

export interface InvoiceBreakdown {
  lines: BreakdownLine[];
  /** irrigation + delay + other − discount */
  payable: number;
  paid: number;
  due: number;
  /** carried-over previous due, informational (billed via a separate invoice) */
  previousDue: number;
  /** maintenance + canal — excluded from payable, informational only */
  excludedTotal: number;
}

/** Build the display breakdown for an invoice. */
export function buildInvoiceBreakdown(inv: BreakdownInvoice): InvoiceBreakdown {
  const irrigation = r2(n(inv.irrigation_amount));
  const delay = r2(n(inv.delay_fee));
  const other = r2(n(inv.other_charge));
  const discount = r2(n(inv.discount_amount));
  const maintenance = r2(n(inv.maintenance_amount));
  const canal = r2(n(inv.canal_amount));
  const previousDue = r2(n(inv.previous_due_amount));

  const payable = r2(Math.max(0, grossAmount(inv) - discount));
  const paid = r2(n(inv.paid_amount));
  const due = r2(Math.max(0, payable - paid));

  const lines: BreakdownLine[] = [];
  lines.push({ key: "irrigation", label_en: "Irrigation charge", label_bn: "সেচ চার্জ", amount: irrigation, sign: 1 });
  if (delay > 0) lines.push({ key: "delay_fee", label_en: "Delay fee", label_bn: "বিলম্ব ফি", amount: delay, sign: 1 });
  if (other > 0) lines.push({ key: "other_charge", label_en: "Other charge", label_bn: "অন্যান্য চার্জ", amount: other, sign: 1 });
  if (discount > 0) lines.push({ key: "discount", label_en: "Discount", label_bn: "ছাড়", amount: discount, sign: -1 });

  // Informational-only lines (never counted in payable).
  if (previousDue > 0)
    lines.push({ key: "previous_due", label_en: "Previous due (separate)", label_bn: "পূর্বের বকেয়া (পৃথক)", amount: previousDue, sign: 0, excluded: true });
  if (maintenance > 0)
    lines.push({ key: "maintenance", label_en: "Maintenance (excluded)", label_bn: "রক্ষণাবেক্ষণ (বাদ)", amount: maintenance, sign: 0, excluded: true });
  if (canal > 0)
    lines.push({ key: "canal", label_en: "Canal (excluded)", label_bn: "ক্যানেল (বাদ)", amount: canal, sign: 0, excluded: true });

  return { lines, payable, paid, due, previousDue, excludedTotal: r2(maintenance + canal) };
}

export type ConsistencyCode =
  | "payable_mismatch"
  | "due_mismatch"
  | "due_exceeds_payable"
  | "paid_exceeds_payable"
  | "negative_value";

export interface ConsistencyIssue {
  code: ConsistencyCode;
  message_en: string;
  message_bn: string;
  expected?: number;
  stored?: number;
}

export interface ConsistencyResult {
  ok: boolean;
  issues: ConsistencyIssue[];
  expected: { payable: number; due: number; paid: number };
}

const TOL = 0.05; // tolerance for floating-point / rounding drift

/**
 * Verify a stored invoice row against the canonical model. Used to warn the
 * user (auto-check) when the DB numbers disagree with the recomputed values —
 * e.g. a double-counted due (2×) that slipped through before the fix.
 */
export function verifyInvoiceConsistency(inv: BreakdownInvoice): ConsistencyResult {
  const b = buildInvoiceBreakdown(inv);
  const storedPayable = r2(n(inv.payable_amount));
  const storedDue = r2(n(inv.due_amount));
  const paid = b.paid;
  const issues: ConsistencyIssue[] = [];

  if (Math.abs(storedPayable - b.payable) > TOL) {
    issues.push({
      code: "payable_mismatch",
      message_en: `Stored total (${storedPayable}) differs from computed (${b.payable}).`,
      message_bn: `সংরক্ষিত মোট (${storedPayable}) হিসাবকৃত (${b.payable})-এর সাথে মিলছে না।`,
      expected: b.payable,
      stored: storedPayable,
    });
  }
  if (Math.abs(storedDue - b.due) > TOL) {
    issues.push({
      code: "due_mismatch",
      message_en: `Stored due (${storedDue}) differs from computed (${b.due}).`,
      message_bn: `সংরক্ষিত বকেয়া (${storedDue}) হিসাবকৃত (${b.due})-এর সাথে মিলছে না।`,
      expected: b.due,
      stored: storedDue,
    });
  }
  if (storedDue - storedPayable > TOL) {
    issues.push({
      code: "due_exceeds_payable",
      message_en: `Due (${storedDue}) exceeds total (${storedPayable}).`,
      message_bn: `বকেয়া (${storedDue}) মোট (${storedPayable}) ছাড়িয়ে গেছে।`,
    });
  }
  if (paid - storedPayable > TOL) {
    issues.push({
      code: "paid_exceeds_payable",
      message_en: `Paid (${paid}) exceeds total (${storedPayable}).`,
      message_bn: `পরিশোধিত (${paid}) মোট (${storedPayable}) ছাড়িয়ে গেছে।`,
    });
  }
  if (storedPayable < -TOL || storedDue < -TOL || paid < -TOL) {
    issues.push({
      code: "negative_value",
      message_en: "Invoice has a negative amount.",
      message_bn: "ইনভয়েসে ঋণাত্মক মান রয়েছে।",
    });
  }

  return { ok: issues.length === 0, issues, expected: { payable: b.payable, due: b.due, paid } };
}
