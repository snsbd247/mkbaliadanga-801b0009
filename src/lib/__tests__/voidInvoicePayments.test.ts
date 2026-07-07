import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
const logAudit = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: (...a: any[]) => logAudit(...a) }));

// Chainable query-builder mock. Each db.from(table) returns a builder whose
// terminal (awaited) result is resolved from `responses[table]`.
const responses: Record<string, any> = {};
let deletedFrom: string[] = [];

function makeBuilder(table: string) {
  const result = responses[table] ?? { data: [], error: null };
  const builder: any = {
    _op: "read",
    select: () => builder,
    update: () => builder,
    eq: () => builder,
    is: () => builder,
    delete: () => {
      deletedFrom.push(table);
      return builder;
    },
    then: (resolve: any) => resolve(result),
  };
  return builder;
}

vi.mock("@/lib/db", () => ({
  db: { from: (table: string) => makeBuilder(table) },
}));

import { voidPaymentsForInvoice } from "@/lib/voidInvoicePayments";

describe("voidPaymentsForInvoice", () => {
  beforeEach(() => {
    logAudit.mockClear();
    deletedFrom = [];
    for (const k of Object.keys(responses)) delete responses[k];
  });

  it("voids linked payments and writes an audit entry per void", async () => {
    responses["irrigation_invoice_payments"] = { data: [{ payment_id: "p1" }], error: null };
    responses["payment_allocations"] = { data: [{ payment_id: "p2" }], error: null };
    // payments.update(...).select() returns the updated row
    responses["payments"] = { data: [{ id: "row", office_id: "o1", receipt_no: "RCP-1", amount: 100 }], error: null };

    const res = await voidPaymentsForInvoice("inv-1", { actorId: "u1" });

    // Two distinct payment ids (p1, p2) each voided → 2 audit entries.
    expect(res.voided).toBe(2);
    expect(logAudit).toHaveBeenCalledTimes(2);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ module: "irrigation_payment", action_type: "void", reference_id: "row" }),
    );
    // Link rows removed.
    expect(deletedFrom).toContain("irrigation_invoice_payments");
  });

  it("writes no audit entry when payment is already voided (no row returned)", async () => {
    responses["irrigation_invoice_payments"] = { data: [{ payment_id: "p1" }], error: null };
    responses["payment_allocations"] = { data: [], error: null };
    responses["payments"] = { data: [], error: null }; // .is('voided_at', null) matched nothing

    const res = await voidPaymentsForInvoice("inv-2", { actorId: "u1" });

    expect(res.voided).toBe(0);
    expect(logAudit).not.toHaveBeenCalled();
    expect(deletedFrom).toContain("irrigation_invoice_payments");
  });
});
