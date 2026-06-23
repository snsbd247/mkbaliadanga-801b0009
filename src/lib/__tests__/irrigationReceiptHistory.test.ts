import { describe, it, expect } from "vitest";
import {
  buildReceiptNo,
  buildPaidHistory,
  buildReceiptModel,
} from "../irrigationReceiptHistory";

describe("buildReceiptNo", () => {
  it("uses a supplied number (uppercased) when present", () => {
    expect(buildReceiptNo("rcp-2026-01-0007", "IRR", "x")).toBe("RCP-2026-01-0007");
  });
  it("auto-generates when none supplied", () => {
    const no = buildReceiptNo("", "IRR", "abc123", new Date("2026-01-05"));
    expect(no).toMatch(/^IRR-20260105-/);
  });
});

describe("buildPaidHistory", () => {
  it("computes a running balance clamped to [0, payable]", () => {
    const rows = buildPaidHistory(1000, [
      { amount: 300, paid_at: "2026-01-02" },
      { amount: 800, paid_at: "2026-01-01" },
    ]);
    // sorted chronologically: 800 then 300
    expect(rows[0].applied).toBe(800);
    expect(rows[0].balance_after).toBe(200);
    expect(rows[1].applied).toBe(200); // clamped, only 200 remained
    expect(rows[1].balance_after).toBe(0);
  });

  it("assigns receipt numbers to entries missing one", () => {
    const rows = buildPaidHistory(500, [{ amount: 500, paid_at: "2026-02-01" }]);
    expect(rows[0].receipt_no).toMatch(/^IRR-20260201-/);
  });

  it("never lets balance go negative on overpayment", () => {
    const rows = buildPaidHistory(100, [{ amount: 999, paid_at: "2026-01-01" }]);
    expect(rows[0].applied).toBe(100);
    expect(rows[0].balance_after).toBe(0);
  });
});

describe("buildReceiptModel", () => {
  it("totals equal the sum of lines and reconcile to payable", () => {
    const [row] = buildPaidHistory(1000, [{ amount: 400, paid_at: "2026-01-01" }]);
    const m = buildReceiptModel(row, 1000, [
      { label: "সেচ চার্জ", amount: 350 },
      { label: "বিলম্ব ফি", amount: 50 },
    ]);
    expect(m.total).toBe(400);
    expect(m.paid_to_date).toBe(400);
    expect(m.balance_due).toBe(600);
  });
});
