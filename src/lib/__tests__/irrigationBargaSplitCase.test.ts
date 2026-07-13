import { describe, it, expect } from "vitest";
import { splitBillableArea } from "../irrigationBargaSplit";
import { computeBargaDue } from "../irrigationBargaDue";
import type { ChargeSettings } from "../irrigationInvoice";

/**
 * Regression case reported from live data (mohammadkhani.com):
 * Dilalpur mouza, dag 223 — parcel = 0.6650 shotok, owned by Masud Alam (02150).
 * Two sharecroppers each farm 0.3330 shotok. When invoicing a sharecropper
 * (e.g. SOFIQUL 01698) only their 0.3330 share must be billed, not the whole parcel.
 */
describe("barga split — 2 sharecroppers × 0.3330 on a 0.6650 parcel", () => {
  const owner = "02150";
  const scA = "01698"; // SOFIQUL
  const scB = "02777";
  const parcel = 0.6650;

  const relations = [
    { sharecropper_farmer_id: scA, area_decimal: 0.3330 },
    { sharecropper_farmer_id: scB, area_decimal: 0.3330 },
  ];

  it("bills each sharecropper only their share, not the whole parcel", () => {
    const rows = splitBillableArea({ owner_farmer_id: owner, parcel_area: parcel, relations });
    const a = rows.find((r) => r.billed_farmer_id === scA)!;
    const b = rows.find((r) => r.billed_farmer_id === scB)!;

    expect(a.is_borga).toBe(true);
    expect(a.billed_area).toBeCloseTo(0.3330, 4);
    expect(b.billed_area).toBeCloseTo(0.3330, 4);
    // Selected sharecropper must NOT get the whole parcel.
    expect(a.billed_area).not.toBeCloseTo(parcel, 4);
  });

  it("does not create an owner remainder when the parcel is fully allocated", () => {
    const rows = splitBillableArea({ owner_farmer_id: owner, parcel_area: parcel, relations });
    const ownerRow = rows.find((r) => !r.is_borga);
    expect(ownerRow).toBeUndefined();
  });

  it("sums to the allocated portions (reported 0.3330 × 2 slightly exceeds parcel)", () => {
    const rows = splitBillableArea({ owner_farmer_id: owner, parcel_area: parcel, relations });
    const sum = rows.reduce((acc, r) => acc + r.billed_area, 0);
    // Portion mismatch: 0.3330 + 0.3330 = 0.6660 > 0.6650 parcel — surfaced for warning.
    expect(sum).toBeCloseTo(0.666, 4);
    expect(sum).toBeGreaterThan(parcel);
  });

  it("gives the owner the remainder when sharecroppers cover only part of the parcel", () => {
    const rows = splitBillableArea({
      owner_farmer_id: owner,
      parcel_area: parcel,
      relations: [{ sharecropper_farmer_id: scA, area_decimal: 0.3330 }],
    });
    const ownerRow = rows.find((r) => !r.is_borga)!;
    expect(ownerRow.billed_area).toBeCloseTo(0.3320, 4);
  });

  it("charges each farmer proportional to their billed area only", () => {
    const settings: ChargeSettings = {
      delay_fee_percent: 0,
      maintenance_percent: 0,
      canal_percent: 0,
      grace_days: 0,
      auto_apply_delay_fee: false,
    };

    const dueRows = computeBargaDue({
      owner_farmer_id: owner,
      parcel_area: parcel,
      rate_per_shotok: 100,
      settings,
      due_date: "2026-01-01",
      as_of: "2026-01-01",
      relations,
    });

    const a = dueRows.find((r) => r.billed_farmer_id === scA)!;
    // 0.3330 shotok × 100 = 33.30, rounded to whole taka — not the full-parcel 66.50.
    expect(a.payable_amount).toBe(33);
    const total = dueRows.reduce((acc, r) => acc + r.payable_amount, 0);
    expect(total).toBe(66);
  });
});
