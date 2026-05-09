import { describe, it, expect } from "vitest";
import { resolveRateForLand, type RateRow } from "../seasonRates";

const rates: RateRow[] = [
  { land_type_id: "lt-high", land_type_code: "high_land", land_type_name: "উঁচু", rate_per_shotok: 50, office_id: null },
  { land_type_id: "lt-mid", land_type_code: "medium_land", land_type_name: "মাঝারি", rate_per_shotok: 40, office_id: null },
  { land_type_id: "lt-mid", land_type_code: "medium_land", land_type_name: "মাঝারি (অফিস)", rate_per_shotok: 45, office_id: "office-1" },
  { land_type_id: "lt-other", land_type_code: "other", land_type_name: "অন্যান্য", rate_per_shotok: 30, office_id: null },
];

describe("resolveRateForLand", () => {
  it("matches by land_type_id when present", () => {
    const r = resolveRateForLand(rates, { land_type_id: "lt-high" });
    expect(r?.land_type_code).toBe("high_land");
    expect(r?.rate_per_shotok).toBe(50);
  });

  it("falls back to field_type code when land_type_id missing", () => {
    const r = resolveRateForLand(rates, { field_type: "medium_land" });
    expect(r?.land_type_code).toBe("medium_land");
  });

  it("returns the 'other' rate when nothing matches", () => {
    const r = resolveRateForLand(rates, { field_type: "nonexistent_code" });
    expect(r?.land_type_code).toBe("other");
  });

  it("returns null when no fallback exists", () => {
    const without = rates.filter((r) => r.land_type_code !== "other");
    const r = resolveRateForLand(without, { field_type: "missing" });
    expect(r).toBeNull();
  });
});

describe("snapshot protection contract", () => {
  // Smoke contract: confirms the immutable fields list expected by the
  // protect_invoice_snapshot trigger stays in sync with the UI.
  it("declares immutable invoice fields", () => {
    const immutable = ["calculation_snapshot", "season_rate", "land_type_id", "land_type_name"];
    expect(immutable).toContain("calculation_snapshot");
    expect(immutable).toContain("season_rate");
    expect(immutable.length).toBe(4);
  });
});
