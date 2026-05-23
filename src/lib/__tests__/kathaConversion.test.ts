import { describe, it, expect } from "vitest";
import {
  BIGHA_PER_KATHA, SHATAK_PER_KATHA,
  shatakToKatha, kathaToShatak, bighaToKatha, kathaToBigha, formatLandSize,
} from "../irrigationCalc";

describe("Katha conversion (1 কাঠা = 0.15 বিঘা)", () => {
  it("uses correct constants", () => {
    expect(BIGHA_PER_KATHA).toBe(0.15);
    expect(SHATAK_PER_KATHA).toBeCloseTo(4.95, 2);
  });
  it("converts between katha and bigha", () => {
    expect(kathaToBigha(10)).toBeCloseTo(1.5, 2);
    expect(bighaToKatha(1.5)).toBeCloseTo(10, 2);
  });
  it("converts between katha and shatak", () => {
    expect(kathaToShatak(1)).toBeCloseTo(4.95, 2);
    expect(shatakToKatha(49.5)).toBeCloseTo(10, 2);
  });
  it("formatLandSize with_katha includes all three units", () => {
    const s = formatLandSize(49.5, "with_katha");
    expect(s).toContain("বিঘা");
    expect(s).toContain("কাঠা");
    expect(s).toContain("শতক");
  });
});
