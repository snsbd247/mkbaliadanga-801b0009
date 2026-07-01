import { describe, it, expect } from "vitest";
import {
  normalizeLandSize,
  parseLandInput,
  formatLand,
  computeLandAmount,
  LAND_DECIMALS,
} from "../landMath";
import { setRoundingMode } from "../rounding";

describe("landMath.normalizeLandSize", () => {
  it("keeps 4-decimal values exactly", () => {
    expect(normalizeLandSize(0.1975)).toBe(0.1975);
    expect(normalizeLandSize(0.1650)).toBe(0.165);
  });
  it("does not money-round land area to 2 decimals", () => {
    expect(normalizeLandSize(0.197)).not.toBe(0.2);
    expect(normalizeLandSize(0.165)).not.toBe(0.17);
  });
  it("strips binary float noise", () => {
    expect(normalizeLandSize(0.1 + 0.097)).toBe(0.197);
  });
  it("clamps beyond 4 decimals to LAND_DECIMALS", () => {
    expect(normalizeLandSize(0.197493)).toBe(0.1975);
    expect(LAND_DECIMALS).toBe(4);
  });
  it("handles invalid / negative input as 0", () => {
    expect(normalizeLandSize(-1)).toBe(0);
    expect(normalizeLandSize("abc")).toBe(0);
    expect(normalizeLandSize(null)).toBe(0);
  });
});

describe("landMath.parseLandInput", () => {
  it("accepts valid 4-decimal entry", () => {
    expect(parseLandInput("0.1975")).toEqual({ value: 0.1975, valid: true });
    expect(parseLandInput("0.165")).toEqual({ value: 0.165, valid: true });
  });
  it("rejects more than 4 decimals", () => {
    const r = parseLandInput("0.19755");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("precision");
  });
  it("rejects non-numeric and negative", () => {
    expect(parseLandInput("12a").valid).toBe(false);
    expect(parseLandInput("-2").valid).toBe(false);
  });
  it("treats empty as valid zero", () => {
    expect(parseLandInput("")).toEqual({ value: 0, valid: true });
  });
});

describe("landMath.formatLand", () => {
  it("shows exactly 4 decimal places", () => {
    expect(formatLand(0.197)).toBe("0.1970");
    expect(formatLand(0.165)).toBe("0.1650");
    expect(formatLand(5)).toBe("5.0000");
    expect(formatLand(2.5)).toBe("2.5000");
  });
});

describe("landMath.computeLandAmount", () => {
  beforeAllHalfUp();

  it("0.197 shatak × 100 rate → exact 19.7, rounded 20", () => {
    const b = computeLandAmount(0.197, 100);
    expect(b.raw).toBeCloseTo(19.7, 6);
    expect(b.rounded).toBe(20);
    expect(b.landSize).toBe(0.197); // area unchanged
  });
  it("0.165 shatak × 100 rate → exact 16.5, rounded 17 (half-up)", () => {
    const b = computeLandAmount(0.165, 100);
    expect(b.raw).toBeCloseTo(16.5, 6);
    expect(b.rounded).toBe(17);
  });
  it("rate 0 → amount 0", () => {
    expect(computeLandAmount(0.197, 0).rounded).toBe(0);
  });
  it("respects explicit floor mode", () => {
    expect(computeLandAmount(0.165, 100, "floor").rounded).toBe(16);
  });
});

function beforeAllHalfUp() {
  // Ensure deterministic default rounding for the suite.
  setRoundingMode("half_up");
}
