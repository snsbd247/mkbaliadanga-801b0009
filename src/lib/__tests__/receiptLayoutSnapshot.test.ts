import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import {
  setReceiptLayoutSettings,
  DEFAULT_RECEIPT_LAYOUT,
  applyReceiptPreset,
} from "@/lib/receiptLayoutSettings";

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-SNAP-1",
  date: "2026-06-20",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1,2,3",
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

describe("irrigation receipt — full rendered layout snapshots", () => {
  it("matches the Bangla farmer copy snapshot", () => {
    expect(buildReceiptCopyHtmlForTest(base, "farmer", "bn")).toMatchSnapshot();
  });

  it("matches the English farmer copy snapshot", () => {
    expect(buildReceiptCopyHtmlForTest(base, "farmer", "en")).toMatchSnapshot();
  });

  it("matches the Bangla office copy snapshot", () => {
    expect(buildReceiptCopyHtmlForTest(base, "office", "bn")).toMatchSnapshot();
  });

  it("snapshot reflects an applied printer preset (compact)", () => {
    applyReceiptPreset("compact-thermal");
    expect(buildReceiptCopyHtmlForTest(base, "farmer", "bn")).toMatchSnapshot();
  });

  // Layout invariants guarded regardless of snapshot churn.
  it("both languages enforce black text and holding bottom padding", () => {
    for (const lang of ["bn", "en"] as const) {
      const html = buildReceiptCopyHtmlForTest(base, "farmer", lang);
      expect(html).toContain("color:#111");
      expect(html).toContain("1px 0 12px 12px"); // default holding padding block
      expect(html).not.toContain("#b91c1c");
    }
  });
});
