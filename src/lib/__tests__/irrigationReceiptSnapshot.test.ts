import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import { setReceiptLayoutSettings, DEFAULT_RECEIPT_LAYOUT } from "@/lib/receiptLayoutSettings";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  setReceiptLayoutSettings(DEFAULT_RECEIPT_LAYOUT);
});

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-SNAP",
  date: "2026-06-20",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1.25.26.24.28",
    field_type_bn: "উচু জমি",
  },
  rate: 3939.39,
  current_season_charge: 1300,
  current_penalty: 130,
  total_outstanding: 1300,
  due_penalty: 130,
  collected_amount: 2860,
  collector_signature_url: null,
  village_union: "বালিয়াডাঙ্গা",
};

/**
 * Snapshot tests lock the rendered A5 receipt HTML so layout regressions
 * (especially long text and many-dag rows) are caught automatically.
 * The exported PDF is produced from the exact same HTML via html2canvas,
 * so the preview the user sees matches the downloaded file.
 */
describe("irrigation receipt layout snapshots", () => {
  it("matches the standard farmer copy layout", () => {
    expect(buildReceiptCopyHtmlForTest(base, "farmer", "bn")).toMatchSnapshot();
  });

  it("matches the office copy layout", () => {
    expect(buildReceiptCopyHtmlForTest(base, "office", "bn")).toMatchSnapshot();
  });

  it("matches layout with a very long dag list (overflow regression guard)", () => {
    const manyDags = Array.from({ length: 40 }, (_, i) => 100 + i).join(".");
    const html = buildReceiptCopyHtmlForTest(
      { ...base, farmer: { ...base.farmer, dag_no: manyDags } },
      "farmer",
      "bn",
    );
    expect(html).toMatchSnapshot();
  });

  it("matches layout with very long remark / holding text", () => {
    const longText = "অতিরিক্ত মন্তব্য ".repeat(60);
    const html = buildReceiptCopyHtmlForTest(
      { ...base, holding_description: longText, remark: longText },
      "farmer",
      "bn",
    );
    expect(html).toMatchSnapshot();
  });
});
