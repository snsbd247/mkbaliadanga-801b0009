import { describe, it, expect } from "vitest";
import { categorizeErrors, ERROR_CATEGORY_LABELS, LANDS_TEMPLATE_VERSION } from "@/pages/LandsImport";

describe("categorizeErrors", () => {
  it("buckets errors by category and sorts by count", () => {
    const rows = [
      { errorMsg: "owner_farmer_id: আবশ্যক; land_size: আবশ্যক" },
      { errorMsg: "land_type: সিজনের নাম দেওয়া যাবে না (আমন২৬)" },
      { errorMsg: "land_size: সংখ্যা নয় (abc)" },
      { errorMsg: null },
    ];
    const cats = categorizeErrors(rows);
    const map = Object.fromEntries(cats.map((c) => [c.key, c.count]));
    expect(map.land_size).toBe(2);
    expect(map.owner).toBe(1);
    expect(map.season_as_land_type).toBe(1);
    // sorted descending
    expect(cats[0].count).toBeGreaterThanOrEqual(cats[cats.length - 1].count);
  });

  it("every category has a bilingual label", () => {
    for (const { key } of categorizeErrors([{ errorMsg: "unmatched weird issue" }])) {
      expect(ERROR_CATEGORY_LABELS[key]).toBeTruthy();
    }
    for (const k of Object.keys(ERROR_CATEGORY_LABELS)) {
      expect(ERROR_CATEGORY_LABELS[k].en).toBeTruthy();
      expect(ERROR_CATEGORY_LABELS[k].bn).toBeTruthy();
    }
  });
});

describe("template version", () => {
  it("is a stable version string", () => {
    expect(LANDS_TEMPLATE_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });
});
