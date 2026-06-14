// Single source of truth for OfficeIncome (Hawlat / Vangari / Anudan) export &
// template columns. Both the PDF/Excel export and the blank template build their
// headers from this array, guaranteeing a 1:1 column order/header match.
export type Tx = (en: string, bn: string) => string;

export interface OfficeIncomeColumn {
  key: string;
  en: string;
  bn: string;
}

export const OFFICE_INCOME_COLUMNS: OfficeIncomeColumn[] = [
  { key: "receipt_no", en: "Receipt No", bn: "রশিদ নং" },
  { key: "date", en: "Date", bn: "তারিখ" },
  { key: "name", en: "Name", bn: "নাম" },
  { key: "father_name", en: "Father's name", bn: "পিতার নাম" },
  { key: "village", en: "Village", bn: "গ্রাম" },
  { key: "mobile", en: "Mobile", bn: "মোবাইল" },
  { key: "mouza", en: "Mouza", bn: "মৌজা" },
  { key: "land", en: "Land", bn: "জমি" },
  { key: "type", en: "Type", bn: "ধরন" },
  { key: "stream", en: "Stream", bn: "স্ট্রিম" },
  { key: "remark", en: "Remark", bn: "রিমার্ক" },
  { key: "amount", en: "Amount", bn: "টাকা" },
];

/** Translated header row in canonical order. */
export function officeIncomeHeaders(tx: Tx): string[] {
  return OFFICE_INCOME_COLUMNS.map((c) => tx(c.en, c.bn));
}
