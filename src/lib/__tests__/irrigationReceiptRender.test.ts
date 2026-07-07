import { describe, it, expect } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";

// Strip HTML tags so we can assert on the rendered text content. The PDF export
// (renderPdf → buildHtml → copyHtml) rasterizes this exact HTML, so verifying
// the HTML text is equivalent to verifying what appears in the PDF.
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function baseData(overrides: Partial<BnReceiptData> = {}): BnReceiptData {
  return {
    kind: "irrigation",
    receipt_no: "IRR-001",
    receipt_no_display: "2652",
    date: "2026-01-01",
    company_name_bn: "বালিয়াডাঙ্গা সমবায়",
    farmer: {
      name: "মোঃ মাসুদ",
      member_no: "1920",
      father_or_husband: "মোঃ করিম",
      village: "বালিয়াডাঙ্গা",
      mobile: "0170000000",
      mouza: "বালিয়াডাঙ্গা",
      land_size: 1.5,
      dag_no: "123",
    },
    rate: 3939,
    current_season_charge: 3939,
    penalty_amount: 100,
    collected_amount: 4039,
    member_summary: "1920",
    cultivator_label: "মোঃ মাসুদ-1920",
    land_owner_label: "মালিক সাহেব-1687",
    owner_self: false,
    ...overrides,
  };
}

describe("irrigation receipt render (preview == PDF source HTML)", () => {
  it("shows separate cultivator/owner name-ID + savings member no in Bangla", () => {
    const out = text(buildReceiptCopyHtmlForTest(baseData(), "farmer", "bn"));
    expect(out).toContain("মোঃ মাসুদ-১৯২০/মালিক সাহেব-১৬৮৭");
    expect(out).toContain("১৯২০"); // savings member number (member_summary)
  });

  it("shows separate cultivator/owner name-ID + savings member no in English", () => {
    const out = text(buildReceiptCopyHtmlForTest(baseData(), "farmer", "en"));
    expect(out).toContain("মোঃ মাসুদ-1920/Owner: মালিক সাহেব-1687");
    expect(out).toContain("1920"); // savings member number
  });

  it("shows a single combined farmer/owner line when cultivator == owner (self land)", () => {
    const out = text(
      buildReceiptCopyHtmlForTest(
        baseData({ owner_self: true, land_owner_label: "নিজ", cultivator_label: "মোঃ মাসুদ-1920" }),
        "farmer",
        "bn",
      ),
    );
    expect(out).toContain("মোঃ মাসুদ-১৯২০");
    // No owner half rendered → the "/মালিক" separator must be absent.
    expect(out).not.toContain("মোঃ মাসুদ-১৯২০/");
  });

  it("shows N/A for savings member when cultivator has no savings account (both langs)", () => {
    const bn = text(buildReceiptCopyHtmlForTest(baseData({ member_summary: "N/A" }), "farmer", "bn"));
    const en = text(buildReceiptCopyHtmlForTest(baseData({ member_summary: "N/A" }), "farmer", "en"));
    expect(bn).toContain("N/A");
    expect(en).toContain("N/A");
  });
});
