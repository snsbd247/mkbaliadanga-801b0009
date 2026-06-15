import { describe, it, expect } from "vitest";
import { shatakToUnits, landSizeLabel, SHATAK_PER_BIGHA, KATHA_PER_BIGHA } from "@/lib/landUnits";

describe("landUnits — বিঘা/শতক/কাঠা conversion", () => {
  it("uses the canonical ratios (1 বিঘা = 33 শতক = 20 কাঠা)", () => {
    expect(SHATAK_PER_BIGHA).toBe(33);
    expect(KATHA_PER_BIGHA).toBe(20);
  });

  it("converts 33 শতক to exactly 1 বিঘা and 20 কাঠা", () => {
    const u = shatakToUnits(33);
    expect(u.bigha).toBeCloseTo(1, 6);
    expect(u.katha).toBeCloseTo(20, 6);
  });

  it("converts 1.65 শতক to 1 কাঠা", () => {
    const u = shatakToUnits(1.65);
    expect(u.katha).toBeCloseTo(1, 6);
  });

  it("handles zero and is stable", () => {
    const u = shatakToUnits(0);
    expect(u).toEqual({ shatak: 0, bigha: 0, katha: 0 });
  });

  it("label shows বিঘা · কাঠা · শতক together (bn)", () => {
    const label = landSizeLabel(33, "bn")!;
    expect(label).toContain("বিঘা");
    expect(label).toContain("কাঠা");
    expect(label).toContain("শতক");
    expect(label).toContain("1.00 বিঘা");
    expect(label).toContain("20.00 কাঠা");
    expect(label).toContain("33.00 শতক");
  });

  it("label shows bigha · katha · shatak (en)", () => {
    const label = landSizeLabel(16.5, "en")!;
    expect(label).toBe("0.50 bigha · 10.00 katha (16.50 shatak)");
  });

  it("returns null when land size is missing", () => {
    expect(landSizeLabel(null, "bn")).toBeNull();
    expect(landSizeLabel(undefined, "en")).toBeNull();
  });
});
