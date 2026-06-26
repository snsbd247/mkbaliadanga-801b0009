import { describe, it, expect } from "vitest";
import {
  buildReceiptCopyHtmlForTest,
  IRRIGATION_RECEIPT_PAGE,
  type BnReceiptData,
} from "@/lib/bnReceipts";

/**
 * QA snapshot test: locks the official "সেচ চার্জ ও বিবিধ আদায় রশিদ" layout to the
 * client-provided sample receipt. If the row order, colour coding, A5-landscape page
 * config, or any sample field disappears, this test fails — preventing regressions
 * back to A4/portrait or to a layout that no longer matches the sample.
 */
const SAMPLE: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "2652",
  date: "2026-06-20",
  bill_info: "ইরি-২৬/আমন-২৬/হওলাত গ্রহন/অনুদান/ভাংড়ী বিক্রি/ বিবিধ",
  company_name_bn: "মহাম্মদখানি",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    field_type_bn: "উচু জমি/নিচু জমি/বিঘাতা/ভর্তি ফি/সবজি/পুকুর",
    dag_no: "1,25,25,26,26,24,28,264,247,2852",
    land_size: 33,
  },
  village_union: "বালিয়াডাঙ্গা",
  member_summary: "1900/ N/A",
  land_owner_label: "মালিক: কেন্দ্রীয় জামে মসজিদ-১৬৮৭ বা নিজ",
  owner_self: false,
  rate: 3939,
  rate_per_bigha: 1300,
  current_season_charge: 1300,
  current_penalty: 130,
  total_outstanding: 1300,
  due_penalty: 130,
  holding_description: "আমন হয় না।নিজ সেচে আবাদ হয়।",
  patwari_name: "মোঃ আলম ইসলাম",
  patwari_mobile: "017000000000",
  collected_amount: 2860,
};

describe("সেচ রশিদ — sample layout QA", () => {
  const html = buildReceiptCopyHtmlForTest(SAMPLE, "farmer", "bn");

  it("page config is permanently locked to A5 landscape with fixed margins", () => {
    expect(IRRIGATION_RECEIPT_PAGE.paper).toBe("a5");
    expect(IRRIGATION_RECEIPT_PAGE.orientation).toBe("l");
    expect(IRRIGATION_RECEIPT_PAGE.margins).toEqual({ t: 8, r: 8, b: 8, l: 8 });
    // Render width must keep the A5-landscape aspect (wider than tall).
    expect(IRRIGATION_RECEIPT_PAGE.aspectRatio).toBeGreaterThan(1);
    expect(IRRIGATION_RECEIPT_PAGE.renderWidthPx).toBe(1040);
  });

  it("renders every row from the sample in the exact order", () => {
    const labels = [
      "কৃষকের নাম ও আইডি", // farmer/owner (red+blue)
      "পিতার/স্বামীর নাম",
      "গ্রাম/মহল্লা/মোবাইল নং",
      "কৃষক এবং মালিক সভ্য সদস্য",
      "মৌজা",
      "জমির ধরন", // land type / rate (red+blue)
      "দাগ নং",
      "জমির পরিমাণ",
      "চার্জের পরিমাণ (হাল)/জরিমানা",
      "চার্জের পরিমাণ (বকেয়া)/জরিমানা",
      "মোট আদায়ের পরিমাণ",
      "কথায়",
      "হোল্ডিং এর বিবরন",
    ];
    let cursor = -1;
    for (const label of labels) {
      const idx = html.indexOf(label, cursor + 1);
      expect(idx, `"${label}" should appear after the previous row`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("colour-codes farmer + land-type labels like the sample (red/blue)", () => {
    expect(html).toContain("color:#ff0000"); // red
    expect(html).toContain("color:#4a90e2"); // blue
  });

  it("matches the sample values exactly", () => {
    expect(html).toContain("মোঃ মাসুদ রানা-১৯২০"); // farmer name + id
    expect(html).toContain("মালিক: কেন্দ্রীয় জামে মসজিদ-১৬৮৭ বা নিজ");
    expect(html).toContain("ঘোনটোলা,বালিয়াডাঙ্গা/০১৭১৫৬৯৯৭৬৭"); // village,union/mobile
    expect(html).toContain("১৯০০/ N/A"); // member summary
    expect(html).toContain("রন্দ"); // mouza
    expect(html).toContain("৩৯৩৯টাকা/১৩০০টাকা"); // rate acre/bigha
    expect(html).toContain("১.২৫.২৫.২৬.২৬.২৪.২৮.২৬৪.২৪৭.২৮৫২"); // dotted dag list
    expect(html).toContain("০.৩৩০০ একর"); // land size, 4 decimals
    expect(html).toContain("১৩০০৳/১৩০৳"); // হাল charge/penalty
    expect(html).toContain("২৮৬০৳"); // total (1300+130+1300+130)
    expect(html).toContain("মাত্র।"); // amount in words suffix
    expect(html).toContain("মোঃ আলম ইসলাম-০১৭০০০০০০০০০"); // patwari
  });

  it("renders no visible Farmer/Office copy box for the official receipt", () => {
    // Single-copy layout: the copy label must not be shown as a bordered box.
    expect(html).not.toContain("padding:2px 14px;margin-top:6px");
  });
});
