import { describe, it, expect } from "vitest";
import { buildExportTotalsRow, flattenInvoiceForExport, IRR_BN, IRR_EN } from "../irrigationExports";

const sample = [
  { invoice_no: "INV-1", payable_amount: 1300, paid_amount: 1300, due_amount: 0, invoice_status: "paid" },
  { invoice_no: "INV-2", payable_amount: 2600, paid_amount: 1000, due_amount: 1600, invoice_status: "partial_paid" },
  { invoice_no: "INV-3", payable_amount: 1300, paid_amount: 0, due_amount: 1300, invoice_status: "generated" },
];

describe("irrigation export grand totals", () => {
  it("sums payable/paid/due across the filtered set (bn)", () => {
    const row = buildExportTotalsRow(sample, "bn");
    expect(row[IRR_BN.payable]).toBe(5200);
    expect(row[IRR_BN.paid]).toBe(2300);
    expect(row[IRR_BN.due]).toBe(2900);
    expect(String(row[IRR_BN.invoiceNo])).toContain("সর্বমোট");
    expect(String(row[IRR_BN.invoiceNo])).toContain("3");
  });

  it("sums correctly in english locale", () => {
    const row = buildExportTotalsRow(sample, "en");
    expect(row[IRR_EN.due]).toBe(2900);
    expect(String(row[IRR_EN.invoiceNo])).toContain("Grand total");
  });

  it("totals row matches the sum of flattened due column (export == footer)", () => {
    const flatDue = sample
      .map((i) => flattenInvoiceForExport(i, "bn")[IRR_BN.due])
      .reduce((a, b) => a + (Number(b) || 0), 0);
    expect(buildExportTotalsRow(sample, "bn")[IRR_BN.due]).toBe(flatDue);
  });

  it("respects due-only filter math (no cancelled, due>0)", () => {
    const due = sample.filter((i) => i.invoice_status !== "cancelled" && Number(i.due_amount) > 0);
    expect(due.length).toBe(2);
    expect(buildExportTotalsRow(due, "bn")[IRR_BN.due]).toBe(2900);
    expect(buildExportTotalsRow(due, "bn")[IRR_BN.paid]).toBe(1000);
  });

  it("paid-only filter excludes outstanding invoices", () => {
    const paid = sample.filter((i) => i.invoice_status === "paid");
    expect(buildExportTotalsRow(paid, "bn")[IRR_BN.due]).toBe(0);
    expect(buildExportTotalsRow(paid, "bn")[IRR_BN.paid]).toBe(1300);
  });
});
