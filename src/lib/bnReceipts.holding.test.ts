import { describe, it, expect } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "./bnReceipts";

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "1001",
  date: new Date("2026-02-01"),
  farmer: { name: "মোঃ করিম", member_no: "1900", mobile: "01700000000", village: "বাগবাড়ি" },
  collected_amount: 200,
};

describe("সেচ রশিদ — হোল্ডিং বিবরন/পাটুয়ারী regression", () => {
  it("renders holding description and patwari name+mobile when present", () => {
    const html = buildReceiptCopyHtmlForTest({
      ...base,
      holding_description: "আমন হয় না। নিজ সেচে আবাদ হয়।",
      patwari_name: "মোঃ আলম ইসলাম",
      patwari_mobile: "01700000000",
    });
    expect(html).toContain("হোল্ডিং এর বিবরন");
    expect(html).toContain("আমন হয় না। নিজ সেচে আবাদ হয়।");
    expect(html).toContain("মোঃ আলম ইসলাম");
  });

  it("always shows the holding row (placeholder) even when data is empty", () => {
    const html = buildReceiptCopyHtmlForTest({ ...base });
    expect(html).toContain("হোল্ডিং এর বিবরন");
  });
});
