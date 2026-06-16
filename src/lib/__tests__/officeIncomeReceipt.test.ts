/**
 * @vitest-environment jsdom
 *
 * Office income receipt coverage:
 *  1. Orientation/paper from ReceiptSettings reflect in BOTH preview & export (renderPdf).
 *  2. জমি ও মৌজা are locked to N/A on office-income receipts (can't be edited away).
 *  3. Stream-aware BN/EN headings & labels switch with language toggle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let capturedHtml = "";
const jsPdfCalls: any[] = [];

vi.mock("html2canvas", () => ({
  default: vi.fn(async (node: HTMLElement) => {
    capturedHtml = node.innerHTML;
    return { width: 800, height: 1000, toDataURL: () => "data:image/jpeg;base64,xxx" } as any;
  }),
}));
vi.mock("jspdf", () => ({
  default: class {
    constructor(opts: any) { jsPdfCalls.push(opts); }
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addImage = vi.fn();
    save = vi.fn();
    output = () => "data:application/pdf;base64,xxx";
  },
}));

import {
  downloadBnReceiptPdf,
  previewBnReceiptPdf,
  buildReceiptCopyHtmlForTest,
  type BnReceiptData,
} from "@/lib/bnReceipts";
import { setReceiptLayoutSettings, resetReceiptLayoutSettings } from "@/lib/receiptLayoutSettings";

const officeRow = (stream: "sech" | "saving"): BnReceiptData => ({
  kind: stream === "saving" ? "savings" : "irrigation",
  office_income: true,
  receipt_no: "RCP-2026-06-0007",
  date: "2026-06-16",
  bill_info: "ভাঙারি",
  farmer: { name: "অফিস আয়", father_or_husband: "—", village: "—", mobile: "01700000000" },
  remark: "ভাঙারি বিক্রি",
  collected_amount: 1500,
});

describe("office income receipt", () => {
  beforeEach(() => {
    capturedHtml = "";
    jsPdfCalls.length = 0;
    resetReceiptLayoutSettings();
  });

  it("export uses the orientation/paper from ReceiptSettings", async () => {
    setReceiptLayoutSettings({ defaultOrientation: "l", defaultPaperSize: "a4" });
    await downloadBnReceiptPdf(officeRow("sech"), "both");
    expect(jsPdfCalls[0]).toMatchObject({ orientation: "l", format: "a4" });
  });

  it("preview uses the SAME orientation/paper as export", async () => {
    setReceiptLayoutSettings({ defaultOrientation: "p", defaultPaperSize: "a5" });
    await previewBnReceiptPdf(officeRow("sech"), "both");
    expect(jsPdfCalls[0]).toMatchObject({ orientation: "p", format: "a5" });
  });

  it("explicit option overrides the saved default consistently", async () => {
    setReceiptLayoutSettings({ defaultOrientation: "p" });
    await previewBnReceiptPdf(officeRow("sech"), "both", { orientation: "l" });
    await downloadBnReceiptPdf(officeRow("sech"), "both", { orientation: "l" });
    expect(jsPdfCalls[0]).toMatchObject({ orientation: "l" });
    expect(jsPdfCalls[1]).toMatchObject({ orientation: "l" });
  });

  it("locks জমি ও মৌজা to N/A and never shows real land/dag rows", () => {
    const html = buildReceiptCopyHtmlForTest(officeRow("sech"), "farmer", "bn");
    expect(html).toContain("মৌজা / জমির পরিমান:");
    expect(html).toContain("N/A");
    expect(html).not.toContain("দাগ নং:");
    expect(html).not.toContain("জমির ধরন:");
    expect(html).not.toContain("চার্জ রেট:");
  });

  it("BN headings switch by stream", () => {
    expect(buildReceiptCopyHtmlForTest(officeRow("sech"), "farmer", "bn"))
      .toContain("সেচ চার্জ সংগ্রহের রশিদ");
    expect(buildReceiptCopyHtmlForTest(officeRow("saving"), "farmer", "bn"))
      .toContain("সঞ্চয় গ্রহণের রশিদ");
  });

  it("EN headings/labels switch with the language toggle", () => {
    const irr = buildReceiptCopyHtmlForTest(officeRow("sech"), "farmer", "en");
    expect(irr).toContain("Irrigation Charge Receipt");
    expect(irr).toContain("Amount collected:");
    expect(irr).toContain("Mouza / Land size:");

    const sav = buildReceiptCopyHtmlForTest(officeRow("saving"), "farmer", "en");
    expect(sav).toContain("Savings Deposit Receipt");
    expect(sav).toContain("Amount deposited:");
  });
});
