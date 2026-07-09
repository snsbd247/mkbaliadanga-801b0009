import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the args passed into the enrichment so we can assert which invoice
// (refIds) each receipt resolves to. vi.hoisted keeps the spy available inside
// the hoisted vi.mock factory.
const { enrichSpy } = vi.hoisted(() => ({
  enrichSpy: vi.fn(async (input: any) => ({
    bill_info: "সেচ চার্জ",
    owner_self: false,
    cultivator_label: null,
    land_owner_label: null,
    rate: 150,
    member_summary: "",
    current_season_charge: 0,
    penalty_amount: 0,
    maintenance_charge: 0,
    canal_charge: 0,
    discount_amount: 0,
    total_outstanding: 0,
    collected_from_outstanding: input?.paymentAmount ?? 0,
    remark: null,
    holding_description: null,
    patwari_name: null,
    patwari_mobile: null,
    // Echo the resolved invoice so the receipt "land data" is invoice-specific.
    farmerExtras: {
      mouza: `মৌজা-${input?.refIds?.[0] ?? "none"}`,
      dag_no: `দাগ-${input?.refIds?.[0] ?? "none"}`,
      land_size: 10,
      field_type_bn: null,
      owner_type_bn: "",
    },
  })),
}));

vi.mock("@/lib/irrigationReceiptData", () => ({
  buildIrrigationReceiptEnrichment: enrichSpy,
}));


// Per-payment link rows keyed by payment_id, mirroring irrigation_invoice_payments.
const invoiceLinks: Record<string, Array<{ invoice_id: string; collected_amount: number }>> = {
  "pay-4696": [{ invoice_id: "inv-A", collected_amount: 500 }],
  "pay-4697": [{ invoice_id: "inv-B", collected_amount: 700 }],
  "pay-none": [],
};

vi.mock("@/lib/db", () => ({
  db: {
    from: (table: string) => {
      if (table === "irrigation_invoice_payments") {
        return {
          select: () => ({
            eq: (_col: string, payId: string) =>
              Promise.resolve({ data: invoiceLinks[payId] ?? [], error: null }),
          }),
        };
      }
      // unions (only hit when union_id present — our rows keep it null)
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  },
}));

import { buildPaymentReceiptData } from "@/lib/buildPaymentReceiptData";

const ctx = {
  brand: { company_name: "MK", company_name_bn: "এমকে", logo_url: null },
  receiptArgs: { org: {}, signatureUrl: null, options: {} },
  tx: (_en: string, bn: string) => bn,
};

const basePayment = (id: string, amount: number) => ({
  id,
  kind: "irrigation",
  amount,
  note: null,
  created_at: "2026-07-08",
  receipt_no: id,
  verify_token: null,
  farmer_id: "farm-KAIUM",
  farmers: {
    name_bn: "কাইউম", name_en: "Kaium", member_no: "01043", mobile: null,
    village: null, father_name: null, account_number: null, voter_number: null,
    is_voter: false, union_id: null,
  },
  patwaris: null,
  payment_allocations: [], // empty — must fall back to irrigation_invoice_payments
});

describe("buildPaymentReceiptData — invoice link via irrigation_invoice_payments", () => {
  beforeEach(() => enrichSpy.mockClear());

  it("resolves each receipt to its OWN invoice when payment_allocations is empty", async () => {
    const r96 = await buildPaymentReceiptData(basePayment("pay-4696", 500), ctx as any);
    const r97 = await buildPaymentReceiptData(basePayment("pay-4697", 700), ctx as any);

    // Each receipt shows land data derived from its distinct invoice.
    expect(r96.farmer.mouza).toBe("মৌজা-inv-A");
    expect(r96.farmer.dag_no).toBe("দাগ-inv-A");
    expect(r97.farmer.mouza).toBe("মৌজা-inv-B");
    expect(r97.farmer.dag_no).toBe("দাগ-inv-B");
    // The two receipts must NOT be identical (the original bug).
    expect(r96.farmer.mouza).not.toBe(r97.farmer.mouza);

    // Enrichment received the correct per-invoice refIds + collected amounts.
    expect(enrichSpy.mock.calls[0][0].refIds).toEqual(["inv-A"]);
    expect(enrichSpy.mock.calls[0][0].paymentAmount).toBe(500);
    expect(enrichSpy.mock.calls[1][0].refIds).toEqual(["inv-B"]);
    expect(enrichSpy.mock.calls[1][0].paymentAmount).toBe(700);
  });

  it("prefers payment_allocations when present (no fallback query needed)", async () => {
    const p = {
      ...basePayment("pay-alloc", 900),
      payment_allocations: [{ kind: "irrigation", reference_id: "inv-C", amount: 900 }],
    };
    const r = await buildPaymentReceiptData(p, ctx as any);
    expect(r.farmer.mouza).toBe("মৌজা-inv-C");
    expect(enrichSpy.mock.calls[0][0].refIds).toEqual(["inv-C"]);
  });

  it("falls back safely (farmer-level) when neither source has invoice links", async () => {
    const r = await buildPaymentReceiptData(basePayment("pay-none", 100), ctx as any);
    // refIds empty → enrichment still runs with farmerId, no crash.
    expect(enrichSpy.mock.calls[0][0].refIds).toEqual([]);
    expect(enrichSpy.mock.calls[0][0].farmerId).toBe("farm-KAIUM");
    expect(r.farmer.mouza).toBe("মৌজা-none");
  });
});
