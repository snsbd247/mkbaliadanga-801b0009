import { describe, it, expect } from "vitest";
import { buildReceiptCopyHtmlForTest, irrigationReceiptToExcelRow, type BnReceiptData } from "@/lib/bnReceipts";
import { joinNotes } from "@/lib/irrigationExports";

// Multi-land irrigation payment whose holding description is the concatenation
// of several per-land notes. Mirrors what buildIrrigationReceiptEnrichment
// produces for a combined payment across 3 lands.
const MULTI_LAND_NOTE = joinNotes("জমি ১ নোট", "জমি ২ নোট", "জমি ৩ নোট");

function makeReceipt(holding: string): BnReceiptData {
  return {
    kind: "irrigation",
    receipt_no: "R-001",
    date: "2026-01-01",
    farmer: {
      name: "করিম",
      member_no: "12",
      father_or_husband: "রহিম",
      village: "বালিয়াডাঙ্গা",
      mobile: "01700000000",
      mouza: "মৌজা-১",
      dag_no: "১০১",
      field_type_bn: "আমন",
      land_size: 100,
    },
    owner_self: true,
    collected_amount: 500,
    current_season_charge: 500,
    holding_description: holding,
  } as unknown as BnReceiptData;
}

describe("multi-land note integration (receipt PDF source + Excel)", () => {
  it("concatenates per-land notes with ' || '", () => {
    expect(MULTI_LAND_NOTE).toBe("জমি ১ নোট || জমি ২ নোট || জমি ৩ নোট");
  });

  it("shows the concatenated notes in the rendered receipt HTML (PDF source)", () => {
    const html = buildReceiptCopyHtmlForTest(makeReceipt(MULTI_LAND_NOTE), "farmer", "bn");
    expect(html).toContain("জমি ১ নোট || জমি ২ নোট || জমি ৩ নোট");
  });

  it("shows the concatenated notes in the receipt Excel row", () => {
    const row = irrigationReceiptToExcelRow(makeReceipt(MULTI_LAND_NOTE));
    expect(row["নোট"]).toBe("জমি ১ নোট || জমি ২ নোট || জমি ৩ নোট");
  });

  it("renders the receipt HTML in English without breaking note content", () => {
    const html = buildReceiptCopyHtmlForTest(makeReceipt(MULTI_LAND_NOTE), "farmer", "en");
    expect(html).toContain("জমি ১ নোট || জমি ২ নোট || জমি ৩ নোট");
  });

  it("leaves no stray separator when some land notes are missing", () => {
    const partial = joinNotes("জমি ১ নোট", "", "  ", "জমি ৩ নোট");
    expect(partial).toBe("জমি ১ নোট || জমি ৩ নোট");
    const row = irrigationReceiptToExcelRow(makeReceipt(partial));
    expect(row["নোট"]).toBe("জমি ১ নোট || জমি ৩ নোট");
    const html = buildReceiptCopyHtmlForTest(makeReceipt(partial), "farmer", "bn");
    expect(html).toContain("জমি ১ নোট || জমি ৩ নোট");
    expect(html).not.toContain("||  ||");
  });

  it("trims leading/trailing whitespace around each land note", () => {
    const trimmed = joinNotes("  জমি ১ নোট  ", "\tজমি ২ নোট\n");
    expect(trimmed).toBe("জমি ১ নোট || জমি ২ নোট");
    const row = irrigationReceiptToExcelRow(makeReceipt(trimmed));
    expect(row["নোট"]).toBe("জমি ১ নোট || জমি ২ নোট");
  });

  it("yields an empty note (no separator) when every land note is null/blank", () => {
    const empty = joinNotes(null, undefined, "   ", "");
    expect(empty).toBe("");
    const row = irrigationReceiptToExcelRow(makeReceipt(empty));
    expect(row["নোট"]).toBe("");
    const html = buildReceiptCopyHtmlForTest(makeReceipt(empty), "farmer", "bn");
    expect(html).not.toContain("||");
  });
});
