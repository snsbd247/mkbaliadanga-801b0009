import { describe, it, expect } from "vitest";
import {
  isLumpSum,
  addMonths,
  lumpSumInterest,
  lumpSumSchedule,
  validateLumpSumInterest,
} from "@/lib/lumpSumLoan";

const tx = (_en: string, bn: string) => bn;

describe("lump-sum loan helpers", () => {
  it("detects lump-sum type", () => {
    expect(isLumpSum("lump_sum")).toBe(true);
    expect(isLumpSum("monthly")).toBe(false);
    expect(isLumpSum(null)).toBe(false);
  });

  it("adds calendar months with overflow guard", () => {
    expect(addMonths("2026-01-15", 6)).toBe("2026-07-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("computes flat interest", () => {
    expect(lumpSumInterest(50000, 9)).toBe(4500);
    expect(lumpSumInterest(50000, 0)).toBe(0);
    expect(lumpSumInterest(0, 9)).toBe(0);
  });

  it("builds a single end-of-term row", () => {
    const rows = lumpSumSchedule({ principal: 50000, interestRate: 9, durationMonths: 6, issuedOn: "2026-01-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ seq: 1, dueDate: "2026-07-01", principalDue: 50000, interestDue: 4500, totalDue: 54500 });
  });
});

describe("lump-sum interest validation", () => {
  it("accepts valid values with up to 2 decimals", () => {
    expect(validateLumpSumInterest(9, tx).ok).toBe(true);
    expect(validateLumpSumInterest("9.25", tx).ok).toBe(true);
    expect(validateLumpSumInterest("0", tx).ok).toBe(true);
    expect(validateLumpSumInterest("100", tx).ok).toBe(true);
  });

  it("rejects out-of-range and malformed values", () => {
    expect(validateLumpSumInterest("", tx).ok).toBe(false);
    expect(validateLumpSumInterest("-1", tx).ok).toBe(false);
    expect(validateLumpSumInterest("101", tx).ok).toBe(false);
    expect(validateLumpSumInterest("9.255", tx).ok).toBe(false);
    expect(validateLumpSumInterest("abc", tx).ok).toBe(false);
  });
});
