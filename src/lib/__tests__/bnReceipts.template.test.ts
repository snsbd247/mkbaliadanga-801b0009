/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock html2canvas + jsPDF so we can capture rendered HTML without real canvas.
let capturedHtml = "";
vi.mock("html2canvas", () => ({
  default: vi.fn(async (node: HTMLElement) => {
    capturedHtml = node.innerHTML;
    return {
      width: 800,
      height: 1000,
      toDataURL: () => "data:image/jpeg;base64,xxx",
    } as any;
  }),
}));
vi.mock("jspdf", () => {
  return {
    default: class {
      internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
      addImage = vi.fn();
      save = vi.fn();
      output = () => "data:application/pdf;base64,xxx";
    },
  };
});

import { downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";

const baseFarmer = { name: "করিম মিয়া", member_no: "M-001", village: "নবীনগর", mobile: "01700000000" };

const cases: Array<{ name: string; data: BnReceiptData; expectTitle: string; expectRow: string }> = [
  {
    name: "irrigation: shows bill_info & charge rows",
    data: {
      kind: "irrigation",
      receipt_no: "IRR-20260506-AAAA01",
      date: "2026-05-06",
      bill_info: "ইরি, ২০২৬",
      farmer: { ...baseFarmer, mouza: "মৌজা-১", field_type_bn: "নিচু জমি", land_size: 12.5, dag_no: "১২৩৪" },
      rate: 150,
      charge_amount: 1875,
      previous_due: 200,
      collected_amount: 2075,
    },
    expectTitle: "সেচ চার্জ সংগ্রহের রশিদ",
    expectRow: "চার্জের পরিমাণ",
  },
  {
    name: "savings: shows বিবরণ & জমাকৃত পরিমাণ",
    data: {
      kind: "savings",
      receipt_no: "SAV-20260506-BBBB02",
      date: "2026-05-06",
      farmer: baseFarmer,
      description: "মাসিক সঞ্চয়, মে ২০২৬",
      collected_amount: 500,
    },
    expectTitle: "সঞ্চয় গ্রহণের রশিদ",
    expectRow: "জমাকৃত পরিমাণ",
  },
  {
    name: "loan: shows ঋণের বিবরণ & প্রাপ্ত কিস্তি",
    data: {
      kind: "loan",
      receipt_no: "LOAN-20260506-CCCC03",
      date: "2026-05-06",
      farmer: baseFarmer,
      description: "ঋণের কিস্তি ৩/১২",
      outstanding: 8000,
      collected_amount: 1000,
    },
    expectTitle: "ঋণের কিস্তি গ্রহণের রশিদ",
    expectRow: "প্রাপ্ত কিস্তি",
  },
];

describe("Bangla receipt template (visual regression)", () => {
  beforeEach(() => { capturedHtml = ""; });

  for (const c of cases) {
    it(c.name, async () => {
      await downloadBnReceiptPdf(c.data, "both");
      expect(capturedHtml).toContain(c.expectTitle);
      expect(capturedHtml).toContain(c.expectRow);
      expect(capturedHtml).toContain("কৃষকের কপি");
      expect(capturedHtml).toContain("অফিস কপি");
      expect(capturedHtml).toContain(c.data.receipt_no.split("-")[0]);
    });
  }

  it("missing collector_signature_url renders fixed-size placeholder line", async () => {
    await downloadBnReceiptPdf(cases[0].data, "farmer");
    expect(capturedHtml).toContain("আদায়কারীর স্বাক্ষর");
    expect(capturedHtml).toContain("width:140px");
    expect(capturedHtml).not.toContain("<img src=\"data:image");
  });

  it("office copy uses office_collector_signature_url when provided", async () => {
    await downloadBnReceiptPdf({
      ...cases[1].data,
      collector_signature_url: "https://example.com/sig-collector.png",
      office_collector_signature_url: "https://example.com/sig-office.png",
    }, "office");
    expect(capturedHtml).toContain("sig-office.png");
    expect(capturedHtml).not.toContain("sig-collector.png");
  });

  it("farmer-only copy excludes office copy block", async () => {
    await downloadBnReceiptPdf(cases[2].data, "farmer");
    expect(capturedHtml).toContain("কৃষকের কপি");
    expect(capturedHtml).not.toContain("অফিস কপি");
  });
});
