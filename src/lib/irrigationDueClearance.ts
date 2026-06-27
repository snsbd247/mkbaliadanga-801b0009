// Pure, testable logic for the irrigation "full due clearance" rule.
//
// Business rule: when receiving a payment for a farmer (including when multiple
// invoices are selected for the running season), a receipt may only be generated
// if ALL dues — previous-season carry-over AND the selected current-season
// charges (including penalties/delay fees) — are fully cleared.
//
// Roles listed in `allowedRoles` (configurable, Super Admin only) may bypass this
// and accept a partial payment. Everyone else is blocked.

export interface ClearanceInvoice {
  id: string;
  invoice_no: string;
  due_amount: number;
  delay_fee?: number | null;
}

export interface ClearanceArgs {
  selectedCurrentInvoices: ClearanceInvoice[];
  previousInvoices: ClearanceInvoice[];
  /** Amount actually collected against current-season invoices. */
  currentCollected: number;
  /** Amount actually collected against previous dues. */
  previousCollected: number;
  /** Per-invoice overridden delay fee (id -> fee). */
  delayFeeOverride?: Record<string, number>;
  /** Roles of the current user. */
  userRoles: string[];
  /** Roles permitted to take partial payments. */
  allowedRoles: string[];
  /** Treat user as super admin (always allowed partial). */
  isSuper?: boolean;
  /** Rounding helper (defaults to nearest taka). */
  round?: (n: number) => number;
}

export interface UnpaidRow {
  label: string;
  missing: number;
}

export interface ClearanceResult {
  canDoPartial: boolean;
  currentPayable: number;
  currentShortfall: number;
  previousShortfall: number;
  /** True when the payment must be blocked (receipt cannot be generated). */
  blocked: boolean;
  unpaidRows: UnpaidRow[];
}

const EPS = 0.5;

export function evaluateClearance(args: ClearanceArgs): ClearanceResult {
  const round = args.round ?? Math.round;
  const overrides = args.delayFeeOverride ?? {};

  const currentPayable = args.selectedCurrentInvoices.reduce((s, inv) => {
    const fee = overrides[inv.id] ?? Number(inv.delay_fee || 0);
    const adjusted = Number(inv.due_amount) + (fee - Number(inv.delay_fee || 0));
    return s + Math.max(0, adjusted);
  }, 0);

  const previousDueTotal = args.previousInvoices.reduce((s, i) => s + Number(i.due_amount || 0), 0);

  const currentShortfall = round(currentPayable) - Number(args.currentCollected || 0);
  const previousShortfall = previousDueTotal - Number(args.previousCollected || 0);

  const canDoPartial =
    Boolean(args.isSuper) || args.userRoles.some(r => args.allowedRoles.includes(r));

  const hasShortfall = currentShortfall > EPS || previousShortfall > EPS;
  const blocked = !canDoPartial && hasShortfall;

  const unpaidRows: UnpaidRow[] = [];
  if (blocked) {
    if (currentShortfall > EPS) {
      for (const inv of args.selectedCurrentInvoices) {
        const fee = overrides[inv.id] ?? Number(inv.delay_fee || 0);
        const adjusted = Math.max(0, Number(inv.due_amount) + (fee - Number(inv.delay_fee || 0)));
        if (adjusted > EPS) unpaidRows.push({ label: `Current • ${inv.invoice_no}`, missing: adjusted });
      }
      if (unpaidRows.length === 0) unpaidRows.push({ label: "Current season charge", missing: currentShortfall });
    }
    if (previousShortfall > EPS) {
      for (const inv of args.previousInvoices) {
        if (Number(inv.due_amount) > EPS) {
          unpaidRows.push({ label: `Previous due • ${inv.invoice_no}`, missing: Number(inv.due_amount) });
        }
      }
    }
  }

  return { canDoPartial, currentPayable, currentShortfall, previousShortfall, blocked, unpaidRows };
}
