import { describe, it, expect } from "vitest";
import {
  ratePerBighaFromAcre,
  normalizeIrrigationRatePerAcre,
} from "@/lib/bnReceipts";

describe("ratePerBighaFromAcre — একর → বিঘা rate conversion", () => {
  it("converts an acre rate to a bigha rate (1 bigha = 33 শতক, 1 acre = 100 শতক)", () => {
    // bigha rate = acre rate × 33 / 100
    expect(ratePerBighaFromAcre(1000)).toBeCloseTo(330, 6);
    expect(ratePerBighaFromAcre(100)).toBeCloseTo(33, 6);
  });

  it("returns null when acre rate is null", () => {
    expect(ratePerBighaFromAcre(null)).toBeNull();
  });

  it("handles zero rate", () => {
    expect(ratePerBighaFromAcre(0)).toBeCloseTo(0, 6);
  });
});

describe("normalizeIrrigationRatePerAcre — rate normalization", () => {
  it("prefers a valid stored per-acre rate over derivation", () => {
    // charge/land would give a wildly different number; stored rate wins
    expect(normalizeIrrigationRatePerAcre(1200, 999999, 0.0034)).toBe(1200);
  });

  it("upscales legacy per-শতক rates (< 500) to per-acre", () => {
    // 5 per শতক × 100 = 500 per একর
    expect(normalizeIrrigationRatePerAcre(5, null, null)).toBe(500);
  });

  it("keeps large stored rates as per-acre unchanged", () => {
    expect(normalizeIrrigationRatePerAcre(1500, null, null)).toBe(1500);
  });

  it("derives rate from charge ÷ (land/100) when no stored rate", () => {
    // 33 শতক = 0.33 একর, charge 396 → 396 / 0.33 = 1200 per একর
    expect(normalizeIrrigationRatePerAcre(null, 396, 33)).toBeCloseTo(1200, 6);
  });

  it("does NOT explode for tiny parcels when a stored rate exists", () => {
    const rate = normalizeIrrigationRatePerAcre(1000, 5, 0.0034);
    expect(rate).toBe(1000);
    expect(rate!).toBeLessThan(500000);
  });

  it("returns null when nothing usable is provided", () => {
    expect(normalizeIrrigationRatePerAcre(null, null, null)).toBeNull();
    expect(normalizeIrrigationRatePerAcre(0, 0, 0)).toBeNull();
  });

  it("round-trips acre → bigha for a derived rate", () => {
    const acre = normalizeIrrigationRatePerAcre(null, 396, 33)!;
    expect(ratePerBighaFromAcre(acre)).toBeCloseTo(396, 6);
  });
});

describe("rounding & edge cases — stable conversions", () => {
  it("handles a very small acre parcel with a stored rate without exploding", () => {
    // 0.0034 acre (~0.34 শতক); stored rate must win, never charge/land derivation
    const rate = normalizeIrrigationRatePerAcre(1200, 4.08, 0.34);
    expect(rate).toBe(1200);
    expect(ratePerBighaFromAcre(rate)).toBeCloseTo(396, 6);
  });

  it("handles a very large acre value in bigha conversion", () => {
    expect(ratePerBighaFromAcre(1_000_000)).toBeCloseTo(330_000, 3);
  });

  it("treats undefined/NaN rate fields as missing and derives instead", () => {
    expect(normalizeIrrigationRatePerAcre(undefined, 396, 33)).toBeCloseTo(1200, 6);
    expect(normalizeIrrigationRatePerAcre(NaN as unknown as number, 396, 33)).toBeCloseTo(1200, 6);
  });

  it("returns null when all fields are missing/undefined", () => {
    expect(normalizeIrrigationRatePerAcre(undefined, undefined, undefined)).toBeNull();
    expect(normalizeIrrigationRatePerAcre(null, NaN as unknown as number, null)).toBeNull();
  });

  it("does not derive when land is present but charge is missing", () => {
    expect(normalizeIrrigationRatePerAcre(null, null, 33)).toBeNull();
    expect(normalizeIrrigationRatePerAcre(null, 0, 33)).toBeNull();
  });

  it("does not divide by zero when land size is zero", () => {
    expect(normalizeIrrigationRatePerAcre(null, 500, 0)).toBeNull();
  });

  it("upscale boundary: exactly 500 stays per-acre, 499 becomes per-acre×100", () => {
    expect(normalizeIrrigationRatePerAcre(500, null, null)).toBe(500);
    expect(normalizeIrrigationRatePerAcre(499, null, null)).toBe(49900);
  });

  it("bigha conversion of a null acre rate stays null", () => {
    expect(ratePerBighaFromAcre(normalizeIrrigationRatePerAcre(null, null, null))).toBeNull();
  });
});
