import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import {
  setReceiptLayoutSettings,
  DEFAULT_RECEIPT_LAYOUT,
} from "@/lib/receiptLayoutSettings";

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-COLOR",
  date: "2026-06-20",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1.25.26",
    field_type_bn: "উচু জমি",
  },
  rate: 3939.39,
  current_season_charge: 1300,
  collected_amount: 2860,
  holding_description: "আমন হয় না।",
  patwari_name: "মোঃ আলম",
  patwari_mobile: "01700000000",
  village_union: "বালিয়াডাঙ্গা",
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  setReceiptLayoutSettings(DEFAULT_RECEIPT_LAYOUT);
});

describe("irrigation receipt — black text + configurable padding", () => {
  it("uses only black text (#111), no red/blue/gray colors", () => {
    for (const lang of ["bn", "en"] as const) {
      const html = buildReceiptCopyHtmlForTest(base, "farmer", lang);
      expect(html).not.toContain("#b91c1c");
      expect(html).not.toContain("#333");
      expect(html).not.toContain("#444");
      expect(html).toContain("color:#111");
    }
  });

  it("applies the default holding/patwari bottom padding (12px)", () => {
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    expect(html).toContain("12px");
  });

  it("respects a custom holding bottom padding", () => {
    setReceiptLayoutSettings({ holdingBottomPaddingPx: 30 });
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    expect(html).toContain("1px 0 30px 12px");
  });

  it("respects custom page + bottom page padding", () => {
    setReceiptLayoutSettings({ irrigationPagePaddingPx: 60, irrigationBottomPaddingPx: 70 });
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    expect(html).toContain("padding:60px 60px 70px");
  });

  it("clamps out-of-range padding values", () => {
    setReceiptLayoutSettings({ holdingBottomPaddingPx: 999, irrigationPagePaddingPx: 1 });
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    // holding clamped to 48, page clamped to 24
    expect(html).toContain("1px 0 48px 12px");
    expect(html).toContain("padding:24px 24px");
  });

  it("English and Bangla share the same padding layout", () => {
    setReceiptLayoutSettings({ holdingBottomPaddingPx: 20 });
    const bn = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    const en = buildReceiptCopyHtmlForTest(base, "farmer", "en");
    expect(bn).toContain("1px 0 20px 12px");
    expect(en).toContain("1px 0 20px 12px");
  });
});
