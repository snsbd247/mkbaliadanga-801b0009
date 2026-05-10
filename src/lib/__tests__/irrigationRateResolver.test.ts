import { describe, it, expect } from "vitest";
import { resolveIrrigationRate, NO_RATE_WARNING_BN } from "../irrigationRateResolver";

const land = { land_type_id: "lt1", land_type_code: "high", rate_per_shotok: 100 };
const category = {
  irrigation_category_id: "cat1",
  category_name: "ধানের চারা",
  rate: 150,
  rate_type: "per_shotok" as const,
  is_negotiable: true,
};

describe("resolveIrrigationRate — layered priority", () => {
  it("falls back to land-type when only land rate exists", () => {
    const r = resolveIrrigationRate({ landTypeRate: land });
    expect(r.source).toBe("STANDARD");
    expect(r.rate).toBe(100);
    expect(r.warning).toBeUndefined();
  });

  it("category rate wins over land-type", () => {
    const r = resolveIrrigationRate({ landTypeRate: land, categoryRate: category });
    expect(r.source).toBe("CATEGORY");
    expect(r.rate).toBe(150);
    expect(r.categoryName).toBe("ধানের চারা");
    expect(r.originalStandardRate).toBe(150);
  });

  it("manual override wins over both, preserves baseline for audit", () => {
    const r = resolveIrrigationRate({
      landTypeRate: land,
      categoryRate: category,
      manualOverride: { rate: 80, reason: "পানি কম গেছে" },
    });
    expect(r.source).toBe("MANUAL");
    expect(r.rate).toBe(80);
    expect(r.originalStandardRate).toBe(150); // category was the baseline
    expect(r.overrideReason).toBe("পানি কম গেছে");
    expect(r.categoryName).toBe("ধানের চারা");
  });

  it("manual override falls back to land baseline when no category", () => {
    const r = resolveIrrigationRate({
      landTypeRate: land,
      manualOverride: { rate: 50, reason: "আংশিক সেচ" },
    });
    expect(r.source).toBe("MANUAL");
    expect(r.originalStandardRate).toBe(100);
    expect(r.categoryId).toBeNull();
  });

  it("returns Bengali warning when no rate is configured", () => {
    const r = resolveIrrigationRate({});
    expect(r.warning).toBe(NO_RATE_WARNING_BN);
    expect(r.rate).toBe(0);
  });

  it("ignores zero/negative manual rate (treated as no override)", () => {
    const r = resolveIrrigationRate({
      landTypeRate: land,
      manualOverride: { rate: 0, reason: "x" },
    });
    expect(r.source).toBe("STANDARD");
    expect(r.rate).toBe(100);
  });

  it("propagates is_negotiable from category", () => {
    const r = resolveIrrigationRate({ categoryRate: category });
    expect(r.isNegotiable).toBe(true);
  });
});
