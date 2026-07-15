import { describe, it, expect } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";

/**
 * Locks the official "সেচ চার্জ ও বিবিধ আদায় রশিদ" formatting rules to the demo:
 *  - Bengali digits everywhere (member id, mobile, member summary, patwari mobile)
 *  - Whole-number amounts: charges/total with ৳, rate with টাকা (no thousands comma, no .00)
 *  - Dag numbers dot-separated
 *  - "মাত্র।" appended to the in-words line
 */
const baseData: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "2652",
  date: "2026-06-20",
  bill_info: "ইরি-২৬",
  company_name_bn: "মহাম্মদখানি",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    field_type_bn: "উচু জমি",
    dag_no: "1,25,25,26,264,2852",
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
  holding_description: "আমন হয় না।",
  patwari_name: "মোঃ আলম ইসলাম",
  patwari_mobile: "017000000000",
} as unknown as BnReceiptData;

function html() {
  return buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
}

describe("bnReceipts official irrigation formatting", () => {
  it("renders member id in Bengali digits", () => {
    expect(html()).toContain("মোঃ মাসুদ রানা-১৯২০");
  });

  it("renders mobile and member summary in Bengali digits", () => {
    const h = html();
    expect(h).toContain("০১৭১৫৬৯৯৭৬৭");
    expect(h).toContain("১৯০০/ N/A");
  });

  it("renders rate as whole-number with টাকা (no comma, no decimals)", () => {
    const h = html();
    expect(h).toContain("৩৯৩৯টাকা/১৩০০টাকা");
    expect(h).not.toContain("৩,৯৩৯");
    expect(h).not.toContain("৩৯৩৯.০০");
  });

  it("renders charges and total as whole-number with ৳", () => {
    const h = html();
    expect(h).toContain("১৩০০৳/১৩০৳");
    expect(h).toContain("২৮৬০৳"); // 1300+130+1300+130
  });

  it("renders dag numbers dot-separated", () => {
    expect(html()).toContain("১.২৫.২৫.২৬.২৬৪.২৮৫২");
  });

  it("appends মাত্র। to the in-words line", () => {
    expect(html()).toContain("মাত্র।");
  });

  it("renders land size with 4 decimal places in shotok/decimal", () => {
    expect(html()).toContain("৩৩.০০০০ শতক");
  });

  it("renders patwari mobile in Bengali digits", () => {
    expect(html()).toContain("মোঃ আলম ইসলাম-০১৭০০০০০০০০০");
  });

  it("shows borgadar/owner split when owner_self is false", () => {
    const h = html();
    expect(h).toContain("মালিক: কেন্দ্রীয় জামে মসজিদ-১৬৮৭ বা নিজ");
  });

  it("shows only farmer name (no owner label) when owner_self is true", () => {
    const selfHtml = buildReceiptCopyHtmlForTest(
      { ...baseData, owner_self: true } as BnReceiptData,
      "farmer",
      "bn",
    );
    expect(selfHtml).not.toContain("কেন্দ্রীয় জামে মসজিদ");
    expect(selfHtml).toContain("মোঃ মাসুদ রানা-১৯২০");
  });
});

describe("bnReceipts misc collection mode", () => {
  it("hides land rows and shows only name/father/village/amount/note", () => {
    const misc = buildReceiptCopyHtmlForTest(
      { ...baseData, misc_collection: true, collected_amount: 500, remark: "হাওলাত" } as unknown as BnReceiptData,
      "farmer",
      "bn",
    );
    expect(misc).not.toContain("দাগ নং");
    expect(misc).not.toContain("জমির পরিমাণ");
    expect(misc).toContain("হাওলাত");
  });
});
