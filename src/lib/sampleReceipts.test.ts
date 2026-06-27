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

  it("savings sample renders savings-specific fields, not land rows", () => {
    const html = buildReceiptCopyHtmlForTest(buildSampleReceipt("savings"), "farmer", "bn");
    expect(html).toContain("সঞ্চয়");
    expect(html).not.toContain("দাগ নং");
  });

  it("loan sample renders loan-specific fields", () => {
    const html = buildReceiptCopyHtmlForTest(buildSampleReceipt("loan"), "farmer", "bn");
    expect(html).toContain("কিস্তি");
    expect(html).not.toContain("দাগ নং");
  });

  it("misc sample hides land rows (বিবিধ আদায় mode)", () => {
    const html = buildReceiptCopyHtmlForTest(buildSampleReceipt("misc"), "farmer", "bn");
    expect(html).not.toContain("দাগ নং");
    expect(html).not.toContain("জমির পরিমাণ");
  });

  it("each type's required fields differ (distinct field sets)", () => {
    const irrigation = buildSampleReceipt("irrigation");
    // irrigation requires holding/patwari; savings does not
    expect(findMissingSampleFields("irrigation", { ...irrigation, holding_description: "" }))
      .toContain("holding_description");
    expect(findMissingSampleFields("savings", buildSampleReceipt("savings"))).toEqual([]);
  });

  it("findMissingSampleFieldDetails returns label and affected section", () => {
    const data = buildSampleReceipt("irrigation");
    data.holding_description = "";
    const details = findMissingSampleFieldDetails("irrigation", data);
    const holding = details.find((d) => d.path === "holding_description");
    expect(holding?.label).toBe("হোল্ডিং বিবরন");
    expect(holding?.section).toBe("হোল্ডিং/পাটুয়ারী");
  });
});
