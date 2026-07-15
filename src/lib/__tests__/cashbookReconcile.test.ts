import { describe, it, expect } from "vitest";
import { findReceiptGaps, explainGaps } from "@/lib/cashbookReconcile";

describe("cashbook reconciliation", () => {
  it("detects 4754 as missing between 4743–4753 and 4755–4761", () => {
    const receipts = [
      ...[4743, 4744, 4745, 4746, 4747, 4748, 4749, 4750, 4751, 4752, 4753],
      ...[4755, 4756, 4757, 4758, 4759, 4760, 4761],
    ].map((n) => ({ receipt_no: String(n) }));

    expect(findReceiptGaps(receipts)).toEqual([4754]);
  });

  it("returns [] when the sequence is contiguous", () => {
    const receipts = [4700, 4701, 4702].map((n) => ({ receipt_no: String(n) }));
    expect(findReceiptGaps(receipts)).toEqual([]);
  });

  it("ignores non-numeric receipt numbers", () => {
    const receipts = [
      { receipt_no: "RCPT-20260714-0001" },
      { receipt_no: "4801" },
      { receipt_no: "4803" },
    ];
    expect(findReceiptGaps(receipts)).toEqual([4802]);
  });

  it("verifies 4754 (pending) is INCLUDED when it exists in the receipts list", () => {
    // This mirrors the Cashbook fix: pending / non-approved but non-voided
    // payments must appear in the range, so no gap is reported.
    const receipts = [4753, 4754, 4755].map((n) => ({
      receipt_no: String(n),
      _excluded_reason: null,
    }));
    expect(findReceiptGaps(receipts)).toEqual([]);
  });

  it("explains gaps against a voided/deleted excluded list", () => {
    const missing = [4754, 4770];
    const excluded = [
      { receipt_no: "4754", _excluded_reason: "voided" as const, amount: 727 },
      { receipt_no: "4770", _excluded_reason: "deleted" as const, amount: 500 },
    ];
    const out = explainGaps(missing, excluded);
    expect(out).toEqual([
      { no: 4754, reason: "voided", date: null, amount: 727 },
      { no: 4770, reason: "deleted", date: null, amount: 500 },
    ]);
  });

  it("marks unexplained gaps as reason=unknown", () => {
    const out = explainGaps([4900], []);
    expect(out[0].reason).toBe("unknown");
  });
});
