import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import { buildIrrigationInvoiceHtmlForTest } from "@/lib/irrigationInvoicePdf";
import { flattenInvoiceForExport, IRR_BN } from "@/lib/irrigationExports";
import {
  setReceiptLayoutSettings,
  resetReceiptLayoutSettings,
  getIrrigationLabels,
  dagSeparatorString,
  type DagSeparator,
} from "@/lib/receiptLayoutSettings";

const receiptData: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-100",
  date: "2026-01-15",
  farmer: { name: "Karim", mouza: "Baliadanga", land_size: 33, dag_no: "123, 124/A, 125-B" },
  collected_amount: 500,
  collector_signature_url: null,
};

const invoiceData = {
  invoice_no: "INV-100",
  generated_at: "2026-01-15",
  payable_amount: 500,
  paid_amount: 0,
  due_amount: 500,
  invoice_status: "generated",
  farmer: { name: "Karim", farmer_code: "F1", mobile: "017", village: "V" },
  land: { mouza: "Baliadanga", dag_no: "123, 124/A, 125-B", land_size: 33 },
  season: { name: "Boro", year: 2026 },
};

const exportInvoice = {
  invoice_no: "INV-100",
  farmers: { name_bn: "Karim", farmer_code: "F1", mobile: "017" },
  lands: { mouza: "Baliadanga", dag_no: "123, 124/A, 125-B", land_size: 33 },
  seasons: { name: "Boro", year: 2026 },
  invoice_status: "generated",
};

const SEPS: DagSeparator[] = ["comma", "newline", "semicolon"];

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  resetReceiptLayoutSettings();
});

describe("irrigation layout — HTML/PDF/Excel parity", () => {
  for (const sep of SEPS) {
    it(`uses the same separator (${sep}) across all three renderers`, () => {
      setReceiptLayoutSettings({ dagSeparator: sep });
      const joiner = dagSeparatorString(sep);
      // Excel
      const row = flattenInvoiceForExport(exportInvoice);
      expect(row[IRR_BN.dag]).toBe(["123", "124/A", "125-B"].join(joiner));
      // PDF (irrigation invoice)
      const pdfHtml = buildIrrigationInvoiceHtmlForTest(invoiceData as any);
      expect(pdfHtml).toContain(["123", "124/A", "125-B"].join(joiner));
      // HTML receipt — newline joiner becomes <br/>
      const html = buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn");
      const expectedHtmlJoin = sep === "newline"
        ? "123<br/>124/A<br/>125-B"
        : ["123", "124/A", "125-B"].join(joiner);
      expect(html).toContain(expectedHtmlJoin);
    });
  }

  it("custom labels propagate to HTML, PDF and resolved label helper", () => {
    setReceiptLayoutSettings({
      mouzaLabelBn: "জমির বিবরণ:",
      dagLabelBn: "দাগ:",
      mouzaLabelEn: "Land:",
      dagLabelEn: "Plots:",
    });
    expect(getIrrigationLabels("bn")).toEqual({ mouza: "জমির বিবরণ:", dag: "দাগ:" });
    expect(getIrrigationLabels("en")).toEqual({ mouza: "Land:", dag: "Plots:" });
    const html = buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn");
    expect(html).toContain("জমির বিবরণ:");
    expect(html).toContain("দাগ:");
    const pdfHtml = buildIrrigationInvoiceHtmlForTest(invoiceData as any);
    expect(pdfHtml).toContain("জমির বিবরণ:");
    expect(pdfHtml).toContain("দাগ:");
  });
});

describe("irrigation receipt snapshots — separator × language", () => {
  for (const lang of ["bn", "en"] as const) {
    for (const sep of SEPS) {
      it(`snapshot: ${lang} / ${sep}`, () => {
        setReceiptLayoutSettings({ dagSeparator: sep });
        const html = buildReceiptCopyHtmlForTest(receiptData, "farmer", lang);
        expect(html).toMatchSnapshot();
      });
    }
  }

  it("snapshot: bn with custom labels", () => {
    setReceiptLayoutSettings({
      mouzaLabelBn: "জমির বিবরণ:",
      dagLabelBn: "দাগ:",
    });
    expect(buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn")).toMatchSnapshot();
  });
});

describe("irrigation Excel snapshots — separator settings", () => {
  for (const sep of SEPS) {
    it(`Excel row snapshot: ${sep}`, () => {
      setReceiptLayoutSettings({ dagSeparator: sep });
      expect(flattenInvoiceForExport(exportInvoice)).toMatchSnapshot();
    });
  }
});

describe("per-module row spacing isolation", () => {
  it("changing irrigation spacing leaves savings/loan unchanged", () => {
    setReceiptLayoutSettings({ rowSpacingPx: 11 });
    const irr = buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn");
    const sav = buildReceiptCopyHtmlForTest({ ...receiptData, kind: "savings", description: "x" }, "farmer", "bn");
    const loan = buildReceiptCopyHtmlForTest({ ...receiptData, kind: "loan", description: "x" }, "farmer", "bn");
    expect(irr).toContain("padding:11px 8px");
    expect(sav).toContain("padding:4px 8px");
    expect(loan).toContain("padding:4px 8px");
  });

  it("changing savings spacing leaves irrigation/loan unchanged", () => {
    setReceiptLayoutSettings({ savingsRowSpacingPx: 9 });
    const sav = buildReceiptCopyHtmlForTest({ ...receiptData, kind: "savings", description: "x" }, "farmer", "bn");
    const irr = buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn");
    expect(sav).toContain("padding:9px 8px");
    expect(irr).toContain("padding:4px 8px");
  });

  it("reset restores all defaults", () => {
    setReceiptLayoutSettings({
      dagSeparator: "newline",
      rowSpacingPx: 10,
      savingsRowSpacingPx: 8,
      mouzaLabelBn: "X",
    });
    resetReceiptLayoutSettings();
    expect(getIrrigationLabels("bn").mouza).toBe("মৌজা / জমির পরিমান:");
    expect(dagSeparatorString()).toBe(", ");
    const irr = buildReceiptCopyHtmlForTest(receiptData, "farmer", "bn");
    expect(irr).toContain("padding:4px 8px");
  });
});
