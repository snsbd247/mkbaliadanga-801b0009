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

const baseInvoice = {
  id: "inv-1",
  invoice_no: "IRR-001",
  farmer_id: "cult-1",
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
};

const baseLand = {
  id: "land-1",
  mouza: "বালিয়াডাঙ্গা",
  mouza_id: null,
  dag_no: "১২৩, ৪৫৬",
  land_size: 1.5,
  field_type: "high_land",
  owner_type: "self",
  owner_farmer_id: null,
  patwari_id: "pat-1",
  notes: "নিজ সেচে আবাদ হয়।",
};

const patwariRow = { id: "pat-1", name: "Alam", name_bn: "মোঃ আলম", mobile: "0170000000" };

describe("buildIrrigationReceiptEnrichment", () => {
  beforeEach(() => {
    resultQueue.length = 0;
  });

  it("derives land/charge fields + cultivator savings number (self land)", async () => {
    // Query order: invoices, lands, patwari-by-id, totalOutstanding, cultivator.
    resultQueue.push({ data: [baseInvoice] });
    resultQueue.push({ data: [baseLand] });
    resultQueue.push({ data: [patwariRow] });
    resultQueue.push({ data: [{ due_amount: 0 }] });
    resultQueue.push({ data: { id: "cult-1", name_bn: "মোঃ মাসুদ", member_no: "1920", account_number: "1920", savings_inactive: false } });

    const e = await buildIrrigationReceiptEnrichment({
      farmerId: "cult-1",
      paymentAmount: 4039,
      paymentNote: null,
      memberNoFallback: "1920",
    });

    expect(e.farmerExtras.mouza).toBe("বালিয়াডাঙ্গা");
    expect(e.farmerExtras.dag_no).toBe("১২৩, ৪৫৬");
    expect(e.farmerExtras.land_size).toBe(1.5);
    expect(e.owner_self).toBe(true);
    expect(e.cultivator_label).toBe("মোঃ মাসুদ-1920");
    expect(e.land_owner_label).toBe("নিজ");
    expect(e.patwari_name).toBe("মোঃ আলম");
    // Cultivator is a savings member → account number shows.
    expect(e.member_summary).toBe("1920");
  });

  it("holding_description uses only the land note, not the payment note", async () => {
    resultQueue.push({ data: [baseInvoice] });
    resultQueue.push({ data: [baseLand] });
    resultQueue.push({ data: [patwariRow] });
    resultQueue.push({ data: [{ due_amount: 0 }] });
    resultQueue.push({ data: { id: "cult-1", name_bn: "মোঃ মাসুদ", member_no: "1920", account_number: "1920", savings_inactive: false } });

    const e = await buildIrrigationReceiptEnrichment({
      farmerId: "cult-1",
      paymentAmount: 4039,
      paymentNote: "পেমেন্ট নোট",
      memberNoFallback: "1920",
    });

    expect(e.holding_description).toBe("নিজ সেচে আবাদ হয়।");
    expect(e.holding_description).not.toContain("পেমেন্ট নোট");

  it("shows borgadar + owner names and N/A when cultivator is not a savings member", async () => {
    const borgaInvoice = { ...baseInvoice, is_borga: true };
    const borgaLand = { ...baseLand, owner_farmer_id: "own-1", patwari_id: null };
    // Query order: invoices, lands, owner farmers, totalOutstanding, cultivator.
    resultQueue.push({ data: [borgaInvoice] });
    resultQueue.push({ data: [borgaLand] });
    resultQueue.push({ data: [{ id: "own-1", name_bn: "মালিক সাহেব", member_no: "1687", farmer_code: null }] });
    resultQueue.push({ data: [{ due_amount: 0 }] });
    resultQueue.push({ data: { id: "cult-1", name_bn: "বর্গা চাষি", member_no: "1920", account_number: null, savings_inactive: false } });

    const e = await buildIrrigationReceiptEnrichment({
      farmerId: "cult-1",
      paymentAmount: 4039,
      paymentNote: null,
      memberNoFallback: "1920",
    });

    expect(e.owner_self).toBe(false);
    expect(e.cultivator_label).toBe("বর্গা চাষি-1920");
    expect(e.land_owner_label).toBe("মালিক সাহেব-1687");
    // No savings account number → N/A.
    expect(e.member_summary).toBe("N/A");
  });

  it("returns safe defaults when no invoices exist", async () => {
    resultQueue.push({ data: [] });
    resultQueue.push({ data: [] });
    const e = await buildIrrigationReceiptEnrichment({ farmerId: "x", memberNoFallback: null });
    expect(e.farmerExtras.mouza).toBeNull();
    expect(e.bill_info).toBe("সেচ চার্জ");
    expect(e.member_summary).toBe("N/A");
  });
});
