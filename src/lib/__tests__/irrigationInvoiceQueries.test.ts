import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db layer used by the shared query util so we can assert the filtering
// behaviour without a live backend. Both Payments and IrrigationPaymentPanel
// route through fetchOpenIrrigationInvoices, so this covers both surfaces.
const orderMock = vi.fn();
const isMock = vi.fn();
vi.mock("@/lib/db", () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: (...args: any[]) => isMock(...args),
    gt: vi.fn(() => builder),
    order: (...args: any[]) => orderMock(...args),
  };
  return { db: { from: vi.fn(() => builder) } };
});

import { fetchOpenIrrigationInvoices, fetchOpenIrrigationInvoicesResult } from "../irrigationInvoiceQueries";

beforeEach(() => {
  orderMock.mockReset();
  isMock.mockReset();
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
    expect(isMock).not.toHaveBeenCalled();
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

  // Regression: deleted_at filtering happens in JS, never via a server-side
  // `.is`/`.neq` operator that would also drop NULL-status valid invoices.
  it("never calls a server-side deleted_at filter (both adapters safe)", async () => {
    orderMock.mockResolvedValue({
      data: [{ id: "1", due_amount: 100, invoice_status: null, deleted_at: null }],
      error: null,
    });
    const rows = await fetchOpenIrrigationInvoices("farmer-1", "id,due_amount");
    expect(rows.map((r) => r.id)).toEqual(["1"]);
    expect(isMock).not.toHaveBeenCalled();
  });

  it("keeps invoices where deleted_at is undefined (column not selected)", async () => {
    orderMock.mockResolvedValue({
      data: [
        { id: "1", due_amount: 100, invoice_status: "generated" },
        { id: "2", due_amount: 200, invoice_status: null },
      ],
      error: null,
    });
    const rows = await fetchOpenIrrigationInvoices("farmer-1", "id,due_amount,invoice_status");
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("fetchOpenIrrigationInvoicesResult (error surfacing)", () => {
  it("returns rows with no error on success", async () => {
    orderMock.mockResolvedValue({
      data: [{ id: "1", due_amount: 100, invoice_status: null }],
      error: null,
    });
    const res = await fetchOpenIrrigationInvoicesResult("farmer-1", "id,due_amount");
    expect(res.rows.map((r) => r.id)).toEqual(["1"]);
    expect(res.error).toBeNull();
    expect(res.traceId).toBeNull();
  });

  it("returns a trace id and error message when the query fails", async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: "boom", code: "42P01" } });
    const res = await fetchOpenIrrigationInvoicesResult("farmer-1", "id,due_amount");
    expect(res.rows).toEqual([]);
    expect(res.error?.message).toBe("boom");
    expect(res.traceId).toBeTruthy();
  });
});

import { filterInvoicesByStatus } from "../irrigationInvoiceQueries";

describe("filterInvoicesByStatus (Open/Cancelled UI filter)", () => {
  const rows = [
    { id: "open-null", due_amount: 100, invoice_status: null },
    { id: "open-generated", due_amount: 50, invoice_status: "generated" },
    { id: "cancelled", due_amount: 0, invoice_status: "cancelled" },
    { id: "deleted", due_amount: 30, invoice_status: "generated", deleted_at: "2026-01-01" },
  ] as any[];

  it("Open keeps NULL + active, drops cancelled and soft-deleted", () => {
    expect(filterInvoicesByStatus(rows, "open").map((r) => r.id)).toEqual(["open-null", "open-generated"]);
  });

  it("Cancelled keeps only cancelled + soft-deleted (deleted_at regression rule)", () => {
    expect(filterInvoicesByStatus(rows, "cancelled").map((r) => r.id)).toEqual(["cancelled", "deleted"]);
  });

  it("handles null/empty input", () => {
    expect(filterInvoicesByStatus(null as any, "open")).toEqual([]);
  });
});
