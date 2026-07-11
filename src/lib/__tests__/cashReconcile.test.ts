import { describe, it, expect } from "vitest";
import { computeHandCash } from "@/lib/handCash";
import {
  computeSavingsHandCash,
  reconcileBalances,
} from "@/lib/cashReconcile";

describe("computeHandCash (irrigation)", () => {
  it("sums irrigation receipts and subtracts expenses", () => {
    const r = computeHandCash({
      receipts: [
        { kind: "irrigation", amount: 41833, receipt_no: "4683" },
      ],
      expenses: [{ amount: 68427 }],
      opening: 0,
    });
    expect(r.income).toBe(41833);
    expect(r.expense).toBe(68427);
    expect(r.closing).toBe(41833 - 68427);
  });

  it("counts a bank-transfer receipt as income (mirrors Cash Book)", () => {
    const r = computeHandCash({
      receipts: [
        { kind: "irrigation", amount: 41833, receipt_no: "4683" },
        { kind: "irrigation", amount: 210000, receipt_no: "T-1" },
      ],
      expenses: [{ amount: 68427 }],
      opening: 0,
    });
    expect(r.income).toBe(251833);
    expect(r.closing).toBe(251833 - 68427); // 183406
  });

  it("does not double-count payments already present as receipts", () => {
    const r = computeHandCash({
      receipts: [{ kind: "irrigation", amount: 100, receipt_no: "9" }],
      payments: [{ amount: 100, receipt_no: "9", kind: "irrigation", status: "approved" }],
      expenses: [],
    });
    expect(r.income).toBe(100);
  });

  it("adds approved payments that have a new receipt_no", () => {
    const r = computeHandCash({
      receipts: [{ kind: "irrigation", amount: 100, receipt_no: "9" }],
      payments: [{ amount: 50, receipt_no: "10", kind: "irrigation", status: "approved" }],
      expenses: [],
    });
    expect(r.income).toBe(150);
  });
});

describe("computeSavingsHandCash", () => {
  it("uses non-irrigation receipts and non-irrigation expenses", () => {
    const r = computeSavingsHandCash({
      receipts: [
        { kind: "irrigation", amount: 41833 },
        { kind: "savings_deposit", amount: 0 },
      ],
      expenses: [
        { amount: 71880, stream: "savings" },
        { amount: 68427, stream: "irrigation" },
      ],
      opening: 0,
    });
    expect(r.income).toBe(0);
    expect(r.expense).toBe(71880);
    expect(r.net).toBe(-71880);
    expect(r.closing).toBe(-71880);
  });

  it("carries the opening balance into the closing", () => {
    const r = computeSavingsHandCash({
      receipts: [{ kind: "share", amount: 500 }],
      expenses: [{ amount: 200, stream: "savings" }],
      opening: 1000,
    });
    expect(r.net).toBe(300);
    expect(r.closing).toBe(1300);
  });
});

describe("reconcileBalances", () => {
  it("passes when dashboard matches source within tolerance", () => {
    const res = reconcileBalances([
      { label: "Irrigation", dashboard: 183406, source: 183406 },
      { label: "Savings", dashboard: -71880, source: -71880.3 },
    ]);
    expect(res.ok).toBe(true);
    expect(res.mismatches).toHaveLength(0);
  });

  it("reports mismatches beyond tolerance with a signed diff", () => {
    const res = reconcileBalances([
      { label: "Irrigation", dashboard: 183406, source: 183000 },
      { label: "Banks", dashboard: 2168444, source: 2168444 },
    ]);
    expect(res.ok).toBe(false);
    expect(res.mismatches).toHaveLength(1);
    expect(res.mismatches[0].label).toBe("Irrigation");
    expect(res.mismatches[0].diff).toBe(406);
  });
});
