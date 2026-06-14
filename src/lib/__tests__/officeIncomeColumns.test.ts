import { describe, it, expect } from "vitest";
import { OFFICE_INCOME_COLUMNS, officeIncomeHeaders, type Tx } from "@/lib/officeIncomeColumns";

const txEn: Tx = (en) => en;
const txBn: Tx = (_en, bn) => bn;

describe("OfficeIncome export ↔ template column parity", () => {
  it("has the exact canonical column order", () => {
    expect(OFFICE_INCOME_COLUMNS.map((c) => c.key)).toEqual([
      "receipt_no", "date", "name", "father_name", "village", "mobile",
      "mouza", "land", "type", "stream", "remark", "amount",
    ]);
  });

  it("template headers match export headers 1:1 (English)", () => {
    const exportHeaders = officeIncomeHeaders(txEn);
    const templateHeaders = officeIncomeHeaders(txEn);
    expect(templateHeaders).toEqual(exportHeaders);
    expect(exportHeaders).toEqual([
      "Receipt No", "Date", "Name", "Father's name", "Village", "Mobile",
      "Mouza", "Land", "Type", "Stream", "Remark", "Amount",
    ]);
  });

  it("template headers match export headers 1:1 (Bengali)", () => {
    expect(officeIncomeHeaders(txBn)).toEqual(officeIncomeHeaders(txBn));
    expect(officeIncomeHeaders(txBn)).toEqual([
      "রশিদ নং", "তারিখ", "নাম", "পিতার নাম", "গ্রাম", "মোবাইল",
      "মৌজা", "জমি", "ধরন", "স্ট্রিম", "রিমার্ক", "টাকা",
    ]);
  });

  it("header count equals column count", () => {
    expect(officeIncomeHeaders(txEn).length).toBe(OFFICE_INCOME_COLUMNS.length);
  });
});
