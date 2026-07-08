import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { parseDagNumbers } from "@/lib/dagNumbers";

import { getReceiptLayoutSettings, getIrrigationLabels, getRowSpacingForKind, getSavingsLabels, getLoanLabels, getDefaultPaperSize, getDefaultOrientation, getIrrigationReceiptPadding, getReceiptFitToPage } from "@/lib/receiptLayoutSettings";
import { DEFAULT_TEMPLATE, type ReceiptTemplate } from "@/lib/paymentReceiptPdf";
import { loadReceiptTemplate } from "@/lib/receiptTemplate";

export type ReceiptKind = "irrigation" | "savings" | "loan";

/**
 * Permanently locked page configuration for the official "সেচ চার্জ ও বিবিধ আদায় রশিদ".
 * A5 landscape + fixed margins. User/profile receipt settings (A4/portrait) can NEVER
 * override this — both the on-screen preview and the generated PDF use these values.
 */
export const IRRIGATION_RECEIPT_PAGE = {
  paper: "a5" as const,
  orientation: "l" as const,
  margins: { t: 8, r: 8, b: 8, l: 8 },
  /** Render width (px) for html2canvas that yields the A5-landscape aspect. */
  renderWidthPx: 1040,
  /** A5 landscape aspect ratio (210mm / 148mm) for preview containers. */
  aspectRatio: 210 / 148,
} as const;
export type ReceiptCopy = "both" | "farmer" | "office";
export type ReceiptLang = "bn" | "en";

export interface ReceiptOrg {
  name?: string | null;
  name_bn?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  registration_no?: string | null;
}

export interface ReceiptOptions {
  lang?: ReceiptLang;             // default "bn"
  /** Page margins in mm. Default { t: 10, r: 10, b: 10, l: 10 } */
  margins?: { t?: number; r?: number; b?: number; l?: number };
  /** Page format. Default "a4". */
  paper?: "a4" | "a5" | "letter";
  /** Orientation. Default "p" (portrait). */
  orientation?: "p" | "l";
  /** Company block layout: stacked ("two-line") or compact inline ("one-line"). */
  orgLayout?: "one-line" | "two-line";
  /** Company block font scale. */
  orgSize?: "sm" | "md" | "lg";
  /** When true, also print the verify URL (with token) as text under the QR. */
  showVerifyUrl?: boolean;
  /** Shared receipt_settings template (watermark, QR placement, charge/penalty rows). */
  template?: Partial<ReceiptTemplate>;
}

export interface BnReceiptData {
  kind: ReceiptKind;
  receipt_no: string;
  /** Printed official short serial for irrigation sample layout. Stored receipt_no remains unchanged. */
  receipt_no_display?: string | null;
  date: string | Date;
  bill_info?: string;
  company_name_bn?: string | null;
  company_name?: string;
  logo_url?: string | null;
  /** Optional org block printed under the title on every copy. */
  org?: ReceiptOrg | null;

  farmer: {
    name: string;
    member_no?: string | null;
    owner_type_bn?: string | null;
    /** "ভোটার" বা "সঞ্চয়ী" — irrigation receipt member type label. */
    member_type_bn?: string | null;
    /** Voter no or savings account no shown alongside member type. */
    member_ref_no?: string | null;
    father_or_husband?: string | null;
    village?: string | null;
    mobile?: string | null;
    mouza?: string | null;
    field_type_bn?: string | null;
    land_size?: number | null;
    dag_no?: string | null;
  };

  rate?: number | null;
  charge_amount?: number | null;
  previous_due?: number | null;

  /** Patwari (responsible field officer) — irrigation receipts only */
  patwari_name?: string | null;
  patwari_mobile?: string | null;
  /** Debug indicator: where the patwari came from ("land" | "mouza" | null). */
  patwari_source?: "land" | "mouza" | null;

  description?: string | null;
  outstanding?: number | null;

  /** Irrigation receipt — enriched fields */
  land_owner_label?: string | null;            // "নিজ" or "Owner Name (member_no)"
  current_season_charge?: number | null;       // হাল
  penalty_amount?: number | null;              // বিলম্ব ফি
  maintenance_charge?: number | null;          // রক্ষণাবেক্ষণ
  canal_charge?: number | null;                // নালা চার্জ
  total_outstanding?: number | null;           // বকেয়া (whole ledger)
  collected_from_outstanding?: number | null;  // বকেয়া থেকে সংগৃহীত
  discount_amount?: number | null;             // ছাড়/ডিসকাউন্ট (হাল চার্জ থেকে)
  remark?: string | null;                      // রিমার্ক/নোট

  /** Irrigation receipt — extra layout fields matching the official রশিদ design */
  village_union?: string | null;               // ইউনিয়ন (shown with গ্রাম)
  member_summary?: string | null;              // কৃষক এবং মালিক সভ্য সদস্য (e.g. "১৯০০/ N/A")
  rate_per_bigha?: number | null;              // বিঘা রেট (defaults to acre rate × 33/100)
  /** বর্গা রশিদে কৃষক লাইনে দেখানো বর্গাদার লেবেল (e.g. "বর্গাদার - আফজাল হোসেন"). set হলে
   *  farmer line হবে: "{cultivator_label}/ {মালিকের নাম-আইডি}". */
  cultivator_label?: string | null;
  current_penalty?: number | null;             // হাল-এর জরিমানা (defaults to penalty_amount)
  due_penalty?: number | null;                 // বকেয়ার জরিমানা
  holding_description?: string | null;         // হোল্ডিং এর বিবরন
  /** Detailed list of invoices whose due this payment covered (multi-invoice). */
  covered_invoices?: Array<{ invoice_no: string; due_amount: number }> | null;
  /** When true only the "নিজ/মালিক" label shows for owner (no name/father/etc.). */
  owner_self?: boolean;

  /** Office income (no farmer): forces জমি/মৌজা rows to locked "N/A" and skips charge rows. */
  office_income?: boolean;

  /**
   * বিবিধ আদায় (হাওলাত/ভাংড়ী/অনুদান/বিবিধ): জমি/মৌজা/দাগ/চার্জ সারি বাদ —
   * শুধু নাম, পিতা, গ্রাম+ইউনিয়ন/মোবাইল, টাকা, নোট দেখাবে। bill_info = আদায়ের ধরন।
   */
  misc_collection?: boolean;

  collected_amount: number;
  collector_signature_url?: string | null;
  office_collector_signature_url?: string | null;
  /** Public URL for QR-based receipt verification */
  verify_url?: string | null;

  /** Savings receipt — enriched fields (optional, used when kind === "savings") */
  savings_account_no?: string | null;
  savings_category_bn?: string | null;     // সাধারণ / হাওলাত / ব্যাংক / দান / বিবিধ
  savings_opening_date?: string | null;
  savings_balance_before?: number | null;  // স্থিতি (লেনদেনের পূর্বে)
  savings_balance_after?: number | null;   // স্থিতি (লেনদেনের পরে)
  savings_deposit_total?: number | null;   // মোট জমা (সর্বমোট)
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// জমির পরিমাণ: . এর পর সবসময় ৪ ডিজিট (e.g. 0.3300 একর)
const fmt4 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false }).format(n || 0);


function fmtDate(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function fmtOfficialDate(d: string | Date, lang: ReceiptLang): string {
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const value = `${day}/${month}/${year}`;
  return lang === "bn" ? `${toBnDigits(value)} ইং` : value;
}

function moneyText(n: number | null | undefined, lang: ReceiptLang, suffix = ""): string {
  const value = fmt2(Number(n ?? 0));
  return `${digits(value, lang)}${suffix}`;
}

/** Official irrigation receipt money: always whole taka (no grouping, no decimals). */
function moneyInt(n: number | null | undefined, lang: ReceiptLang, suffix = ""): string {
  const v = Number(n ?? 0);
  const s = String(Math.round(v));
  return `${digits(s, lang)}${suffix}`;
}

/** চার্জ রেট display: শতাংশ থাকলে ২ ডিজিট দশমিক দেখায় (e.g. ৩৩৩৩.৩৩), না থাকলে পূর্ণসংখ্যা. */
function rateMoney(n: number | null | undefined, lang: ReceiptLang, suffix = ""): string {
  const v = Number(n ?? 0);
  const rounded = Math.round(v * 100) / 100;
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${digits(s, lang)}${suffix}`;
}

const cleanBnReceiptText = (s: string) => s
  .replace(/হওলাত/g, "হাওলাত")
  .replace(/গ্রহন/g, "গ্রহণ")
  .replace(/ভাংড়ী/g, "ভাংড়ী")
  .replace(/ভাঙারি/g, "ভাংড়ী");

const splitReceiptTokens = (s?: string | null): string[] => cleanBnReceiptText(String(s ?? ""))
  .split(/[\/|,;]+/)
  .map((x) => x.trim())
  .filter(Boolean);

function isRiceBillInfo(s?: string | null): boolean {
  const v = String(s ?? "").toLowerCase();
  return /(আমন|ইরি|বোরো|ধান|aman|iri|boro|rice|paddy)/i.test(v);
}

function normalizeCollectionInfo(s?: string | null): string | null {
  const tokens = splitReceiptTokens(s);
  if (!tokens.length) return null;
  // Client rule: "আদায়ের তথ্য" must show only the actual one item, never the full options list.
  return tokens[0];
}

function normalizeLandTypeText(fieldType?: string | null, billInfo?: string | null): string | null {
  const tokens = Array.from(new Set(splitReceiptTokens(fieldType)));
  if (!tokens.length) return null;
  const elevation = (x: string) => /(উঁচু|উচু|নিচু|মাঝারি|high|low|medium)/i.test(x);
  const bill = cleanBnReceiptText(String(billInfo ?? "")).replace(/\s+/g, "").toLowerCase();
  if (isRiceBillInfo(billInfo)) {
    const riceTypes = tokens.filter(elevation);
    return (riceTypes.length ? riceTypes : tokens).join("/");
  }
  const nonRice = tokens.filter((x) => !elevation(x));
  const matched = nonRice.find((x) => {
    const n = cleanBnReceiptText(x).replace(/\s+/g, "").toLowerCase();
    return bill && (bill.includes(n) || n.includes(bill));
  });
  return matched ?? (nonRice.length ? nonRice.join("/") : tokens.join("/"));
}

/** Official receipt rate display: entered/calculated rate is shown per acre and per bigha.
 *  1 acre = 100 শতক, 1 bigha = 33 শতক, so bigha rate = acre rate × 33 / 100.
 */
export function ratePerBighaFromAcre(ratePerAcre: number | null): number | null {
  return ratePerAcre == null ? null : (ratePerAcre * 33) / 100;
}

export function normalizeIrrigationRatePerAcre(
  storedRate: number | null | undefined,
  irrigationCharge: number | null | undefined,
  landSizeShotok: number | null | undefined,
): number | null {
  // Prefer the stored season rate (already per একর). Deriving rate from
  // charge ÷ land distorts badly for tiny parcels (e.g. ০.০০৩৪ একর → লক্ষ টাকা),
  // so only fall back to derivation when no valid stored rate exists.
  const rate = Number(storedRate ?? 0);
  if (Number.isFinite(rate) && rate > 0) {
    // Legacy rows sometimes stored rate per শতক. Convert small per-shotok values to acre.
    return rate < 500 ? rate * 100 : rate;
  }
  const land = Number(landSizeShotok ?? 0);
  const charge = Number(irrigationCharge ?? 0);
  if (Number.isFinite(land) && land > 0 && Number.isFinite(charge) && charge > 0) {
    return charge / (land / 100);
  }
  return null;
}

function fixed4Text(n: number | null | undefined, lang: ReceiptLang): string {
  return digits(fmt4(Number(n ?? 0)), lang);
}

function officialReceiptNoText(d: BnReceiptData, lang: ReceiptLang): string {
  const manual = (d.receipt_no_display ?? "").trim();
  if (manual) return digits(manual, lang);
  const raw = String(d.receipt_no ?? "").trim();
  // Official sample shows only the serial (e.g. ২৬৫২), not the internal
  // RCP/IRR date prefix. Keep the stored receipt_no intact; shorten only print.
  if (/^(RCP|RCPT|IRR|PAY|SAV|LOAN|COMBO)-/i.test(raw)) {
    const last = raw.split("-").filter(Boolean).pop() ?? raw;
    if (/^\d+$/.test(last)) return digits(last.replace(/^0+(?=\d)/, ""), lang);
  }
  return digits(raw, lang);
}

function banglaOwnerLabel(label: string, lang: ReceiptLang): string {
  const v = label.trim();
  if (!v) return v;
  if (lang !== "bn") return /^owner\s*:/i.test(v) ? v : `Owner: ${v}`;
  return /^(মালিক|নিজ)\s*[:ঃ]?/.test(v) ? v : `মালিক: ${v}`;
}

function officialMemberSummaryText(d: BnReceiptData, lang: ReceiptLang): string {
  const raw = String(d.member_summary ?? "").trim();
  if (!raw) return "—";
  if (d.owner_self) {
    const first = raw.split("/")[0]?.trim();
    return first ? digits(first, lang) : "—";
  }
  return digits(raw, lang);
}

const STR = {
  bn: {
    titleIrr: "সেচ চার্জ ও বিবিধ আদায় রশিদ",
    titleSav: "সঞ্চয় গ্রহণের রশিদ",
    titleLoan: "ঋণের কিস্তি গ্রহণের রশিদ",
    farmerCopy: "কৃষকের কপি",
    officeCopy: "অফিস কপি",
    receiptNo: "রশিদ নং:",
    billInfo: "আদায়ের তথ্য:",
    date: "সংগৃহীত তারিখ:",
    farmerLine: "কৃষকের নাম ও আইডি/মালিকের নাম ও আইডি:",
    fatherLine: "পিতার/স্বামীর নাম:",
    villageLine: "গ্রাম/মহল্লা/মোবাইল নং:",
    mouza: "মৌজা:",
    memberLine: "কৃষক এবং মালিক সভ্য সদস্য:",
    landKind: "জমির ধরন/ চার্জ রেট (একর/বিঘা):",
    landOwner: "জমির মালিক:",
    dag: "দাগ নং:",
    landSize: "জমির পরিমাণ:",
    rate: "চার্জ রেট:",
    charge: "চার্জের পরিমাণ:",
    due: "চার্জের পরিমাণ (বকেয়া)/জরিমানা:",
    collectedFromDue: "বকেয়া থেকে সংগৃহীত:",
    currentCharge: "চার্জের পরিমাণ (হাল)/জরিমানা:",
    inWords: "কথায়:",
    holding: "হোল্ডিং এর বিবরন/পাটুয়ারীর নাম ও মোবা নং:",
    extraCharges: "রক্ষণাবেক্ষণ / নালা চার্জ:",
    penalty: "জরিমানা / বিলম্ব ফি:",
    desc: "বিবরণ:",
    loanDesc: "ঋণের বিবরণ:",
    balance: "বর্তমান স্থিতি:",
    remainingLoan: "অবশিষ্ট ঋণ:",
    totalSav: "জমাকৃত পরিমাণ:",
    totalLoan: "প্রাপ্ত কিস্তি:",
    totalIrr: "মোট আদায়ের পরিমাণ:",
    discount: "ছাড় (ডিসকাউন্ট):",
    breakdown: "হিসাব বিবরণ (হাল+হাল জরিমানা+বকেয়া+বকেয়া জরিমানা−ছাড়):",
    remark: "রিমার্ক/নোট:",
    memberSig: "সদস্যের স্বাক্ষর",
    collectorSig: "আদায়কারীর স্বাক্ষর",
    regNo: "নিবন্ধন নং:",
    patwari: "পাটুয়ারী:",
  },
  en: {
    titleIrr: "Irrigation & Misc. Collection Receipt",
    titleSav: "Savings Deposit Receipt",
    titleLoan: "Loan Installment Receipt",
    farmerCopy: "Farmer Copy",
    officeCopy: "Office Copy",
    receiptNo: "Receipt No:",
    billInfo: "Collection type:",
    date: "Collected on:",
    farmerLine: "Farmer/Owner name & ID:",
    fatherLine: "Father/Husband:",
    villageLine: "Village / Union / Mobile:",
    mouza: "Mouza:",
    memberLine: "Farmer & owner member:",
    landKind: "Land type / Rate (acre/bigha):",
    landOwner: "Land owner:",
    dag: "Dag no:",
    landSize: "Land size:",
    rate: "Rate:",
    charge: "Charge amount:",
    due: "Charge (arrear)/Penalty:",
    collectedFromDue: "Collected from outstanding:",
    currentCharge: "Charge (current)/Penalty:",
    inWords: "In words:",
    holding: "Holding info / Patwari name & mobile:",
    extraCharges: "Maintenance / Canal:",
    penalty: "Penalty / Late fee:",
    desc: "Description:",
    loanDesc: "Loan description:",
    balance: "Current balance:",
    remainingLoan: "Loan outstanding:",
    totalSav: "Amount deposited:",
    totalLoan: "Installment received:",
    totalIrr: "Total collected:",
    discount: "Discount:",
    breakdown: "Breakdown (hāl+hāl penalty+arrears+arrears penalty−discount):",
    remark: "Remark / Note:",
    memberSig: "Member signature",
    collectorSig: "Collector signature",
    regNo: "Reg. No:",
    patwari: "Patwari:",
  },
} as const;

function titleFor(kind: ReceiptKind, lang: ReceiptLang): string {
  const t = STR[lang];
  return kind === "irrigation" ? t.titleIrr : kind === "savings" ? t.titleSav : t.titleLoan;
}

function digits(s: string, lang: ReceiptLang): string {
  return lang === "bn" ? toBnDigits(s) : s;
}

function orgBlock(
  org: ReceiptOrg | null | undefined,
  lang: ReceiptLang,
  layout: "one-line" | "two-line" = "two-line",
  size: "sm" | "md" | "lg" = "sm",
): string {
  if (!org) return "";
  const name = lang === "bn" ? (org.name_bn ?? org.name ?? "") : (org.name ?? org.name_bn ?? "");
  const fontPx = size === "lg" ? 13 : size === "md" ? 12 : 11;
  const namePx = size === "lg" ? 15 : size === "md" ? 13 : 12;
  if (layout === "one-line") {
    const parts = [name, org.address, org.mobile, org.email, org.registration_no && `${STR[lang].regNo} ${digits(org.registration_no, lang)}`]
      .filter(Boolean).join(" • ");
    return `<div style="text-align:center;font-size:${fontPx}px;color:#111;margin-top:2px;"><span style="font-weight:600;">${name}</span>${parts.replace(name, "") ? ` • ${parts.replace(name + " • ", "")}` : ""}</div>`;
  }
  const lines = [
    name && `<div style="font-weight:600;font-size:${namePx}px;">${name}</div>`,
    org.address && `<div>${org.address}</div>`,
    (org.mobile || org.email) && `<div>${[org.mobile, org.email].filter(Boolean).join(" • ")}</div>`,
    org.registration_no && `<div>${STR[lang].regNo} ${digits(org.registration_no, lang)}</div>`,
  ].filter(Boolean).join("");
  return `<div style="text-align:center;font-size:${fontPx}px;color:#111;margin-top:2px;">${lines}</div>`;
}

function copyHtml(d: BnReceiptData, copyLabel: string, signatureUrl: string | null | undefined, lang: ReceiptLang, orgLayout: "one-line" | "two-line", orgSize: "sm" | "md" | "lg", qrDataUrl?: string | null, showVerifyUrl?: boolean, tpl: ReceiptTemplate = DEFAULT_TEMPLATE): string {
  const t = STR[lang];
  const officialIrrigationReceipt = d.kind === "irrigation" && !d.office_income;
  const logo = d.logo_url
    ? `<img src="${d.logo_url}" crossorigin="anonymous" style="${officialIrrigationReceipt ? "max-width:215px;height:64px;object-fit:contain;object-position:left center;" : "height:60px;display:block;margin:0 auto 4px;"}" />`
    : `<div style="height:60px;display:flex;align-items:center;${officialIrrigationReceipt ? "justify-content:flex-start;text-align:left;" : "justify-content:center;"}font-size:18px;font-weight:700;color:#111;">${(lang === "bn" ? d.company_name_bn ?? d.company_name : d.company_name ?? d.company_name_bn) ?? ""}</div>`;

  const rows: Array<[string, string]> = [];
  const isMisc = d.kind === "irrigation" && !!d.misc_collection && !d.office_income;
  const isIrrigationStd = d.kind === "irrigation" && !d.office_income && !d.misc_collection;

  if (isMisc) {
    // ===== বিবিধ আদায় (হাওলাত/ভাংড়ী/অনুদান/বিবিধ) — জমি সম্পর্কিত কোনো সারি নয় =====
    // 1. নাম
    rows.push([lang === "bn" ? "নাম:" : "Name:", d.farmer.name || "—"]);
    // 2. পিতার/স্বামীর নাম
    rows.push([t.fatherLine, d.farmer.father_or_husband ?? "—"]);
    // 3. গ্রাম + ইউনিয়ন / মোবাইল
    const villageParts = [d.farmer.village, d.village_union].filter(Boolean).join(",");
    rows.push([t.villageLine, `${villageParts || "—"}${d.farmer.mobile ? "/" + d.farmer.mobile : ""}`]);
    // 4. টাকা (মোট আদায়)
    rows.push([t.totalIrr, fmt2(d.collected_amount)]);
    // 5. কথায়
    if (lang === "bn") rows.push([t.inWords, `${bnAmountInWords(d.collected_amount)}।`]);
    // 6. নোট
    const note = (d.remark ?? d.holding_description ?? "").trim();
    if (note) rows.push([t.remark, note]);
  } else if (isIrrigationStd) {
    // ===== Official "সেচ চার্জ ও বিবিধ আদায় রশিদ" layout (A5, fixed row order) =====
    const layout = getReceiptLayoutSettings();
    const { dag: dagLabel } = getIrrigationLabels(lang);
    // মৌজা: custom override থাকলে সেটি, নাহলে নতুন ডিফল্ট "মৌজা:"
    const mouzaLabel = ((lang === "bn" ? layout.mouzaLabelBn : layout.mouzaLabelEn) || "").trim() || t.mouza;

    // 1. কৃষকের নাম ও আইডি / মালিকের নাম ও আইডি
    //    চাষি/বর্গাদার = পরিশোধকৃত ইনভয়েসের farmer_id; মালিক = জমির owner_farmer_id।
    //    চাষি ও মালিক একই হলে (নিজ জমি) একটিই নাম-আইডি দেখাবে।
    const idPart = `${d.farmer.name}${d.farmer.member_no ? "-" + digits(String(d.farmer.member_no), lang) : ""}`;
    const cultivatorPart = (d.cultivator_label && d.cultivator_label.trim())
      ? digits(d.cultivator_label.trim(), lang)
      : idPart;
    if (d.owner_self) {
      rows.push([t.farmerLine, cultivatorPart]);
    } else {
      const ownerPart = (d.land_owner_label && d.land_owner_label.trim())
        ? banglaOwnerLabel(digits(d.land_owner_label, lang), lang)
        : idPart;
      rows.push([t.farmerLine, `${cultivatorPart}/${ownerPart}`]);
    }
    // 2. পিতার/স্বামীর নাম
    rows.push([t.fatherLine, d.farmer.father_or_husband ?? "—"]);
    // 3. গ্রাম/মহল্লা/মোবাইল নং (গ্রাম এর সাথে ইউনিয়ন)
    const villageParts = [d.farmer.village, d.village_union].filter(Boolean).join(",");
    rows.push([t.villageLine, `${villageParts || "—"}${d.farmer.mobile ? "/" + digits(String(d.farmer.mobile), lang) : ""}`]);
    // 4. কৃষক এবং মালিক সভ্য সদস্য
    rows.push([t.memberLine, officialMemberSummaryText(d, lang)]);
    // 5. মৌজা
    rows.push([mouzaLabel, d.farmer.mouza || "—"]);
    // 6. জমির ধরন / চার্জ রেট (একর/বিঘা — বিঘা = একর রেট × ৩৩/১০০)
    const ratePerAcre = d.rate != null
      ? normalizeIrrigationRatePerAcre(d.rate, null, null)
      : normalizeIrrigationRatePerAcre(null, d.current_season_charge, d.farmer.land_size);
    const ratePerBigha = d.rate_per_bigha != null
      ? Number(d.rate_per_bigha)
      : ratePerBighaFromAcre(ratePerAcre);
    const unit = lang === "bn" ? "টাকা" : "";
    const rateText = ratePerAcre != null ? `${rateMoney(ratePerAcre, lang, unit)}/${rateMoney(ratePerBigha ?? 0, lang, unit)}` : "";
    rows.push([t.landKind, [normalizeLandTypeText(d.farmer.field_type_bn, d.bill_info), rateText].filter(Boolean).join("/ ") || "—"]);
    // 7. দাগ নং (একাধিক হতে পারে) — ডেমো অনুযায়ী ডট-সেপারেটেড
    const dagTokens = parseDagNumbers(d.farmer.dag_no);
    const dagFormatted = digits(dagTokens.join("."), lang);
    rows.push([dagLabel, `<span data-receipt-row="dag">${dagFormatted || "—"}</span>`]);
    // 8. জমির পরিমাণ — একর (শতক ÷ ১০০), . এর পর ৪ ডিজিট
    const acre = d.farmer.land_size != null ? Number(d.farmer.land_size) / 100 : null;
    rows.push([t.landSize, acre != null ? `${fixed4Text(acre, lang)} ${lang === "bn" ? "একর" : "acre"}` : "—"]);
    // 9. চার্জের পরিমাণ (হাল)/জরিমানা — চলতি সিজনের জমি
    const halCharge = Number(d.current_season_charge ?? 0);
    const halPenalty = Number(d.current_penalty ?? d.penalty_amount ?? 0);
    rows.push([t.currentCharge, `${moneyInt(halCharge, lang, "৳")}/${moneyInt(halPenalty, lang, "৳")}`]);
    // 10. চার্জের পরিমাণ (বকেয়া)/জরিমানা — গত সিজনের জমি
    const dueCharge = Number(d.total_outstanding ?? d.previous_due ?? 0);
    const duePenalty = Number(d.due_penalty ?? 0);
    rows.push([t.due, `${moneyInt(dueCharge, lang, "৳")}/${moneyInt(duePenalty, lang, "৳")}`]);
    // 11. ছাড় (ডিসকাউন্ট) — থাকলেই দেখাবে এবং মোট থেকে বাদ যাবে
    const discount = Math.max(0, Number(d.discount_amount ?? 0));
    if (discount > 0) rows.push([t.discount, `-${moneyInt(discount, lang, "৳")}`]);
    // 12. মোট আদায়ের পরিমাণ (হাল + হাল জরিমানা + বকেয়া + বকেয়া জরিমানা − ছাড়)
    const totalDue = Math.max(0, halCharge + halPenalty + dueCharge + duePenalty - discount);
    const totalIrr = Number(d.collected_amount ?? 0) > 0 ? Number(d.collected_amount ?? 0) : totalDue;
    rows.push([t.totalIrr, moneyInt(totalIrr, lang, "৳")]);
    // 12. কথায়
    if (lang === "bn") rows.push([t.inWords, `${bnAmountInWords(totalIrr)} মাত্র।`]);
    // 13. হোল্ডিং এর বিবরন / পাটুয়ারীর নাম ও মোবা নং (সবসময় দেখাবে)
    const holdingDesc = (d.holding_description ?? "").trim() || null;
    const patwariText = d.patwari_name
      ? `${d.patwari_name}${d.patwari_mobile ? "-" + digits(String(d.patwari_mobile), lang) : ""}`
      : null;
    const holdingParts = [holdingDesc, patwariText].filter(Boolean).join(" / ");
    rows.push([t.holding, holdingParts || "—"]);
    // 14. পরিশোধকৃত টাকা সারি বাদ (client request)
  } else {
    // কৃষকের নাম এবং কৃষক সদস্য নং: name - member_no - owner_type - voter/savings ref
    const memberRefSuffix = d.farmer.member_type_bn || d.farmer.member_ref_no
      ? ` - ${[d.farmer.member_type_bn, d.farmer.member_ref_no].filter(Boolean).join(" ")}`.trimEnd()
      : "";
    rows.push([
      t.farmerLine,
      `${d.farmer.name}${d.farmer.member_no ? " - " + d.farmer.member_no : ""}${d.farmer.owner_type_bn ? " - " + d.farmer.owner_type_bn : ""}${memberRefSuffix}`,
    ]);
    rows.push([t.villageLine, `${d.farmer.village ?? "—"}${d.farmer.mobile ? " / " + d.farmer.mobile : ""}`]);
    if (d.farmer.father_or_husband) rows.push([t.fatherLine, d.farmer.father_or_husband]);

    if (d.office_income) {
      // Farmer-less office income receipt: জমি ও মৌজা সবসময় locked "N/A".
      const { mouza: mouzaLabel } = getIrrigationLabels(lang);
      rows.push([mouzaLabel, "N/A"]);
      rows.push([t.landOwner, "N/A"]);
    } else if (d.kind === "savings") {
      const sl = getSavingsLabels(lang);
      const mouzaLabel = t.mouza; // savings: plain label, no irrigation custom-label leak
      if (d.savings_account_no) rows.push([lang === "bn" ? "সঞ্চয়ী হিসাব নং:" : "Savings A/C No:", String(d.savings_account_no)]);
      if (d.savings_category_bn) rows.push([lang === "bn" ? "ক্যাটাগরি:" : "Category:", d.savings_category_bn]);
      if (d.savings_opening_date) rows.push([lang === "bn" ? "হিসাব খোলার তারিখ:" : "Account opened:", fmtDate(d.savings_opening_date)]);
      if (d.farmer.mouza) rows.push([mouzaLabel, d.farmer.mouza]);
      if (d.description) rows.push([sl.desc, d.description]);
      if (d.savings_balance_before != null) rows.push([lang === "bn" ? "পূর্বের স্থিতি:" : "Balance before:", fmt2(Number(d.savings_balance_before))]);
      if (d.outstanding != null) rows.push([sl.balance, fmt2(Number(d.outstanding))]);
      if (d.savings_balance_after != null) rows.push([lang === "bn" ? "নতুন স্থিতি:" : "New balance:", fmt2(Number(d.savings_balance_after))]);
      if (d.savings_deposit_total != null) rows.push([lang === "bn" ? "মোট জমা:" : "Total deposited:", fmt2(Number(d.savings_deposit_total))]);
    } else {
      const ll = getLoanLabels(lang);
      const mouzaLabel = t.mouza; // loan: plain label, no irrigation custom-label leak
      if (d.farmer.mouza) rows.push([mouzaLabel, d.farmer.mouza]);
      if (d.description) rows.push([ll.desc, d.description]);
      if (d.outstanding != null) rows.push([ll.outstanding, fmt2(Number(d.outstanding))]);
    }

    const totalLabel = d.kind === "savings" ? t.totalSav : d.kind === "loan" ? t.totalLoan : t.totalIrr;
    const amountText = lang === "bn"
      ? `${fmt2(d.collected_amount)} (${bnAmountInWords(d.collected_amount)})`
      : `${fmt2(d.collected_amount)}`;
    rows.push([totalLabel, amountText]);
    if (d.office_income && (d.remark ?? "").trim()) {
      rows.push([t.remark, String(d.remark).trim()]);
    }
  }


  const pad = getRowSpacingForKind(d.kind);
  // Consistent wrapping for both Bangla and English long values (dag lists,
  // long remarks, holding text) so cells never overflow the A5 page width.
  const cellWrap = "word-break:break-word;overflow-wrap:anywhere;white-space:pre-line;line-height:1.35;";
  const tableRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:${pad}px 8px;vertical-align:top;width:38%;color:#111;${cellWrap}">${k}</td>
      <td style="padding:${pad}px 8px;vertical-align:top;color:#111;${cellWrap}">${v}</td>
    </tr>`).join("");

  const fontFamily = lang === "bn"
    ? `'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif`
    : `'Inter','Helvetica','Arial',sans-serif`;

  const layoutSettings = getReceiptLayoutSettings();
  // Prefer the shared receipt_settings template; fall back to per-module layout settings.
  const wmEnabled = tpl.show_watermark || layoutSettings.watermarkEnabled;
  const wmText = wmEnabled
    ? (tpl.watermark_text || layoutSettings.watermarkText || d.company_name_bn || d.company_name || "").trim()
    : "";
  const watermark = wmText
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;">
         <div style="transform:rotate(-30deg);font-size:64px;font-weight:800;color:rgba(0,0,0,0.12);white-space:nowrap;letter-spacing:6px;font-family:${fontFamily};">${wmText}</div>
       </div>` : "";

  if (officialIrrigationReceipt) {
    const accent = (tpl.accent_color || "").trim() || "#111";
    const red = "#111";
    const blue = "#111";
    const padCfg = getIrrigationReceiptPadding();
    const hb = padCfg.holdingBottom;
    const officialRows = rows.map(([k, v], idx) => {
      const isLast = idx === rows.length - 1;
      const rowPadY = isLast ? `1px 0 ${hb}px 12px` : "1px 0 1px 12px";
      const rowPadColon = isLast ? `1px 8px ${hb}px 4px` : "1px 8px 1px 4px";
      const rowPadVal = isLast ? `1px 12px ${hb}px 0` : "1px 12px 1px 0";
      const label = k === t.farmerLine
        ? `<span style="color:${red};">কৃষকের নাম ও আইডি</span><span style="color:${blue};">/মালিকের নাম ও আইডি</span>`
        : k === t.landKind
          ? `<span style="color:${red};">জমির ধরন</span><span style="color:${blue};">/ চার্জ রেট (একর/বিঘা)</span>`
          : k;
      const value = k === t.farmerLine
        ? (() => {
            const parts = String(v).split("/");
            return parts.length > 1
              ? `<span style="color:${red};">${parts[0]}</span><span style="color:${blue};">/${parts.slice(1).join("/")}</span>`
              : `<span style="color:${red};">${v}</span>`;
          })()
        : k === t.landKind
          ? (() => {
              const parts = String(v).split("/ ");
              return parts.length > 1
                ? `<span style="color:${red};">${parts[0]}</span><span style="color:${blue};">/${parts.slice(1).join("/ ")}</span>`
                : `<span style="color:${red};">${v}</span>`;
            })()
          : v;
      return `
        <tr>
          <td style="padding:${rowPadY};vertical-align:top;width:46%;font-size:18px;line-height:1.2;white-space:normal;overflow:visible;text-overflow:clip;font-weight:600;">${label}</td>
          <td style="padding:${rowPadColon};vertical-align:top;width:14px;font-size:18px;line-height:1.2;font-weight:700;">:</td>
          <td style="padding:${rowPadVal};vertical-align:top;font-size:18px;line-height:1.2;font-weight:600;${cellWrap}">${value}</td>
        </tr>`;
    }).join("");

    return `
    <div style="position:relative;font-family:${fontFamily};color:#111;padding:${padCfg.page}px ${padCfg.page}px ${padCfg.bottom}px;min-height:650px;box-sizing:border-box;" data-receipt-copy="${copyLabel}">
      ${watermark}
      <div style="position:relative;z-index:1;display:grid;grid-template-columns:240px 1fr 128px;align-items:start;min-height:92px;">
        <div style="padding-top:16px;">${tpl.show_logo ? logo : ""}</div>
        <div style="text-align:center;padding-top:24px;">
          <div style="display:inline-block;font-size:25px;font-weight:800;line-height:1.1;color:${accent};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px;">${titleFor(d.kind, lang)}</div>
        </div>
        <div style="text-align:right;padding-top:14px;">
          ${qrDataUrl && tpl.qr_placement !== "none" ? `<img src="${qrDataUrl}" style="width:78px;height:78px;display:block;margin-left:auto;" /><div style="font-size:11px;color:#111;margin-top:2px;">${lang === "bn" ? "যাচাই করুন" : "Scan to verify"}</div>` : ""}
        </div>
      </div>

      <div style="position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;column-gap:24px;margin-top:4px;font-size:21px;line-height:1.35;">
        <div>
          <div>${t.receiptNo} ${officialReceiptNoText(d, lang)}</div>
          ${d.bill_info ? `<div>${t.billInfo} ${digits(cleanBnReceiptText(normalizeCollectionInfo(d.bill_info) ?? d.bill_info), lang)}</div>` : ""}
        </div>
        <div style="white-space:nowrap;padding-top:30px;">${t.date} ${fmtOfficialDate(d.date, lang)}</div>
      </div>

      <table style="position:relative;z-index:1;width:100%;border:2px solid ${accent};border-collapse:collapse;margin-top:14px;table-layout:fixed;">
        <tbody>${officialRows}</tbody>
      </table>

      ${tpl.show_signature_line !== false ? `
      <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;margin-top:54px;font-size:19px;line-height:1.2;">
        <div style="border-top:1px solid #111;padding-top:2px;min-width:260px;">${lang === "bn" ? "সদস্যের স্বাক্ষর/প্রদানকারীর স্বাক্ষর" : "Member / Payer signature"}</div>
        <div style="text-align:right;min-width:300px;">
          ${signatureUrl
            ? `<img src="${signatureUrl}" crossorigin="anonymous" style="height:60px;margin:0 0 4px auto;display:block;" data-sig="filled" />`
            : ""}
          <div style="border-top:1px solid #111;padding-top:4px;font-size:22px;font-weight:600;">${t.collectorSig}</div>
        </div>
      </div>` : ""}
      ${(() => { const fn = (lang === "bn" ? tpl.footer_note_bn : tpl.footer_note) || ""; return fn.trim() ? `<div style="position:relative;z-index:1;text-align:center;font-size:13px;color:#555;margin-top:14px;">${fn}</div>` : ""; })()}
    </div>`;
  }

  return `
  <div style="position:relative;font-family:${fontFamily};color:#111;padding:18px 22px;" data-receipt-copy="${copyLabel}">
    ${watermark}
    <div style="position:relative;z-index:1;"></div>
    <div style="text-align:center;position:relative;z-index:1;">
      ${logo}
      <div style="font-size:18px;font-weight:700;margin-top:2px;">${titleFor(d.kind, lang)}</div>
      ${orgBlock(d.org, lang, orgLayout, orgSize)}
      <div style="display:inline-block;border:1px solid #111;padding:2px 14px;margin-top:6px;font-size:13px;">${copyLabel}</div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:13px;">
      <div>
        <div>${t.receiptNo} ${digits(d.receipt_no, lang)}</div>
        ${d.bill_info ? `<div>${t.billInfo} ${d.bill_info}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div>${t.date} ${fmtDate(d.date)}</div>
      </div>
    </div>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:8px;font-size:13px;">
      ${tableRows}
    </table>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:38px;font-size:13px;gap:12px;">
      <div style="text-align:left;">
        <div style="border-top:0;padding-top:0;">${isIrrigationStd ? (lang === "bn" ? "সদস্যের স্বাক্ষর/প্রদানকারীর স্বাক্ষর" : "Member / Payer signature") : t.memberSig}</div>
        <div style="margin-top:18px;font-weight:600;">${isIrrigationStd ? "" : d.farmer.name}</div>
      </div>
      ${qrDataUrl && tpl.qr_placement !== "none" ? `
      <div style="text-align:center;">
        <img src="${qrDataUrl}" style="width:78px;height:78px;display:block;margin:0 auto;" />
        <div style="font-size:9px;color:#111;margin-top:2px;">${lang === "bn" ? "যাচাই করুন" : "Scan to verify"}</div>
        ${showVerifyUrl && d.verify_url ? `<div style="font-size:8px;color:#111;margin-top:1px;word-break:break-all;max-width:160px;font-family:monospace;">${d.verify_url}</div>` : ""}
      </div>` : ""}
      <div style="text-align:right;">
        <div>${t.collectorSig}</div>
        ${signatureUrl
          ? `<img src="${signatureUrl}" crossorigin="anonymous" style="height:36px;margin-top:4px;display:block;margin-left:auto;" data-sig="filled" />`
          : `<div style="margin-top:30px;border-top:1px solid #111;width:140px;height:1px;display:inline-block;" data-sig="placeholder"></div>`}
      </div>
    </div>
  </div>`;
}

function buildHtml(d: BnReceiptData, copy: ReceiptCopy, lang: ReceiptLang, orgLayout: "one-line" | "two-line", orgSize: "sm" | "md" | "lg", qrDataUrl?: string | null, showVerifyUrl?: boolean, tpl: ReceiptTemplate = DEFAULT_TEMPLATE): HTMLDivElement {
  const wrap = document.createElement("div");
  // Official irrigation receipt is A5 *landscape*, so render in a landscape-proportioned
  // container; everything else stays at the A4-portrait width.
  const isOfficialIrrigation = d.kind === "irrigation" && !d.office_income;
  const wrapWidth = isOfficialIrrigation ? IRRIGATION_RECEIPT_PAGE.renderWidthPx : 794;
  wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${wrapWidth}px;background:#fff;`;
  // সেচ চার্জ ও বিবিধ আদায় রশিদ: সবসময় একটিমাত্র কপি (কৃষক/অফিস আলাদা নয়), copy যাই আসুক।
  if (isOfficialIrrigation) {
    wrap.innerHTML = copyHtml(d, STR[lang].farmerCopy, d.collector_signature_url, lang, orgLayout, orgSize, qrDataUrl, showVerifyUrl, tpl);
    document.body.appendChild(wrap);
    return wrap;
  }
  const farmerCopy = copyHtml(d, STR[lang].farmerCopy, d.collector_signature_url, lang, orgLayout, orgSize, qrDataUrl, showVerifyUrl, tpl);
  const officeCopy = copyHtml(d, STR[lang].officeCopy, d.office_collector_signature_url ?? d.collector_signature_url, lang, orgLayout, orgSize, qrDataUrl, showVerifyUrl, tpl);
  if (copy === "farmer") wrap.innerHTML = farmerCopy;
  else if (copy === "office") wrap.innerHTML = officeCopy;
  else wrap.innerHTML = `${farmerCopy}<div style="border-top:1px dashed #111;margin:8px 22px;"></div>${officeCopy}`;
  document.body.appendChild(wrap);
  return wrap;
}

/**
 * Shared builder for the official "সেচ চার্জ ও বিবিধ আদায় রশিদ" HTML (single copy).
 * Both the live irrigation module and the legacy-data receipt generator MUST use this
 * so the two layouts can never diverge (same template, fonts, borders, signature row).
 */
export function buildOfficialIrrigationReceiptHtml(
  data: BnReceiptData,
  qrDataUrl?: string | null,
  lang: ReceiptLang = "bn",
): string {
  return copyHtml(data, STR[lang].farmerCopy, data.collector_signature_url, lang, "two-line", "sm", qrDataUrl, false, DEFAULT_TEMPLATE);
}

/** Render width (px) used for the official irrigation receipt canvas. Shared across modules. */
export const IRRIGATION_RECEIPT_RENDER_WIDTH = IRRIGATION_RECEIPT_PAGE.renderWidthPx;

/** Test-only: build a single receipt copy's HTML without touching the DOM. */

export function buildReceiptCopyHtmlForTest(
  data: BnReceiptData,
  copy: "farmer" | "office" = "farmer",
  lang: ReceiptLang = "bn",
): string {
  return copyHtml(
    data,
    STR[lang][copy === "farmer" ? "farmerCopy" : "officeCopy"],
    data.collector_signature_url,
    lang,
    "two-line",
    "sm",
    null,
    false,
  );
}

function copySuffix(copy: ReceiptCopy): string {
  return copy === "farmer" ? "_farmer" : copy === "office" ? "_office" : "";
}

function resolveOpts(o?: ReceiptOptions) {
  return {
    lang: (o?.lang ?? "bn") as ReceiptLang,
    paper: o?.paper ?? getDefaultPaperSize(),
    orientation: o?.orientation ?? getDefaultOrientation(),
    margins: { t: o?.margins?.t ?? 10, r: o?.margins?.r ?? 10, b: o?.margins?.b ?? 10, l: o?.margins?.l ?? 10 },
    orgLayout: (o?.orgLayout ?? "two-line") as "one-line" | "two-line",
    orgSize: (o?.orgSize ?? "sm") as "sm" | "md" | "lg",
    showVerifyUrl: !!o?.showVerifyUrl,
  };
}

async function renderPdf(data: BnReceiptData, copy: ReceiptCopy, options?: ReceiptOptions, target?: jsPDF): Promise<jsPDF> {
  const opts = resolveOpts(options);
  // সেচ চার্জ ও বিবিধ আদায় রশিদ: সবসময় FIXED A5 landscape।
  // User/profile receipt settings (A4/portrait) irrigation official receipt-কে override করতে পারবে না।
  if (data.kind === "irrigation" && !data.office_income) {
    opts.paper = IRRIGATION_RECEIPT_PAGE.paper;
    opts.orientation = IRRIGATION_RECEIPT_PAGE.orientation;
    opts.margins = { ...IRRIGATION_RECEIPT_PAGE.margins };
  }
  let tpl: ReceiptTemplate = { ...DEFAULT_TEMPLATE };
  try { tpl = { ...tpl, ...(await loadReceiptTemplate(true)) }; } catch { /* use defaults */ }
  if (options?.template) tpl = { ...tpl, ...options.template };
  // QR verify link. Always render a QR for scan-to-verify: prefer an explicit
  // verify_url (contains the payment's verify_token). When absent (e.g. legacy
  // receipts / reprints without a token), fall back to the legacy verify route
  // `/r/legacy-{receipt_no}` which the verify page resolves by receipt number —
  // never `/r/{receipt_no}` which would fail the hex-token check.
  let qrDataUrl: string | null = null;
  const verifyUrl =
    data.verify_url ||
    (data.receipt_no ? `${window.location.origin}/r/legacy-${encodeURIComponent(data.receipt_no)}` : null);
  if (verifyUrl && tpl.qr_placement !== "none") {
    try { qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 180 }); } catch { /* noop */ }
  }
  const node = buildHtml(data, copy, opts.lang, opts.orgLayout, opts.orgSize, qrDataUrl, opts.showVerifyUrl, tpl);
  try {
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    let pdf: jsPDF;
    if (target) {
      target.addPage(opts.paper, opts.orientation);
      pdf = target;
    } else {
      pdf = new jsPDF({ unit: "mm", format: opts.paper, orientation: opts.orientation });
    }
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const innerW = pageW - opts.margins.l - opts.margins.r;
    const innerH = pageH - opts.margins.t - opts.margins.b;
    // Fit the rendered receipt inside ONE page without distortion. If the
    // content is taller than the printable area (long text / many dag rows),
    // scale it down proportionally so it never overflows to a second page.
    // The fit-to-page toggle keeps the preview and PDF aligned across drivers.
    let drawW = innerW;
    let drawH = (canvas.height * innerW) / canvas.width;
    if (getReceiptFitToPage() && drawH > innerH) {
      const scale = innerH / drawH;
      drawH = innerH;
      drawW = innerW * scale;
    }
    const offsetX = opts.margins.l + (innerW - drawW) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", offsetX, opts.margins.t, drawW, drawH);
    return pdf;
  } finally {
    node.remove();
  }
}

export async function downloadBnReceiptPdf(data: BnReceiptData, copy: ReceiptCopy = "both", options?: ReceiptOptions): Promise<void> {
  const pdf = await renderPdf(data, copy, options);
  pdf.save(`${data.farmer.name.replace(/\s+/g, "_")}_${data.receipt_no}_${data.kind}${copySuffix(copy)}_receipt.pdf`);
}

/**
 * Render several receipts into ONE multi-page PDF and download it. Each receipt
 * keeps its own paper/orientation (e.g. irrigation stays A5 landscape).
 */
export async function downloadBnReceiptsPdf(
  items: { data: BnReceiptData; copy?: ReceiptCopy; options?: ReceiptOptions }[],
  fileName = `receipts_${new Date().toISOString().slice(0, 10)}.pdf`,
): Promise<void> {
  if (!items.length) return;
  if (items.length === 1) {
    return downloadBnReceiptPdf(items[0].data, items[0].copy ?? "both", items[0].options);
  }
  let pdf: jsPDF | undefined;
  for (const it of items) {
    pdf = await renderPdf(it.data, it.copy ?? "both", it.options, pdf);
  }
  pdf!.save(fileName);
}

export async function previewBnReceiptPdf(data: BnReceiptData, copy: ReceiptCopy = "both", options?: ReceiptOptions): Promise<string> {
  const pdf = await renderPdf(data, copy, options);
  return pdf.output("datauristring");
}

/**
 * Flatten a receipt into a single Excel row. Columns mirror the rendered receipt
 * so the Excel export stays consistent with the PDF/preview content.
 */
export function irrigationReceiptToExcelRow(d: BnReceiptData): Record<string, string | number> {
  const dagTokens = parseDagNumbers(d.farmer.dag_no);
  return {
    "রসিদ নং": d.receipt_no,
    "তারিখ": fmtDate(d.date),
    "বিল": d.bill_info ?? "",
    "কৃষকের নাম": d.farmer.name,
    "সদস্য নং": d.farmer.member_no ?? "",
    "পিতা/স্বামী": d.farmer.father_or_husband ?? "",
    "গ্রাম": d.farmer.village ?? "",
    "মোবাইল": d.farmer.mobile ?? "",
    "মৌজা": d.farmer.mouza ?? "",
    "দাগ নং": dagTokens.join(", "),
    "জমির ধরন": d.farmer.field_type_bn ?? "",
    "জমির পরিমান (শতক)": d.farmer.land_size ?? "",
    "জমির মালিক": d.land_owner_label ?? "",
    "চার্জ রেট": d.rate ?? "",
    "চার্জের পরিমাণ": d.charge_amount ?? "",
    "হাল": d.current_season_charge ?? "",
    "বকেয়া": d.total_outstanding ?? d.previous_due ?? 0,
    "জরিমানা": d.penalty_amount ?? 0,
    "সংগৃহীত পরিমাণ": d.collected_amount,
    "নোট": (d.holding_description ?? "").trim(),
    "রিমার্ক": d.remark ?? "",
  };
}

