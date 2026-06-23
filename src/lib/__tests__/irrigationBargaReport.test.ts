import { describe, it, expect } from "vitest";
import { buildBargaReport } from "../irrigationBargaReport";
import { allocatePaymentToBarga } from "../irrigationBargaAllocation";
import { validateBargaSplit } from "../irrigationBargaValidation";
import type { ChargeSettings } from "../irrigationInvoice";

const settings: ChargeSettings = {} as ChargeSettings;

const parcel = {
  land_id: "L1",
  owner_farmer_id: "OWNER",
  parcel_area: 100,
  rate_per_shotok: 10,
  settings,
  due_date: "2026-06-30",
  paid_amount: 0,
  relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
  farmer_names: { OWNER: "মালিক", SC1: "বর্গাদার" },
};

describe("buildBargaReport", () => {
  it("totals equal the sum of per-row dues (no double-billing)", () => {
    const { rows, totals } = buildBargaReport([parcel]);
    const sum = rows.reduce((s, r) => s + r.due_amount, 0);
    expect(totals.due_amount).toBeCloseTo(sum, 2);
    expect(rows.some((r) => r.is_borga)).toBe(true);
    expect(rows.some((r) => !r.is_borga)).toBe(true);
  });
  it("maps farmer names for export", () => {
    const { rows } = buildBargaReport([parcel]);
    expect(rows.find((r) => r.billed_farmer_id === "SC1")?.billed_farmer_name).toBe("বর্গাদার");
  });
});

describe("allocatePaymentToBarga", () => {
  const dues = [
    { billed_farmer_id: "SC1", owner_farmer_id: "OWNER", is_borga: true, billed_area: 40, payable_amount: 400, paid_amount: 0, due_amount: 400 },
    { billed_farmer_id: "OWNER", owner_farmer_id: "OWNER", is_borga: false, billed_area: 60, payable_amount: 600, paid_amount: 0, due_amount: 600 },
  ];
  it("applies to barga dues first and reconciles", () => {
    const { allocations, leftover } = allocatePaymentToBarga(500, dues);
    const applied = allocations.reduce((s, a) => s + a.applied, 0);
    expect(applied + leftover).toBeCloseTo(500, 2);
    expect(allocations[0].billed_farmer_id).toBe("SC1");
    expect(allocations[0].due_after).toBe(0);
  });
  it("never over-applies past total due", () => {
    const { allocations, leftover } = allocatePaymentToBarga(2000, dues);
    expect(allocations.reduce((s, a) => s + a.applied, 0)).toBeCloseTo(1000, 2);
    expect(leftover).toBeCloseTo(1000, 2);
  });
});

describe("validateBargaSplit", () => {
  it("accepts a reconciling split", () => {
    expect(validateBargaSplit({ parcel_area: 100, relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }] })).toEqual([]);
  });
  it("rejects area over parcel", () => {
    expect(validateBargaSplit({ parcel_area: 100, relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 120 }] }).length).toBeGreaterThan(0);
  });
  it("rejects percentage over 100", () => {
    expect(validateBargaSplit({ parcel_area: 100, relations: [{ sharecropper_farmer_id: "SC1", share_percentage: 60 }, { sharecropper_farmer_id: "SC2", share_percentage: 60 }] }).length).toBeGreaterThan(0);
  });
});
