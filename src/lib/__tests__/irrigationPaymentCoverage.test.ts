import { describe, it, expect } from "vitest";
import { comparePaymentCoverage } from "@/lib/irrigationPaymentCoverage";

describe("payment coverage verification", () => {
  it("passes when saved rows match expected ids and total", () => {
    const r = comparePaymentCoverage(
      [
        { invoice_id: "a", collected_amount: 500 },
        { invoice_id: "b", collected_amount: 788 },
      ],
      ["a", "b"],
      1288,
    );
    expect(r.ok).toBe(true);
    expect(r.savedTotal).toBe(1288);
  });

  it("tolerates floating-point drift on the total", () => {
    const r = comparePaymentCoverage(
      [{ invoice_id: "a", collected_amount: 1288.0000001 }],
      ["a"],
      1288,
    );
    expect(r.ok).toBe(true);
    expect(r.totalMismatch).toBe(false);
  });

  it("flags a missing invoice that was not persisted", () => {
    const r = comparePaymentCoverage([{ invoice_id: "a", collected_amount: 500 }], ["a", "b"], 1288);
    expect(r.ok).toBe(false);
    expect(r.missingInvoiceIds).toEqual(["b"]);
  });

  it("flags an unexpected persisted invoice", () => {
    const r = comparePaymentCoverage(
      [
        { invoice_id: "a", collected_amount: 500 },
        { invoice_id: "x", collected_amount: 100 },
      ],
      ["a"],
      500,
    );
    expect(r.ok).toBe(false);
    expect(r.unexpectedInvoiceIds).toEqual(["x"]);
  });

  it("flags a total mismatch beyond tolerance", () => {
    const r = comparePaymentCoverage([{ invoice_id: "a", collected_amount: 400 }], ["a"], 500);
    expect(r.ok).toBe(false);
    expect(r.totalMismatch).toBe(true);
  });
});
