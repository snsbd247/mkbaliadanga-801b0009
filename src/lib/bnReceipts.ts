import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { parseDagNumbers } from "@/lib/dagNumbers";
import { getReceiptLayoutSettings, dagSeparatorHtml, getIrrigationLabels, getRowSpacingForKind } from "@/lib/receiptLayoutSettings";

export type ReceiptKind = "irrigation" | "savings" | "loan";
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
  paper?: "a4" | "letter";
  /** Orientation. Default "p" (portrait). */
  orientation?: "p" | "l";
  /** Company block layout: stacked ("two-line") or compact inline ("one-line"). */
  orgLayout?: "one-line" | "two-line";
  /** Company block font scale. */
  orgSize?: "sm" | "md" | "lg";
  /** When true, also print the verify URL (with token) as text under the QR. */
  showVerifyUrl?: boolean;
}

export interface BnReceiptData {
  kind: ReceiptKind;
  receipt_no: string;
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
  remark?: string | null;                      // রিমার্ক/নোট

  collected_amount: number;
  collector_signature_url?: string | null;
  office_collector_signature_url?: string | null;
  /** Public URL for QR-based receipt verification */
  verify_url?: string | null;
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function fmtDate(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const STR = {
  bn: {
    titleIrr: "সেচ চার্জ সংগ্রহের রশিদ",
    titleSav: "সঞ্চয় গ্রহণের রশিদ",
    titleLoan: "ঋণের কিস্তি গ্রহণের রশিদ",
    farmerCopy: "কৃষকের কপি",
    officeCopy: "অফিস কপি",
    receiptNo: "রসিদ নম্বরঃ",
    billInfo: "বিলের তথ্য:",
    date: "সংগৃহীত তারিখ:",
    farmerLine: "কৃষকের নাম এবং কৃষক সদস্য নং:",
    fatherLine: "পিতা/স্বামী নাম:",
    villageLine: "গ্রাম/মহল্লা/মোবাইল:",
    mouza: "মৌজা / জমির পরিমান:",
    landKind: "জমির ধরন:",
    landOwner: "জমির মালিক:",
    dag: "দাগ নং:",
    rate: "চার্জ রেট:",
    charge: "চার্জের পরিমাণ:",
    due: "বকেয়া:",
    collectedFromDue: "বকেয়া থেকে সংগৃহীত:",
    currentCharge: "হাল:",
    extraCharges: "বিলম্ব ফি / রক্ষণাবেক্ষণ / নালা চার্জ:",
    desc: "বিবরণ:",
    loanDesc: "ঋণের বিবরণ:",
    balance: "বর্তমান স্থিতি:",
    remainingLoan: "অবশিষ্ট ঋণ:",
    totalSav: "জমাকৃত পরিমাণ:",
    totalLoan: "প্রাপ্ত কিস্তি:",
    totalIrr: "সংগৃহীত পরিমাণ:",
    remark: "রিমার্ক/নোট:",
    memberSig: "সদস্যের স্বাক্ষর",
    collectorSig: "আদায়কারীর স্বাক্ষর",
    regNo: "নিবন্ধন নং:",
    patwari: "পাটুয়ারী:",
  },
  en: {
    titleIrr: "Irrigation Charge Receipt",
    titleSav: "Savings Deposit Receipt",
    titleLoan: "Loan Installment Receipt",
    farmerCopy: "Farmer Copy",
    officeCopy: "Office Copy",
    receiptNo: "Receipt No:",
    billInfo: "Bill info:",
    date: "Collected on:",
    farmerLine: "Farmer name & member no:",
    fatherLine: "Father/Husband:",
    villageLine: "Village / Mobile:",
    mouza: "Mouza / Land size:",
    landKind: "Land type:",
    landOwner: "Land owner:",
    dag: "Dag no:",
    rate: "Rate:",
    charge: "Charge amount:",
    due: "Outstanding:",
    collectedFromDue: "Collected from outstanding:",
    currentCharge: "Current season charge:",
    extraCharges: "Penalty / Maintenance / Canal:",
    desc: "Description:",
    loanDesc: "Loan description:",
    balance: "Current balance:",
    remainingLoan: "Loan outstanding:",
    totalSav: "Amount deposited:",
    totalLoan: "Installment received:",
    totalIrr: "Amount collected:",
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
    return `<div style="text-align:center;font-size:${fontPx}px;color:#333;margin-top:2px;"><span style="font-weight:600;">${name}</span>${parts.replace(name, "") ? ` • ${parts.replace(name + " • ", "")}` : ""}</div>`;
  }
  const lines = [
    name && `<div style="font-weight:600;font-size:${namePx}px;">${name}</div>`,
    org.address && `<div>${org.address}</div>`,
    (org.mobile || org.email) && `<div>${[org.mobile, org.email].filter(Boolean).join(" • ")}</div>`,
    org.registration_no && `<div>${STR[lang].regNo} ${digits(org.registration_no, lang)}</div>`,
  ].filter(Boolean).join("");
  return `<div style="text-align:center;font-size:${fontPx}px;color:#333;margin-top:2px;">${lines}</div>`;
}

function copyHtml(d: BnReceiptData, copyLabel: string, signatureUrl: string | null | undefined, lang: ReceiptLang, orgLayout: "one-line" | "two-line", orgSize: "sm" | "md" | "lg", qrDataUrl?: string | null, showVerifyUrl?: boolean): string {
  const t = STR[lang];
  const logo = d.logo_url
    ? `<img src="${d.logo_url}" crossorigin="anonymous" style="height:60px;display:block;margin:0 auto 4px;" />`
    : `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#b91c1c;">${(lang === "bn" ? d.company_name_bn ?? d.company_name : d.company_name ?? d.company_name_bn) ?? ""}</div>`;

  const rows: Array<[string, string]> = [];
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

  if (d.kind === "irrigation") {
    // Always show land owner row — fallback to "তথ্য পাওয়া যায়নি" / "Not available" when missing
    rows.push([
      t.landOwner,
      d.land_owner_label && d.land_owner_label.trim()
        ? d.land_owner_label
        : (lang === "bn" ? "তথ্য পাওয়া যায়নি" : "Not available"),
    ]);
    // Land size stored in শতক; show both বিঘা and শতক so users can cross-check (1 বিঘা = 33 শতক).
    let sizeLabel: string | null = null;
    if (d.farmer.land_size != null) {
      const shatak = Number(d.farmer.land_size);
      const bigha = shatak / 33;
      sizeLabel = lang === "bn"
        ? `${bigha.toFixed(2)} বিঘা (${shatak.toFixed(2)} শতক)`
        : `${bigha.toFixed(2)} bigha (${shatak.toFixed(2)} shatak)`;
    }
    const layout = getReceiptLayoutSettings();
    const { mouza: mouzaLabel, dag: dagLabel } = getIrrigationLabels(lang);
    const dagTokens = parseDagNumbers(d.farmer.dag_no);
    const dagFormatted = dagTokens.join(dagSeparatorHtml(layout.dagSeparator));
    const mouzaParts = [d.farmer.mouza, sizeLabel].filter(Boolean) as string[];
    if (mouzaParts.length) rows.push([mouzaLabel, mouzaParts.join(" / ")]);
    if (dagFormatted) rows.push([dagLabel, `<span data-receipt-row="dag">${dagFormatted}</span>`]);
    if (d.farmer.field_type_bn) rows.push([t.landKind, d.farmer.field_type_bn]);
    rows.push([t.due, fmt2(Number(d.total_outstanding ?? d.previous_due ?? 0))]);
    if (d.collected_from_outstanding != null)
      rows.push([t.collectedFromDue, fmt2(Number(d.collected_from_outstanding))]);
    if (d.current_season_charge != null)
      rows.push([t.currentCharge, fmt2(Number(d.current_season_charge))]);
    const extras = [d.penalty_amount, d.maintenance_charge, d.canal_charge]
      .map((n) => fmt2(Number(n ?? 0)))
      .join(" / ");
    if (d.penalty_amount != null || d.maintenance_charge != null || d.canal_charge != null)
      rows.push([t.extraCharges, extras]);
    if (d.patwari_name) rows.push([t.patwari, `${d.patwari_name}${d.patwari_mobile ? " (" + d.patwari_mobile + ")" : ""}`]);
  } else if (d.kind === "savings") {
    if (d.description) rows.push([t.desc, d.description]);
    if (d.outstanding != null) rows.push([t.balance, fmt2(Number(d.outstanding))]);
  } else {
    if (d.description) rows.push([t.loanDesc, d.description]);
    if (d.outstanding != null) rows.push([t.remainingLoan, fmt2(Number(d.outstanding))]);
  }

  const totalLabel = d.kind === "savings" ? t.totalSav : d.kind === "loan" ? t.totalLoan : t.totalIrr;
  const amountText = lang === "bn"
    ? `${fmt2(d.collected_amount)} (${bnAmountInWords(d.collected_amount)})`
    : `${fmt2(d.collected_amount)}`;
  rows.push([totalLabel, amountText]);
  if (d.kind === "irrigation" && (d.remark ?? "").trim()) {
    rows.push([t.remark, String(d.remark).trim()]);
  }

  const pad = getReceiptLayoutSettings().rowSpacingPx;
  const tableRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:${pad}px 8px;vertical-align:top;width:38%;color:#111;">${k}</td>
      <td style="padding:${pad}px 8px;vertical-align:top;color:#111;white-space:pre-line;">${v}</td>
    </tr>`).join("");

  const fontFamily = lang === "bn"
    ? `'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif`
    : `'Inter','Helvetica','Arial',sans-serif`;

  return `
  <div style="font-family:${fontFamily};color:#111;padding:18px 22px;" data-receipt-copy="${copyLabel}">
    <div style="text-align:center;">
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
        <div style="border-top:0;padding-top:0;">${t.memberSig}</div>
        <div style="margin-top:18px;font-weight:600;">${d.farmer.name}</div>
      </div>
      ${qrDataUrl ? `
      <div style="text-align:center;">
        <img src="${qrDataUrl}" style="width:78px;height:78px;display:block;margin:0 auto;" />
        <div style="font-size:9px;color:#444;margin-top:2px;">${lang === "bn" ? "যাচাই করুন" : "Scan to verify"}</div>
        ${showVerifyUrl && d.verify_url ? `<div style="font-size:8px;color:#444;margin-top:1px;word-break:break-all;max-width:160px;font-family:monospace;">${d.verify_url}</div>` : ""}
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

function buildHtml(d: BnReceiptData, copy: ReceiptCopy, lang: ReceiptLang, orgLayout: "one-line" | "two-line", orgSize: "sm" | "md" | "lg", qrDataUrl?: string | null, showVerifyUrl?: boolean): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  const farmerCopy = copyHtml(d, STR[lang].farmerCopy, d.collector_signature_url, lang, orgLayout, orgSize, qrDataUrl, showVerifyUrl);
  const officeCopy = copyHtml(d, STR[lang].officeCopy, d.office_collector_signature_url ?? d.collector_signature_url, lang, orgLayout, orgSize, qrDataUrl, showVerifyUrl);
  if (copy === "farmer") wrap.innerHTML = farmerCopy;
  else if (copy === "office") wrap.innerHTML = officeCopy;
  else wrap.innerHTML = `${farmerCopy}<div style="border-top:1px dashed #111;margin:8px 22px;"></div>${officeCopy}`;
  document.body.appendChild(wrap);
  return wrap;
}

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
    paper: o?.paper ?? "a4",
    orientation: o?.orientation ?? "p",
    margins: { t: o?.margins?.t ?? 10, r: o?.margins?.r ?? 10, b: o?.margins?.b ?? 10, l: o?.margins?.l ?? 10 },
    orgLayout: (o?.orgLayout ?? "two-line") as "one-line" | "two-line",
    orgSize: (o?.orgSize ?? "sm") as "sm" | "md" | "lg",
    showVerifyUrl: !!o?.showVerifyUrl,
  };
}

async function renderPdf(data: BnReceiptData, copy: ReceiptCopy, options?: ReceiptOptions): Promise<jsPDF> {
  const opts = resolveOpts(options);
  let qrDataUrl: string | null = null;
  if (data.verify_url) {
    try { qrDataUrl = await QRCode.toDataURL(data.verify_url, { margin: 0, width: 180 }); } catch { /* noop */ }
  }
  const node = buildHtml(data, copy, opts.lang, opts.orgLayout, opts.orgSize, qrDataUrl, opts.showVerifyUrl);
  try {
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: opts.paper, orientation: opts.orientation });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const innerW = pageW - opts.margins.l - opts.margins.r;
    const innerH = pageH - opts.margins.t - opts.margins.b;
    const imgH = (canvas.height * innerW) / canvas.width;
    const finalH = Math.min(imgH, innerH);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", opts.margins.l, opts.margins.t, innerW, finalH);
    return pdf;
  } finally {
    node.remove();
  }
}

export async function downloadBnReceiptPdf(data: BnReceiptData, copy: ReceiptCopy = "both", options?: ReceiptOptions): Promise<void> {
  const pdf = await renderPdf(data, copy, options);
  pdf.save(`${data.farmer.name.replace(/\s+/g, "_")}_${data.receipt_no}_${data.kind}${copySuffix(copy)}_receipt.pdf`);
}

export async function previewBnReceiptPdf(data: BnReceiptData, copy: ReceiptCopy = "both", options?: ReceiptOptions): Promise<string> {
  const pdf = await renderPdf(data, copy, options);
  return pdf.output("datauristring");
}
