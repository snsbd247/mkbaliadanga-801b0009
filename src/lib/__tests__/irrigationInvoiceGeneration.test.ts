import { describe, it, expect } from "vitest";
import {
  generateInvoices,
  filterInvoices,
  summarizeDue,
} from "../irrigationInvoiceGeneration";
import { DEFAULT_SETTINGS } from "../irrigationInvoice";

const base = {
  office_id: "off-1",
  season_id: "sea-1",
  owner_farmer_id: "owner",
  parcel_area: 100,
  rate_per_shotok: 10,
  settings: DEFAULT_SETTINGS,
  invoice_date: "2026-01-01",
  due_date: "2026-02-01",
  as_of: "2026-01-15", // before due date → not overdue
};

describe("generateInvoices", () => {
  it("bills the owner for the full parcel when there are no sharecroppers", () => {
    const rows = generateInvoices({ ...base, relations: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].billed_farmer_id).toBe("owner");
    expect(rows[0].billed_area).toBe(100);
    expect(rows[0].payable_amount).toBe(1000);
  });

  it("splits payable across owner remainder + sharecroppers, summing to whole parcel", () => {
    const rows = generateInvoices({
      ...base,
      relations: [
        { sharecropper_farmer_id: "sc-1", area_decimal: 40 },
        { sharecropper_farmer_id: "sc-2", share_percentage: 20 },
      ],
    });
    const totalPayable = rows.reduce((s, r) => s + r.payable_amount, 0);
    const totalArea = rows.reduce((s, r) => s + r.billed_area, 0);
    expect(totalArea).toBe(100);
    expect(totalPayable).toBe(1000);
    expect(rows.find((r) => r.billed_farmer_id === "owner")!.billed_area).toBe(40);
  });

  it("allocates paid proportionally so applied + due reconciles to payable", () => {
    const rows = generateInvoices({
      ...base,
      paid_amount: 500,
      relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 50 }],
    });
    const paid = rows.reduce((s, r) => s + r.paid_amount, 0);
    const due = rows.reduce((s, r) => s + r.due_amount, 0);
    expect(paid + due).toBeCloseTo(1000, 2);
    expect(paid).toBeCloseTo(500, 2);
  });
});

describe("filterInvoices", () => {
  const rows = generateInvoices({
    ...base,
    relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 60 }],
  });

  it("filters by farmer without changing amounts", () => {
    const out = filterInvoices(rows, { farmer_id: "sc-1" });
    expect(out).toHaveLength(1);
    expect(out[0].payable_amount).toBe(rows.find((r) => r.billed_farmer_id === "sc-1")!.payable_amount);
  });

  it("filters by office and date range", () => {
    expect(filterInvoices(rows, { office_id: "other" })).toHaveLength(0);
    expect(filterInvoices(rows, { from: "2026-01-01", to: "2026-01-31" })).toHaveLength(rows.length);
    expect(filterInvoices(rows, { from: "2026-03-01" })).toHaveLength(0);
  });
});

describe("summarizeDue", () => {
  it("reconciles aggregate totals with the rows", () => {
    const rows = generateInvoices({
      ...base,
      paid_amount: 300,
      relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 50 }],
    });
    const sum = summarizeDue(rows);
    expect(sum.payable).toBe(1000);
    expect(sum.paid).toBeCloseTo(300, 2);
    expect(sum.due).toBeCloseTo(700, 2);
    expect(sum.invoiceCount).toBe(rows.length);
  });

  it("counts overdue dues only when past due date", () => {
    const overdueRows = generateInvoices({
      ...base,
      as_of: "2026-03-01", // after due date
      relations: [],
    });
    expect(summarizeDue(overdueRows).overdue).toBe(1000);
  });
});
