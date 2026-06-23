import { describe, it, expect } from "vitest";
import { splitBillableArea, type BargaRelation } from "@/lib/irrigationBargaSplit";
import { computeBargaDue } from "@/lib/irrigationBargaDue";
import { allocatePaymentToBarga } from "@/lib/irrigationBargaAllocation";
import type { ChargeSettings } from "@/lib/irrigationInvoice";

const r2 = (v: number) => Math.round(v * 100) / 100;

const settings: ChargeSettings = {
  delay_fee_enabled: false,
} as unknown as ChargeSettings;

function dueRows(parcel_area: number, relations: BargaRelation[], paid = 0) {
  return computeBargaDue({
    owner_farmer_id: "owner",
    parcel_area,
    rate_per_shotok: 10,
    settings,
    due_date: "2026-01-01",
    as_of: "2026-01-01",
    relations,
    paid_amount: paid,
  });
}

describe("Barga split always reconciles to parcel area", () => {
  const cases: Array<{ name: string; area: number; rel: BargaRelation[] }> = [
    { name: "no sharecroppers", area: 100, rel: [] },
    { name: "single full-area borga", area: 100, rel: [{ sharecropper_farmer_id: "a", area_decimal: 100 }] },
    { name: "partial area borga", area: 100, rel: [{ sharecropper_farmer_id: "a", area_decimal: 40 }] },
    {
      name: "multiple sharecroppers by area",
      area: 100,
      rel: [
        { sharecropper_farmer_id: "a", area_decimal: 30 },
        { sharecropper_farmer_id: "b", area_decimal: 25 },
      ],
    },
    {
      name: "percentage based",
      area: 90,
      rel: [{ sharecropper_farmer_id: "a", share_percentage: 50 }],
    },
    {
      name: "rounding-prone thirds",
      area: 100,
      rel: [
        { sharecropper_farmer_id: "a", share_percentage: 33.33 },
        { sharecropper_farmer_id: "b", share_percentage: 33.33 },
      ],
    },
    {
      name: "fractional shotok",
      area: 12.5,
      rel: [{ sharecropper_farmer_id: "a", area_decimal: 7.25 }],
    },
  ];

  for (const c of cases) {
    it(`split area sums to parcel: ${c.name}`, () => {
      const rows = splitBillableArea({ owner_farmer_id: "owner", parcel_area: c.area, relations: c.rel });
      const sum = rows.reduce((s, r) => s + r.billed_area, 0);
      expect(r2(sum)).toBeCloseTo(r2(c.area), 4);
    });

    it(`per-farmer payable sums to whole-parcel payable: ${c.name}`, () => {
      const rows = dueRows(c.area, c.rel);
      const partsPayable = r2(rows.reduce((s, r) => s + r.payable_amount, 0));
      const whole = computeBargaDue({
        owner_farmer_id: "owner",
        parcel_area: c.area,
        rate_per_shotok: 10,
        settings,
        due_date: "2026-01-01",
        as_of: "2026-01-01",
        relations: [],
        paid_amount: 0,
      });
      const wholePayable = r2(whole.reduce((s, r) => s + r.payable_amount, 0));
      expect(partsPayable).toBeCloseTo(wholePayable, 2);
    });
  }
});

describe("Barga payment allocation reconciles", () => {
  it("applied + leftover always equals payment", () => {
    const rows = dueRows(100, [
      { sharecropper_farmer_id: "a", area_decimal: 30 },
      { sharecropper_farmer_id: "b", area_decimal: 25 },
    ]);
    const payment = 400;
    const { allocations, leftover } = allocatePaymentToBarga(payment, rows);
    const applied = r2(allocations.reduce((s, r) => s + r.applied, 0));
    expect(r2(applied + leftover)).toBe(payment);
  });

  it("never over-applies beyond total due", () => {
    const rows = dueRows(100, [{ sharecropper_farmer_id: "a", area_decimal: 50 }]);
    const totalDue = r2(rows.reduce((s, r) => s + r.due_amount, 0));
    const { allocations, leftover } = allocatePaymentToBarga(totalDue + 500, rows);
    const applied = r2(allocations.reduce((s, r) => s + r.applied, 0));
    expect(applied).toBeLessThanOrEqual(totalDue);
    expect(leftover).toBeGreaterThanOrEqual(0);
  });

  it("each due_after is non-negative", () => {
    const rows = dueRows(100, [{ sharecropper_farmer_id: "a", area_decimal: 60 }], 0);
    const { allocations } = allocatePaymentToBarga(150, rows);
    for (const a of allocations) expect(a.due_after).toBeGreaterThanOrEqual(0);
  });
});
