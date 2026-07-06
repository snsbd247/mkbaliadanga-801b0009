import { describe, it, expect, vi } from "vitest";
import {
  computeIrrigationDue,
  computeIrrigationDueByFarmer,
  isActiveInvoice,
  assertNoLegacyDueSource,
  type DueInvoiceRow,
} from "../dues";

describe("computeIrrigationDue", () => {
  it("sums due_amount for active invoices", () => {
    const rows: DueInvoiceRow[] = [
      { due_amount: 10000, invoice_status: "unpaid" },
      { due_amount: 6833, invoice_status: "partial" },
    ];
    expect(computeIrrigationDue(rows)).toBe(16833);
  });

  it("treats NULL/empty invoice_status as active (does NOT show 0)", () => {
    // Regression: a farmer with 16,833 due across NULL-status invoices must NOT
    // collapse to 0 like a PostgREST .neq() filter would cause.
    const rows: DueInvoiceRow[] = [
      { due_amount: 10000, invoice_status: null },
      { due_amount: 6833, invoice_status: "" },
    ];
    expect(computeIrrigationDue(rows)).toBe(16833);
  });

  it("excludes cancelled and soft-deleted invoices", () => {
    const rows: DueInvoiceRow[] = [
      { due_amount: 16833, invoice_status: "unpaid" },
      { due_amount: 5000, invoice_status: "cancelled" },
      { due_amount: 5000, invoice_status: "unpaid", deleted_at: "2026-01-01" },
    ];
    expect(computeIrrigationDue(rows)).toBe(16833);
  });

  it("clamps negative due to 0", () => {
    expect(computeIrrigationDue([{ due_amount: -500 }])).toBe(0);
  });

  it("handles null/undefined input", () => {
    expect(computeIrrigationDue(null)).toBe(0);
    expect(computeIrrigationDue(undefined)).toBe(0);
  });
});

describe("Farmer List vs FarmerDetail irrigation due parity", () => {
  // Both views must derive the same number from the same rows.
  const sample: DueInvoiceRow[] = [
    { farmer_id: "f1", due_amount: 10000, invoice_status: null },
    { farmer_id: "f1", due_amount: 6833, invoice_status: "unpaid" },
    { farmer_id: "f1", due_amount: 4000, invoice_status: "cancelled" },
    { farmer_id: "f2", due_amount: 1200, invoice_status: "partial" },
  ];

  it("per-farmer map matches the flat sum for that farmer", () => {
    const byFarmer = computeIrrigationDueByFarmer(sample);
    const detailDue = computeIrrigationDue(sample.filter((r) => r.farmer_id === "f1"));
    expect(byFarmer["f1"]).toBe(16833);
    expect(byFarmer["f1"]).toBe(detailDue);
    expect(byFarmer["f2"]).toBe(1200);
  });

  it("edge-case statuses stay identical across both computations", () => {
    const statuses = [null, "", "unpaid", "partial", "issued", "overdue"];
    const rows: DueInvoiceRow[] = statuses.map((s) => ({
      farmer_id: "f1",
      due_amount: 100,
      invoice_status: s,
    }));
    const byFarmer = computeIrrigationDueByFarmer(rows);
    const detailDue = computeIrrigationDue(rows);
    expect(byFarmer["f1"]).toBe(detailDue);
    expect(detailDue).toBe(statuses.length * 100);
  });
});

describe("isActiveInvoice", () => {
  it("keeps NULL status, drops cancelled/deleted", () => {
    expect(isActiveInvoice({ invoice_status: null })).toBe(true);
    expect(isActiveInvoice({ invoice_status: "cancelled" })).toBe(false);
    expect(isActiveInvoice({ deleted_at: "x" })).toBe(false);
  });
});

describe("assertNoLegacyDueSource", () => {
  it("returns true for irrigation_invoices source", () => {
    expect(assertNoLegacyDueSource("select due_amount from irrigation_invoices")).toBe(true);
  });

  it("detects and logs deprecated irrigation_charges", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(assertNoLegacyDueSource("select due_amount from irrigation_charges")).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
