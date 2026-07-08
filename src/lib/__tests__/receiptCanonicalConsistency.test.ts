import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the irrigation enrichment so the builder is deterministic and DB-free.
vi.mock("@/lib/irrigationReceiptData", () => ({
  buildIrrigationReceiptEnrichment: vi.fn(async () => ({
    bill_info: "সেচ চার্জ",
    owner_self: false,
    cultivator_label: "শ্রী হাসান-০০০৪৬",
    land_owner_label: "Hasan Pramanik-নাই",
    rate: 150,
    member_summary: "চাষি/বর্গাদারঃ শ্রী হাসান (সঞ্চয়ী নং ০০০৪৬), মালিকঃ Hasan Pramanik (সঞ্চয়ী নং নাই)",
    current_season_charge: 1875,
    penalty_amount: 0,
    maintenance_charge: 0,
    canal_charge: 0,
    discount_amount: 0,
    total_outstanding: 1875,
    collected_from_outstanding: 1875,
    remark: null,
    holding_description: null,
    patwari_name: null,
    patwari_mobile: null,
    farmerExtras: { mouza: "মৌজা-১", field_type_bn: "নিচু জমি", land_size: 12.5, dag_no: "১২৩৪" },
  })),
}));

// Mock db used by fetchPaymentReceiptData.
const paymentRow = {
  id: "pay-1",
  kind: "irrigation",
  amount: 1875,
  note: null,
  created_at: "2026-05-06",
  receipt_no: "IRR-20260506-AAAA01",
  verify_token: "tok",
  farmer_id: "farm-1",
  farmers: {
    name_bn: "শ্রী হাসান", name_en: "Sri Hasan", member_no: "০০০৪৬",
    mobile: "01700000000", village: "নবীনগর", father_name: null,
    account_number: "০০০৪৬", voter_number: null, is_voter: false, union_id: null,
  },
  patwaris: null,
  payment_allocations: [{ kind: "irrigation", reference_id: "inv-1", amount: 1875 }],
};

vi.mock("@/lib/db", () => ({
  db: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: paymentRow, error: null }) }),
        }),
      }),
    }),
  },
}));

import { buildPaymentReceiptData, fetchPaymentReceiptData } from "@/lib/buildPaymentReceiptData";

const ctx = {
  brand: { company_name: "MK", company_name_bn: "এমকে", logo_url: null },
  receiptArgs: { org: {}, signatureUrl: null, options: {} },
  tx: (_en: string, bn: string) => bn,
};

describe("canonical irrigation receipt consistency across entry points", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetchPaymentReceiptData and buildPaymentReceiptData produce identical data", async () => {
    const fetched = await fetchPaymentReceiptData("pay-1", ctx as any);
    const built = await buildPaymentReceiptData(paymentRow, ctx as any);
    expect(fetched).toEqual(built);
  });

  it("canonical data never carries a পরিশোধকৃত টাকা field/value", async () => {
    const data = await fetchPaymentReceiptData("pay-1", ctx as any);
    expect(JSON.stringify(data)).not.toContain("পরিশোধকৃত টাকা");
  });

  it("owner without savings account shows নাই, cultivator shows savings number", async () => {
    const data = await fetchPaymentReceiptData("pay-1", ctx as any);
    expect(data.member_summary).toContain("০০০৪৬");
    expect(data.member_summary).toContain("নাই");
  });

  it("throws a clear error when payment id is missing", async () => {
    await expect(fetchPaymentReceiptData("", ctx as any)).rejects.toThrow(/required/i);
  });
});
