import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db layer used by the shared query util so we can assert the filtering
// behaviour without a live backend. Both Payments and IrrigationPaymentPanel
// route through fetchOpenIrrigationInvoices, so this covers both surfaces.
const orderMock = vi.fn();
vi.mock("@/lib/db", () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    order: (...args: any[]) => orderMock(...args),
  };
  return { db: { from: vi.fn(() => builder) } };
});

import { fetchOpenIrrigationInvoices } from "../irrigationInvoiceQueries";

beforeEach(() => {
  orderMock.mockReset();
});

describe("fetchOpenIrrigationInvoices (shared by Payments & IrrigationPaymentPanel)", () => {
  it("keeps invoices whose invoice_status is NULL (does not drop unpaid ones)", async () => {
    orderMock.mockResolvedValue({
      data: [
        { id: "1", due_amount: 10000, invoice_status: null },
        { id: "2", due_amount: 6833, invoice_status: "generated" },
      ],
      error: null,
    });
    const rows = await fetchOpenIrrigationInvoices("farmer-1", "id,due_amount,invoice_status");
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(rows.reduce((s, r) => s + Number(r.due_amount), 0)).toBe(16833);
  });

  it("keeps empty-string status but drops cancelled and soft-deleted", async () => {
    orderMock.mockResolvedValue({
      data: [
        { id: "1", due_amount: 500, invoice_status: "" },
        { id: "2", due_amount: 500, invoice_status: "cancelled" },
        { id: "3", due_amount: 500, invoice_status: "generated", deleted_at: "2026-01-01" },
      ],
      error: null,
    });
    const rows = await fetchOpenIrrigationInvoices("farmer-1", "id,due_amount,invoice_status,deleted_at");
    expect(rows.map((r) => r.id)).toEqual(["1"]);
  });

  it("returns [] on empty result", async () => {
    orderMock.mockResolvedValue({ data: [], error: null });
    expect(await fetchOpenIrrigationInvoices("x", "id")).toEqual([]);
  });
});
