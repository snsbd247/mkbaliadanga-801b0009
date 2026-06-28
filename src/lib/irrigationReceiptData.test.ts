import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable supabase mock: each .from() consumes one queued result; every query
// method returns the builder, and the builder is awaitable to { data }.
const resultQueue: any[] = [];
function makeBuilder() {
  const result = resultQueue.shift() ?? { data: [] };
  const builder: any = {};
  const methods = ["select", "in", "eq", "is", "neq", "order", "not", "limit", "maybeSingle"];
  for (const m of methods) builder[m] = vi.fn(() => builder);
  builder.then = (resolve: any) => resolve(result);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => makeBuilder()) },
}));

vi.mock("@/lib/irrigationLandType", () => ({
  resolveFieldTypeLabel: ({ landTypeName }: any) => landTypeName ?? null,
}));

import { buildIrrigationReceiptEnrichment } from "./irrigationReceiptData";

const invoiceRow = {
  id: "inv-1",
  invoice_no: "IRR-001",
  irrigation_amount: 3939,
  maintenance_amount: 0,
  canal_amount: 0,
  delay_fee: 100,
  due_amount: 0,
  is_borga: false,
  land_id: "land-1",
  note: null,
  due_date: "2026-01-01",
  season_rate: 3939,
  land_type_name: "উঁচু জমি",
  irrigation_category_name: "আমন২৬",
  seasons: { name: "আমন ২০২৬", year: 2026, status: "active" },
  lands: {
    mouza: "বালিয়াডাঙ্গা",
    dag_no: "১২৩, ৪৫৬",
    land_size: 1.5,
    field_type: "high_land",
    owner_type: "self",
    owner_farmer_id: null,
    notes: "নিজ সেচে আবাদ হয়।",
    patwaris: { name: "Alam", name_bn: "মোঃ আলম", mobile: "0170000000" },
    owner: null,
  },
};

describe("buildIrrigationReceiptEnrichment", () => {
  beforeEach(() => {
    resultQueue.length = 0;
  });

  it("derives land/charge fields from invoice data (no blanks)", async () => {
    // 1) invoice rows by farmer, 2) all dues for outstanding
    resultQueue.push({ data: [invoiceRow] });
    resultQueue.push({ data: [{ due_amount: 0 }] });

    const e = await buildIrrigationReceiptEnrichment({
      farmerId: "farmer-1",
      paymentAmount: 4039,
      paymentNote: null,
      memberNoFallback: "M-100",
    });

    expect(e.farmerExtras.mouza).toBe("বালিয়াডাঙ্গা");
    expect(e.farmerExtras.dag_no).toBe("১২৩, ৪৫৬");
    expect(e.farmerExtras.land_size).toBe(1.5);
    expect(e.farmerExtras.field_type_bn).toBe("উঁচু জমি");
    expect(e.farmerExtras.owner_type_bn).toBe("মালিক");
    expect(e.rate).toBeGreaterThan(0);
    expect(e.current_season_charge).toBe(3939);
    expect(e.penalty_amount).toBe(100);
    expect(e.owner_self).toBe(true);
    expect(e.land_owner_label).toBe("নিজ");
    expect(e.patwari_name).toBe("মোঃ আলম");
    expect(e.holding_description).toContain("নিজ সেচে আবাদ হয়।");
  });

  it("returns safe defaults when no invoices exist", async () => {
    resultQueue.push({ data: [] });
    resultQueue.push({ data: [] });
    const e = await buildIrrigationReceiptEnrichment({ farmerId: "x", memberNoFallback: null });
    expect(e.farmerExtras.mouza).toBeNull();
    expect(e.bill_info).toBe("সেচ চার্জ");
  });
});
