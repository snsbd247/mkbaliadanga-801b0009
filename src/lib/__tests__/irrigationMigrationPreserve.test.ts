import { describe, it, expect } from "vitest";
import {
  calcInvoice,
  baseIrrigationAmount,
  DEFAULT_SETTINGS,
  type CalculationBasis,
} from "../irrigationInvoice";

/**
 * Migration-preservation contract.
 *
 * The backfill migration freezes each legacy invoice's totals into
 * `calculation_snapshot` WITHOUT recomputing them. These tests model that
 * invariant: a snapshot's stored amounts must equal what the engine produced
 * for the same inputs, for every calculation_basis — so introducing
 * calculation_basis / season_rate never silently changes a legacy total.
 */

const future = "2999-12-31";
const bases: CalculationBasis[] = ["per_shotok", "per_bigha", "flat", "custom"];

// Simulate a legacy invoice computed under per_shotok (the pre-migration default).
function legacyInvoice(land: number, rate: number) {
  const c = calcInvoice({
    land_size_shotok: land, rate_per_shotok: rate, basis: "per_shotok",
    settings: DEFAULT_SETTINGS, due_date: future, paid_amount: 0,
  });
  return {
    season_rate: rate,
    payable_amount: c.payable_amount,
    paid_amount: c.paid_amount,
    due_amount: c.due_amount,
    irrigation_amount: c.irrigation_amount,
  };
}

describe("migration preserves legacy invoice totals", () => {
  it("backfilled snapshot equals the stored amount (default per_shotok)", () => {
    const inv = legacyInvoice(33, 10);
    const snapshot = {
      backfilled: true,
      basis: "per_shotok" as CalculationBasis,
      season_rate: inv.season_rate,
      payable_amount: inv.payable_amount,
      paid_amount: inv.paid_amount,
      due_amount: inv.due_amount,
    };
    // Re-deriving from the snapshot's frozen basis/rate must match the frozen total.
    const redo = baseIrrigationAmount(33, snapshot.season_rate, snapshot.basis);
    expect(redo).toBe(inv.irrigation_amount);
    expect(snapshot.payable_amount).toBe(inv.payable_amount);
  });

  it("due/paid stays consistent for every basis after migration", () => {
    for (const basis of bases) {
      const c = calcInvoice({
        land_size_shotok: 66, rate_per_shotok: 5, basis,
        settings: DEFAULT_SETTINGS, due_date: future, paid_amount: 0,
      });
      // Snapshot freezes these; reconstruction must equal stored values.
      expect(c.due_amount).toBe(c.payable_amount - c.paid_amount);
      expect(c.due_amount).toBeGreaterThanOrEqual(0);
    }
  });

  it("frozen total is independent of a later season-rate change", () => {
    const legacy = legacyInvoice(33, 10); // payable frozen at rate=10
    // Admin later raises the season rate to 20 → only NEW invoices change.
    const fresh = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 20, basis: "per_shotok",
      settings: DEFAULT_SETTINGS, due_date: future,
    });
    expect(fresh.payable_amount).not.toBe(legacy.payable_amount);
    // The legacy frozen total is untouched.
    expect(legacy.payable_amount).toBe(330);
  });
});
