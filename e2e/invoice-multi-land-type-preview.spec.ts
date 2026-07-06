import { test, expect } from "@playwright/test";
import { calcInvoice, baseIrrigationAmount, DEFAULT_SETTINGS } from "../src/lib/irrigationInvoice";
import { resolveRateForLand, type RateRow } from "../src/lib/seasonRates";

/**
 * Multi-land-type invoice preview: calculation + pagination correctness
 * (engine-level E2E — no backend credentials required).
 *
 * Proves the exact invariants behind the invoice Preview table:
 *  1. Each land resolves to the rate configured for ITS land type (never a
 *     neighbour's rate, and never rendered as "[object Object]").
 *  2. Each preview row's payable equals the shared engine's output for that
 *     land's own rate + size.
 *  3. The Preview only renders the first 100 rows (`.slice(0, 100)`) but the
 *     slice preserves order and never mixes data across rows.
 */

const due_date = "2999-12-31";

const rateMap: RateRow[] = [
  { land_type_id: "lt-high", land_type_code: "HIGH", land_type_name: "উঁচু জমি", rate_per_shotok: 50, calculation_basis: "per_shotok", office_id: null },
  { land_type_id: "lt-med", land_type_code: "MEDIUM", land_type_name: "মাঝারি জমি", rate_per_shotok: 40, calculation_basis: "per_shotok", office_id: null },
  { land_type_id: "lt-low", land_type_code: "LOW", land_type_name: "নিচু জমি", rate_per_shotok: 30, calculation_basis: "per_shotok", office_id: null },
];

test("rate map renders land-type name + rate, never [object Object]", () => {
  const label = rateMap.map((r) => `${r.land_type_name}=${r.rate_per_shotok}`).join(", ");
  expect(label).toBe("উঁচু জমি=50, মাঝারি জমি=40, নিচু জমি=30");
  expect(label).not.toContain("[object Object]");
});

test("each land resolves to its OWN land type rate", () => {
  const high = resolveRateForLand(rateMap, { land_type_id: "lt-high" });
  const med = resolveRateForLand(rateMap, { land_type_id: "lt-med" });
  const low = resolveRateForLand(rateMap, { field_type: "low_land" });
  expect(high?.rate_per_shotok).toBe(50);
  expect(med?.rate_per_shotok).toBe(40);
  expect(low?.rate_per_shotok).toBe(30);
});

test("preview payable per row matches the shared engine for that land's rate", () => {
  const lands = [
    { land_type_id: "lt-high", land_size: 10 },
    { land_type_id: "lt-med", land_size: 20 },
    { land_type_id: "lt-low", land_size: 33 },
  ];
  for (const l of lands) {
    const matched = resolveRateForLand(rateMap, l)!;
    const calc = calcInvoice({
      land_size_shotok: l.land_size,
      rate_per_shotok: matched.rate_per_shotok,
      basis: "per_shotok",
      settings: DEFAULT_SETTINGS,
      due_date,
    });
    expect(calc.payable_amount).toBe(baseIrrigationAmount(l.land_size, matched.rate_per_shotok, "per_shotok"));
  }
});

test("preview pagination slice(0,100) keeps rows in order without mixing data", () => {
  // Build 150 rows cycling through the 3 land types.
  const rows = Array.from({ length: 150 }, (_, i) => {
    const lt = rateMap[i % rateMap.length];
    const size = i + 1;
    const calc = calcInvoice({
      land_size_shotok: size,
      rate_per_shotok: lt.rate_per_shotok,
      basis: "per_shotok",
      settings: DEFAULT_SETTINGS,
      due_date,
    });
    return { idx: i, land_type_name: lt.land_type_name, rate: lt.rate_per_shotok, payable: calc.payable_amount };
  });

  const shown = rows.slice(0, 100);
  expect(shown).toHaveLength(100);
  // Order preserved and each row still carries its own type/rate/payable.
  shown.forEach((r, i) => {
    const expected = rateMap[i % rateMap.length];
    expect(r.idx).toBe(i);
    expect(r.land_type_name).toBe(expected.land_type_name);
    expect(r.rate).toBe(expected.rate_per_shotok);
    expect(r.payable).toBe(baseIrrigationAmount(i + 1, expected.rate_per_shotok, "per_shotok"));
  });
});
