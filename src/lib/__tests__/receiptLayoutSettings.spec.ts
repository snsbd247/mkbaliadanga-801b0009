import { describe, it, expect, beforeEach } from "vitest";
import jsPDF from "jspdf";
import {
  DEFAULT_RECEIPT_LAYOUT,
  getReceiptLayoutSettings,
  setReceiptLayoutSettings,
  getReceiptFontScale,
  getReceiptSideMarginMm,
} from "@/lib/receiptLayoutSettings";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  setReceiptLayoutSettings(DEFAULT_RECEIPT_LAYOUT);
});

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-CFG",
  date: "2026-06-20",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1.25.26",
    field_type_bn: "উচু জমি",
  },
  rate: 3939.39,
  current_season_charge: 1300,
  collected_amount: 1300,
  collector_signature_url: null,
};

function maxFont(html: string): number {
  return Math.max(...[...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1])));
}

describe("receipt layout settings — defaults & clamps", () => {
  it("has sane defaults for fontScale and sideMarginMm", () => {
    expect(DEFAULT_RECEIPT_LAYOUT.fontScale).toBe(1.0);
    expect(DEFAULT_RECEIPT_LAYOUT.sideMarginMm).toBe(4);
  });

  it("clamps fontScale to the 0.8–1.4 range", () => {
    setReceiptLayoutSettings({ fontScale: 5 });
    expect(getReceiptFontScale()).toBe(1.4);
    setReceiptLayoutSettings({ fontScale: 0.1 });
    expect(getReceiptFontScale()).toBe(0.8);
  });

  it("clamps sideMarginMm to the 0–15 range", () => {
    setReceiptLayoutSettings({ sideMarginMm: 99 });
    expect(getReceiptSideMarginMm()).toBe(15);
    setReceiptLayoutSettings({ sideMarginMm: -5 });
    expect(getReceiptSideMarginMm()).toBe(0);
  });

  it("accepts letter as a valid paper size", () => {
    setReceiptLayoutSettings({ defaultPaperSize: "letter" });
    expect(getReceiptLayoutSettings().defaultPaperSize).toBe("letter");
  });
});

describe("receipt rendering honours settings", () => {
  it("scales receipt text up when fontScale increases", () => {
    const small = maxFont(buildReceiptCopyHtmlForTest(base, "farmer", "bn"));
    setReceiptLayoutSettings({ fontScale: 1.4 });
    const large = maxFont(buildReceiptCopyHtmlForTest(base, "farmer", "bn"));
    expect(large).toBeGreaterThan(small);
  });
});

describe("paper size page dimensions", () => {
  it("Letter portrait is ~216 x 279 mm", () => {
    const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "p" });
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(216);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(279);
  });

  it("A4 portrait is ~210 x 297 mm", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(297);
  });
});
