import { describe, it, expect } from "vitest";
import { computeHistoricalAmounts, isBorgaEntry, round2 } from "../historicalReceipt";

describe("computeHistoricalAmounts", () => {
  it("fully paid when no due", () => {
    const r = computeHistoricalAmounts(1300, 0);
    expect(r).toMatchObject({ payable: 1300, due: 0, paid: 1300, status: "paid" });
  });

  it("partial paid when some due remains", () => {
    const r = computeHistoricalAmounts(1300, 300);
    expect(r).toMatchObject({ payable: 1300, due: 300, paid: 1000, status: "partial_paid" });
  });

  it("generated (nothing collected) when due equals total", () => {
    const r = computeHistoricalAmounts(1300, 1300);
    expect(r).toMatchObject({ paid: 0, due: 1300, status: "generated" });
  });

  it("never produces negative collected when due exceeds total", () => {
    const r = computeHistoricalAmounts(1000, 1500);
    expect(r.paid).toBe(0);
    expect(r.due).toBe(1500);
  });

  it("clamps negative inputs to zero", () => {
    expect(computeHistoricalAmounts(-50, -10)).toMatchObject({ payable: 0, due: 0, paid: 0, status: "paid" });
  });

  it("rounds to 2 decimals", () => {
    expect(round2(1300.005)).toBe(1300.01);
  });
});

describe("isBorgaEntry", () => {
  it("true when cultivator differs from owner", () => {
    expect(isBorgaEntry("a", "b")).toBe(true);
  });
  it("false for own land", () => {
    expect(isBorgaEntry("a", "a")).toBe(false);
  });
});
