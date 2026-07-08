/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let lastHtml = "";
let lastSaveName = "";
let lastPdfOptions: any = null;
const addImage = vi.fn();

vi.mock("html2canvas", () => ({
  default: vi.fn(async (node: HTMLElement) => {
    lastHtml = node.innerHTML;
    return { width: 800, height: 1100, toDataURL: () => "data:image/jpeg;base64,xxx" } as any;
  }),
}));
vi.mock("jspdf", () => ({
  default: class {
    constructor(options: any) { lastPdfOptions = options; }
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addImage = (...a: any[]) => addImage(...a);
    setLineDashPattern = () => this;
    setDrawColor = () => this;
    setLineWidth = () => this;
    line = () => this;
    save = (n: string) => { lastSaveName = n; };
    output = () => "data:application/pdf;base64,xxx";
  },
}));

import { downloadBnReceiptPdf, previewBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";

const farmer = { name: "করিম মিয়া", member_no: "M-001", village: "নবীনগর", mobile: "01700000000" };
const org = { name: "Smart Co-op", name_bn: "স্মার্ট সমবায়", address: "ঢাকা", registration_no: "REG-99" };

function payload(kind: BnReceiptData["kind"], rno: string, extra: Partial<BnReceiptData> = {}): BnReceiptData {
  return {
    kind, receipt_no: rno, date: "2026-05-06",
    company_name: "Smart Co-op", company_name_bn: "স্মার্ট সমবায়", org,
    farmer, collected_amount: 1500, ...extra,
  };
}

describe("Receipt flow E2E (print + download for all kinds)", () => {
  beforeEach(() => { lastHtml = ""; lastSaveName = ""; lastPdfOptions = null; addImage.mockReset(); });

  const kinds: Array<{ k: BnReceiptData["kind"]; pfx: "SAV" | "LOAN" | "IRR" }> = [
    { k: "savings", pfx: "SAV" },
    { k: "loan", pfx: "LOAN" },
    { k: "irrigation", pfx: "IRR" },
  ];

  for (const { k, pfx } of kinds) {
    it(`${k}: receipt_no follows ${pfx}-YYYYMMDD-XXXXXX, all 3 copy modes work, signatures placeholder visible`, async () => {
      const rno = autoReceiptNo(pfx, "abcdef1234567890", new Date("2026-05-06"));
      expect(rno).toMatch(new RegExp(`^${pfx}-20260506-[A-Z0-9]{6}$`));

      // both copies
      await downloadBnReceiptPdf(payload(k, rno), "both");
      expect(lastSaveName).toContain(rno);
      expect(lastHtml).toContain("কৃষকের কপি");
      if (k === "irrigation") {
        // Official irrigation receipt is a single A5 landscape copy, never farmer+office split.
        expect(lastHtml).not.toContain("অফিস কপি");
        expect(lastHtml).toContain("আদায়কারীর স্বাক্ষর");
      } else {
        expect(lastHtml).toContain("অফিস কপি");
        expect(lastHtml).toContain('data-sig="placeholder"'); // no signature provided
      }

      // farmer-only (irrigation always renders the A4 two-up, so no per-copy suffix)
      await downloadBnReceiptPdf(payload(k, rno), "farmer");
      if (k === "irrigation") {
        expect(lastSaveName).not.toContain("_farmer");
      } else {
        expect(lastSaveName).toContain("_farmer");
        expect(lastHtml).toContain("কৃষকের কপি");
        expect(lastHtml).not.toContain("অফিস কপি");
      }

      // office-only with separate signature
      await downloadBnReceiptPdf(
        payload(k, rno, { office_collector_signature_url: "https://x/sig-office.png" }),
        "office",
      );
      if (k === "irrigation") {
        // irrigation ignores copy → single two-up file, no _office suffix
        expect(lastSaveName).not.toContain("_office");
      } else {
        expect(lastSaveName).toContain("_office");
        expect(lastHtml).toContain("sig-office.png");
      }
      if (k !== "irrigation") expect(lastHtml).not.toContain("কৃষকের কপি");

      // org block printed on each copy
      if (k !== "irrigation") expect(lastHtml).toMatch(/REG-/); // org registration prefix appears (digits localised)
    });
  }

  it("language toggle: English keeps identical receipt_no, swaps labels", async () => {
    const rno = autoReceiptNo("LOAN", "abcdef", new Date("2026-05-06"));
    await previewBnReceiptPdf(payload("loan", rno), "farmer", { lang: "en" });
    expect(lastHtml).toContain(rno);                              // ASCII digits, unchanged
    expect(lastHtml).toContain("Loan Installment Receipt");
    expect(lastHtml).toContain("Farmer Copy");
    expect(lastHtml).not.toContain("ঋণের কিস্তি গ্রহণের রশিদ");
  });

  it("custom margins are honoured by the PDF (non-irrigation)", async () => {
    // Irrigation is permanently locked to A5 landscape + fixed margins, so custom
    // margins are validated on a savings receipt where they still apply.
    const rno = autoReceiptNo("SAV", "x", new Date("2026-05-06"));
    await downloadBnReceiptPdf(payload("savings", rno), "both", {
      margins: { t: 20, r: 15, b: 20, l: 15 },
    });
    // jsPDF.addImage(jpegData, "JPEG", x=margin.l, y=margin.t, width, height)
    expect(addImage).toHaveBeenCalled();
    const args = addImage.mock.calls[0];
    expect(args[2]).toBe(15); // x = left margin
    expect(args[3]).toBe(20); // y = top margin
    expect(args[4]).toBe(210 - 15 - 15); // inner width
  });

  it("official irrigation receipt renders A4 portrait with two copies (cut in half → office + farmer)", async () => {
    const rno = autoReceiptNo("IRR", "x", new Date("2026-05-06"));
    addImage.mockClear();
    await downloadBnReceiptPdf(payload("irrigation", rno), "both", {
      paper: "a5",
      orientation: "l",
    });
    // A4 portrait page regardless of requested paper/orientation.
    expect(lastPdfOptions).toMatchObject({ unit: "mm", format: "a4", orientation: "p" });
    // The same A5 layout is drawn twice (top + bottom halves).
    expect(addImage).toHaveBeenCalledTimes(2);
  });
});
