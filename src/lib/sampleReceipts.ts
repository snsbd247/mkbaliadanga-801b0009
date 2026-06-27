import type { BnReceiptData } from "@/lib/bnReceipts";

export type SampleReceiptType = "savings" | "loan" | "irrigation" | "misc";

export const SAMPLE_RECEIPT_TYPE_LABELS: Record<SampleReceiptType, string> = {
  irrigation: "সেচ চার্জ",
  misc: "বিবিধ আদায়",
  savings: "সঞ্চয়",
  loan: "ঋণ",
};

/** Fields that must be present for each receipt type to render fully. */
export const SAMPLE_RECEIPT_REQUIRED_FIELDS: Record<SampleReceiptType, string[]> = {
  irrigation: [
    "farmer.name", "farmer.father_or_husband", "farmer.village", "farmer.mobile",
    "farmer.mouza", "farmer.field_type_bn", "farmer.land_size", "farmer.dag_no",
    "rate", "current_season_charge", "previous_due", "holding_description",
    "patwari_name", "patwari_mobile", "member_summary", "land_owner_label",
  ],
  misc: ["farmer.name", "farmer.father_or_husband", "farmer.village", "farmer.mobile", "collected_amount"],
  savings: ["farmer.name", "savings_account_no", "savings_category_bn", "savings_balance_after", "collected_amount"],
  loan: ["farmer.name", "farmer.member_no", "collected_amount"],
};

/** Build demo receipt data for the given type. */
export function buildSampleReceipt(type: SampleReceiptType): BnReceiptData {
  const baseFarmer = {
    name: "মোঃ রহিম উদ্দিন",
    member_no: "১৯০০",
    father_or_husband: "মৃত করিম মিয়া",
    village: "বালিয়াডাঙ্গা",
    mobile: "০১৭০০০০০০০০",
  };

  if (type === "irrigation") {
    return {
      kind: "irrigation",
      receipt_no: "00123",
      receipt_no_display: "১২৩",
      date: new Date(),
      bill_info: "সেচ চার্জ",
      collected_amount: 1500,
      farmer: {
        ...baseFarmer,
        mouza: "বালিয়াডাঙ্গা",
        field_type_bn: "আমন২৬/উচু",
        land_size: 0.33,
        dag_no: "১২৩, ৪৫৬",
      },
      rate: 3939,
      rate_per_bigha: 100,
      charge_amount: 1300,
      current_season_charge: 1300,
      previous_due: 200,
      current_penalty: 0,
      due_penalty: 0,
      penalty_amount: 0,
      total_outstanding: 200,
      village_union: "বালিয়াডাঙ্গা ইউনিয়ন",
      member_summary: "১৯০০ / মোঃ আলম ইসলাম (২১০০)",
      land_owner_label: "মোঃ রহিম উদ্দিন / মোঃ আলম ইসলাম",
      holding_description: "আমন হয় না। নিজ সেচে আবাদ হয়।",
      patwari_name: "মোঃ আলম ইসলাম",
      patwari_mobile: "০১৭০০০০০০০০",
      remark: "নমুনা রশিদ",
    };
  }

  if (type === "misc") {
    return {
      kind: "irrigation",
      misc_collection: true,
      receipt_no: "00124",
      receipt_no_display: "১২৪",
      date: new Date(),
      bill_info: "অনুদান",
      collected_amount: 500,
      farmer: { ...baseFarmer, mouza: "বালিয়াডাঙ্গা" },
      remark: "নমুনা বিবিধ আদায়",
    };
  }

  if (type === "savings") {
    return {
      kind: "savings",
      receipt_no: "00125",
      receipt_no_display: "১২৫",
      date: new Date(),
      bill_info: "সঞ্চয় জমা",
      collected_amount: 1000,
      farmer: { ...baseFarmer },
      savings_account_no: "SAV-০০১",
      savings_category_bn: "সাধারণ",
      savings_opening_date: "01/01/2025",
      savings_balance_before: 5000,
      savings_balance_after: 6000,
      savings_deposit_total: 6000,
      remark: "নমুনা সঞ্চয় রশিদ",
    };
  }

  // loan
  return {
    kind: "loan",
    receipt_no: "00126",
    receipt_no_display: "১২৬",
    date: new Date(),
    bill_info: "ঋণের কিস্তি",
    collected_amount: 2000,
    farmer: { ...baseFarmer },
    description: "কিস্তি নং ৩",
    outstanding: 8000,
    remark: "নমুনা ঋণ রশিদ",
  };
}

/** Return list of required field paths that are empty/missing in the data. */
export function findMissingSampleFields(type: SampleReceiptType, data: BnReceiptData): string[] {
  const missing: string[] = [];
  for (const path of SAMPLE_RECEIPT_REQUIRED_FIELDS[type]) {
    const value = path.split(".").reduce<any>((acc, key) => (acc == null ? acc : acc[key]), data);
    if (value === null || value === undefined || value === "") missing.push(path);
  }
  return missing;
}
