import { describe, it, expect } from "vitest";
import { calcMonthlyDepreciation, generateSchedule } from "../assetDepreciation";

describe("assetDepreciation", () => {
  it("straight-line: equal monthly amount", () => {
    const r = calcMonthlyDepreciation({
      method: "straight_line", cost: 60000, salvage: 0, usefulLifeMonths: 60,
      wdvRatePct: 0, openingBookValue: 60000, accumulated: 0,
    });
    expect(r.depreciation).toBe(1000);
    expect(r.closingBookValue).toBe(59000);
  });

  it("straight-line: never below salvage", () => {
    const r = calcMonthlyDepreciation({
      method: "straight_line", cost: 1000, salvage: 200, usefulLifeMonths: 10,
      wdvRatePct: 0, openingBookValue: 250, accumulated: 750,
    });
    expect(r.depreciation).toBe(50); // only 50 left to salvage
    expect(r.closingBookValue).toBe(200);
  });

  it("WDV: declining balance", () => {
    const r = calcMonthlyDepreciation({
      method: "wdv", cost: 100000, salvage: 0, usefulLifeMonths: 0,
      wdvRatePct: 24, openingBookValue: 100000, accumulated: 0,
    });
    // 24%/12 = 2% monthly => 2000
    expect(r.depreciation).toBe(2000);
    expect(r.closingBookValue).toBe(98000);
  });

  it("schedule stops at salvage", () => {
    const s = generateSchedule(
      { method: "straight_line", cost: 1200, salvage: 0, usefulLifeMonths: 12, wdvRatePct: 0 },
      "2025-01-01", 24
    );
    expect(s).toHaveLength(12);
    expect(s.at(-1)?.closingBookValue).toBe(0);
  });
});
