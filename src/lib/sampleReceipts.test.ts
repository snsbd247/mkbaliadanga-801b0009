import { describe, it, expect } from "vitest";
import {
  buildSampleReceipt,
  findMissingSampleFields,
  findMissingSampleFieldDetails,
  SAMPLE_RECEIPT_TYPE_LABELS,
  type SampleReceiptType,
} from "./sampleReceipts";
import { buildReceiptCopyHtmlForTest } from "./bnReceipts";

const types = Object.keys(SAMPLE_RECEIPT_TYPE_LABELS) as SampleReceiptType[];

describe("sample receipts (DataImport preview)", () => {
  it("builds demo data with no missing required fields for every type", () => {
    for (const t of types) {
      const data = buildSampleReceipt(t);
      expect(findMissingSampleFields(t, data)).toEqual([]);
    }
  });

  it("flags missing fields when required data is blank", () => {
    const data = buildSampleReceipt("irrigation");
    data.holding_description = "";
    data.patwari_name = null;
    const missing = findMissingSampleFields("irrigation", data);
    expect(missing).toContain("holding_description");
    expect(missing).toContain("patwari_name");
  });

  it("irrigation sample renders all key fields in printable HTML", () => {
    const data = buildSampleReceipt("irrigation");
    const html = buildReceiptCopyHtmlForTest(data, "farmer", "bn");
    expect(html).toContain("রহিম উদ্দিন");
    expect(html).toContain("আমন হয় না");
    expect(html).toContain("আলম ইসলাম");
    expect(html).toContain("বালিয়াডাঙ্গা");
  });
});
