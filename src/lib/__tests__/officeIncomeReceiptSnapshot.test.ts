/**
 * @vitest-environment jsdom
 *
 * PDF snapshot / visual-regression coverage for the office income receipt:
 *  - The rendered HTML layout is stable in BN & EN (snapshot).
 *  - Preview and export produce the SAME jsPDF page config in BOTH
 *    portrait and landscape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const jsPdfCalls: any[] = [];

vi.mock("html2canvas", () => ({
  default: vi.fn(async () => ({
    width: 800,
    height: 1000,
    toDataURL: () => "data:image/jpeg;base64,xxx",
  })),
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
  receipt_no: "RCP-2026-06-0009",
  date: "2026-06-16",
  bill_info: "ভাঙারি",
  farmer: { name: "অফিস আয়", father_or_husband: "—", village: "—", mobile: "01700000000" },
  remark: "ভাঙারি বিক্রি",
  collected_amount: 1500,
});

describe("office income receipt — layout snapshot & orientation parity", () => {
  beforeEach(() => {
    jsPdfCalls.length = 0;
    resetReceiptLayoutSettings();
  });

  it("BN layout is stable (snapshot)", () => {
    expect(buildReceiptCopyHtmlForTest(officeRow("sech"), "farmer", "bn")).toMatchSnapshot();
  });

  it("EN layout is stable (snapshot)", () => {
    expect(buildReceiptCopyHtmlForTest(officeRow("sech"), "farmer", "en")).toMatchSnapshot();
  });

  it("preview & export match in PORTRAIT", async () => {
    setReceiptLayoutSettings({ defaultOrientation: "p", defaultPaperSize: "a4" });
    await previewBnReceiptPdf(officeRow("sech"), "both");
    await downloadBnReceiptPdf(officeRow("sech"), "both");
    expect(jsPdfCalls[0]).toMatchObject({ orientation: "p", format: "a4" });
    expect(jsPdfCalls[1]).toMatchObject({ orientation: "p", format: "a4" });
  });

  it("preview & export match in LANDSCAPE", async () => {
    setReceiptLayoutSettings({ defaultOrientation: "l", defaultPaperSize: "a4" });
    await previewBnReceiptPdf(officeRow("sech"), "both");
    await downloadBnReceiptPdf(officeRow("sech"), "both");
    expect(jsPdfCalls[0]).toMatchObject({ orientation: "l", format: "a4" });
    expect(jsPdfCalls[1]).toMatchObject({ orientation: "l", format: "a4" });
  });
});
