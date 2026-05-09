import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import { setReceiptLayoutSettings, DEFAULT_RECEIPT_LAYOUT } from "@/lib/receiptLayoutSettings";

const baseData: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-001",
  date: "2026-01-15",
  farmer: {
    name: "Karim Mia",
    member_no: "M-1",
    village: "Test Village",
    mobile: "017xxxxxxx",
    mouza: "Baliadanga",
    land_size: 33,
    dag_no: "123, 124/A, 125-B",
  },
  collected_amount: 500,
  collector_signature_url: null,
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  setReceiptLayoutSettings(DEFAULT_RECEIPT_LAYOUT);
});

function rowFor(html: string, label: string): string {
  // Match <tr>... <td>label</td><td>value</td> ...</tr>
  const re = new RegExp(`<tr>[\\s\\S]*?<td[^>]*>${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}</td>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)</td>[\\s\\S]*?</tr>`);
  const m = html.match(re);
  return m ? m[1] : "";
}

describe("irrigation receipt layout", () => {
  it("BN: mouza row has size but no dag tokens; dag row has all tokens", () => {
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    const mouza = rowFor(html, "মৌজা / জমির পরিমান:");
    const dag = rowFor(html, "দাগ নং:");
    expect(mouza).toContain("Baliadanga");
    expect(mouza).toContain("বিঘা");
    expect(mouza).not.toContain("123");
    expect(mouza).not.toContain("124/A");
    expect(dag).toContain("123");
    expect(dag).toContain("124/A");
    expect(dag).toContain("125-B");
  });

  it("EN: mouza row has size but no dag tokens; dag row has all tokens", () => {
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "en");
    const mouza = rowFor(html, "Mouza / Land size:");
    const dag = rowFor(html, "Dag no:");
    expect(mouza).toContain("Baliadanga");
    expect(mouza).toContain("bigha");
    expect(mouza).not.toContain("124/A");
    expect(dag).toContain("123");
    expect(dag).toContain("124/A");
    expect(dag).toContain("125-B");
  });

  it("default separator is comma", () => {
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    expect(html).toMatch(/123, 124\/A, 125-B/);
  });

  it("newline separator renders <br/> between dag tokens", () => {
    setReceiptLayoutSettings({ dagSeparator: "newline" });
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    const dag = rowFor(html, "দাগ নং:");
    expect(dag).toContain("123<br/>124/A<br/>125-B");
  });

  it("semicolon separator joins with '; '", () => {
    setReceiptLayoutSettings({ dagSeparator: "semicolon" });
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "en");
    const dag = rowFor(html, "Dag no:");
    expect(dag).toContain("123; 124/A; 125-B");
  });

  it("custom labels are applied per language without affecting other modules", () => {
    setReceiptLayoutSettings({
      mouzaLabelBn: "জমির বিবরণ:",
      dagLabelBn: "দাগ:",
      mouzaLabelEn: "Land:",
      dagLabelEn: "Plots:",
    });
    const bn = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    expect(bn).toContain(">জমির বিবরণ:<");
    expect(bn).toContain(">দাগ:<");
    const en = buildReceiptCopyHtmlForTest(baseData, "farmer", "en");
    expect(en).toContain(">Land:<");
    expect(en).toContain(">Plots:<");
    // Savings receipt must not get these labels
    const savings = buildReceiptCopyHtmlForTest(
      { ...baseData, kind: "savings", description: "deposit" },
      "farmer", "bn",
    );
    expect(savings).not.toContain("জমির বিবরণ:");
    expect(savings).not.toContain("দাগ:");
  });

  it("row spacing setting is reflected in td padding", () => {
    setReceiptLayoutSettings({ rowSpacingPx: 10 });
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    expect(html).toContain("padding:10px 8px");
  });

  it("clamps row spacing within [2,12]", () => {
    setReceiptLayoutSettings({ rowSpacingPx: 99 });
    const html = buildReceiptCopyHtmlForTest(baseData, "farmer", "bn");
    expect(html).toContain("padding:12px 8px");
  });

  it("single dag still renders without a separator", () => {
    const html = buildReceiptCopyHtmlForTest(
      { ...baseData, farmer: { ...baseData.farmer, dag_no: "777" } },
      "farmer", "bn",
    );
    const dag = rowFor(html, "দাগ নং:");
    expect(dag).toContain("777");
    expect(dag).not.toContain(",");
    expect(dag).not.toContain("<br/>");
  });
});
