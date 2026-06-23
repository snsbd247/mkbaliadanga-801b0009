import { describe, it, expect } from "vitest";
import { generateInvoices, summarizeDue } from "../irrigationInvoiceGeneration";
import { DEFAULT_SETTINGS } from "../irrigationInvoice";

const base = {
  office_id: "off-1",
  season_id: "sea-1",
  owner_farmer_id: "owner",
  rate_per_shotok: 10,
  settings: DEFAULT_SETTINGS,
  invoice_date: "2026-01-01",
  due_date: "2026-02-01",
  as_of: "2026-01-15",
};

const sumPayable = (rows: ReturnType<typeof generateInvoices>) =>
  rows.reduce((s, r) => s + r.payable_amount, 0);

describe("Step 4 due aggregation reconciliation", () => {
  it("reconciles for rounding-prone thirds (parcel split three ways)", () => {
    const rows = generateInvoices({
      ...base,
      parcel_area: 100,
      relations: [
        { sharecropper_farmer_id: "sc-1", share_percentage: 33.3333 },
        { sharecropper_farmer_id: "sc-2", share_percentage: 33.3333 },
      ],
    });
    const sum = summarizeDue(rows);
    expect(rows.reduce((s, r) => s + r.billed_area, 0)).toBeCloseTo(100, 6);
    expect(sum.payable).toBe(sumPayable(rows));
    expect(sum.due).toBeCloseTo(sum.payable - sum.paid, 2);
  });

  it("reconciles for partial / fractional areas", () => {
    const rows = generateInvoices({
      ...base,
      parcel_area: 57.75,
      paid_amount: 123.45,
      relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 17.25 }],
    });
    const sum = summarizeDue(rows);
    const paid = rows.reduce((s, r) => s + r.paid_amount, 0);
    const due = rows.reduce((s, r) => s + r.due_amount, 0);
    expect(paid + due).toBeCloseTo(sum.payable, 2);
    expect(sum.paid).toBeCloseTo(paid, 2);
    expect(sum.due).toBeCloseTo(due, 2);
  });

  it("reconciles across multiple Barga splits without drift", () => {
    const rows = generateInvoices({
      ...base,
      parcel_area: 200,
      paid_amount: 777,
      relations: [
        { sharecropper_farmer_id: "sc-1", area_decimal: 33.33 },
        { sharecropper_farmer_id: "sc-2", area_decimal: 66.67 },
        { sharecropper_farmer_id: "sc-3", share_percentage: 12.5 },
      ],
    });
    const sum = summarizeDue(rows);
    expect(rows.reduce((s, r) => s + r.billed_area, 0)).toBeCloseTo(200, 6);
    expect(sum.payable).toBe(sumPayable(rows));
    expect(sum.paid + sum.due).toBeCloseTo(sum.payable, 2);
    rows.forEach((r) => expect(r.due_amount).toBeGreaterThanOrEqual(0));
  });

  it("never over-applies paid beyond payable", () => {
    const rows = generateInvoices({
      ...base,
      parcel_area: 100,
      paid_amount: 99999,
      relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 40 }],
    });
    const sum = summarizeDue(rows);
    expect(sum.paid).toBeLessThanOrEqual(sum.payable);
    expect(sum.due).toBe(0);
  });
});
