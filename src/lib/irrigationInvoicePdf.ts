// Irrigation Invoice PDF — A4/Letter page with two halves (Office copy + Farmer copy).
// Each copy is rendered independently to its own canvas so margins, cut-line
// position, and signature blocks are configurable per print run.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { loadBranding, type CompanyBranding } from "@/lib/branding";
import { formatLandSize } from "@/lib/irrigationCalc";
import { parseDagNumbers } from "@/lib/dagNumbers";
import { getReceiptLayoutSettings, dagSeparatorString, getIrrigationLabels } from "@/lib/receiptLayoutSettings";

export type InvoiceCopy = "both" | "office" | "farmer";
export type PaperFormat = "a4" | "letter" | "a5" | "a5-landscape";

export interface InvoicePdfSettings {
  /** Paper size. */
  paperFormat: PaperFormat;
  /** Page margins in mm. */
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  /** Distance from page top (mm) where the dashed cut line is drawn. */
  cutLineMm: number;
  /** Signature labels under the lines. */
  farmerSignName: string;
  farmerSignTitle: string;
  collectorSignName: string;
  collectorSignTitle: string;
}

export const DEFAULT_INVOICE_SETTINGS: InvoicePdfSettings = {
  paperFormat: "a5-landscape",
  marginTopMm: 8,
  marginBottomMm: 8,
  marginLeftMm: 8,
  marginRightMm: 8,
  cutLineMm: 148.5,
  farmerSignName: "",
  farmerSignTitle: "কৃষকের স্বাক্ষর",
  collectorSignName: "",
  collectorSignTitle: "আদায়কারীর স্বাক্ষর",
};

export interface PrinterPreset {
  id: string;
  labelEn: string;
  labelBn: string;
  settings: Partial<InvoicePdfSettings>;
}

/** Quick presets for common printers / paper combinations. */
export const PRINTER_PRESETS: PrinterPreset[] = [
  {
    id: "a4-default",
    labelEn: "A4 — Standard office printer",
    labelBn: "A4 — সাধারণ অফিস প্রিন্টার",
    settings: { paperFormat: "a4", marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 8, marginRightMm: 8, cutLineMm: 148.5 },
  },
  {
    id: "a4-tight",
    labelEn: "A4 — Tight margins (more space)",
    labelBn: "A4 — ছোট মার্জিন (বেশি জায়গা)",
    settings: { paperFormat: "a4", marginTopMm: 5, marginBottomMm: 5, marginLeftMm: 5, marginRightMm: 5, cutLineMm: 148.5 },
  },
  {
    id: "a4-inkjet",
    labelEn: "A4 — Inkjet (large unprintable border)",
    labelBn: "A4 — ইঙ্কজেট (বড় বর্ডার)",
    settings: { paperFormat: "a4", marginTopMm: 12, marginBottomMm: 12, marginLeftMm: 10, marginRightMm: 10, cutLineMm: 148.5 },
  },
  {
    id: "letter-default",
    labelEn: "Letter — Standard office printer",
    labelBn: "Letter — সাধারণ অফিস প্রিন্টার",
    settings: { paperFormat: "letter", marginTopMm: 10, marginBottomMm: 10, marginLeftMm: 10, marginRightMm: 10, cutLineMm: 139.7 }, // 11"/2 = 139.7mm
  },
  {
    id: "letter-tight",
    labelEn: "Letter — Tight margins",
    labelBn: "Letter — ছোট মার্জিন",
    settings: { paperFormat: "letter", marginTopMm: 6, marginBottomMm: 6, marginLeftMm: 6, marginRightMm: 6, cutLineMm: 139.7 },
  },
  {
    id: "a5-single",
    labelEn: "A5 — Single copy per page (148 × 210 mm)",
    labelBn: "A5 — প্রতি পৃষ্ঠায় একটি কপি (১৪৮ × ২১০ mm)",
    settings: { paperFormat: "a5", marginTopMm: 6, marginBottomMm: 6, marginLeftMm: 6, marginRightMm: 6, cutLineMm: 105 },
  },
  {
    id: "a5-tight",
    labelEn: "A5 — Tight margins",
    labelBn: "A5 — ছোট মার্জিন",
    settings: { paperFormat: "a5", marginTopMm: 4, marginBottomMm: 4, marginLeftMm: 4, marginRightMm: 4, cutLineMm: 105 },
  },
];

const SETTINGS_KEY = "mk:irrigation-invoice-pdf:v1";
const LAST_COPY_KEY = "mk:irrigation-invoice-copy:v1";

export function loadInvoiceSettings(): InvoicePdfSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_INVOICE_SETTINGS };
    return { ...DEFAULT_INVOICE_SETTINGS, ...(JSON.parse(raw) as Partial<InvoicePdfSettings>) };
  } catch { return { ...DEFAULT_INVOICE_SETTINGS }; }
}

export function saveInvoiceSettings(s: InvoicePdfSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function loadLastInvoiceCopy(): InvoiceCopy {
  try {
    const v = localStorage.getItem(LAST_COPY_KEY);
    if (v === "office" || v === "farmer" || v === "both") return v;
  } catch { /* noop */ }
  return "both";
}

export function saveLastInvoiceCopy(c: InvoiceCopy) {
  try { localStorage.setItem(LAST_COPY_KEY, c); } catch { /* noop */ }
}

export interface IrrigationInvoiceData {
  invoice_no: string;
  generated_at: string | Date;
  due_date?: string | Date | null;
  is_borga?: boolean | null;
  note?: string | null;

  irrigation_amount?: number | null;
  maintenance_amount?: number | null;
  canal_amount?: number | null;
  other_charge?: number | null;
  delay_fee?: number | null;
  payable_amount?: number | null;
  paid_amount?: number | null;
  due_amount?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  previous_due_amount?: number | null;

  invoice_status?: string | null;

  // Hybrid rate engine snapshot fields
  rate_source?: "STANDARD" | "CATEGORY" | "MANUAL" | string | null;
  applied_rate?: number | null;
  original_standard_rate?: number | null;
  irrigation_category_name?: string | null;

  farmer?: {
    name?: string | null;
    farmer_code?: string | null;
    mobile?: string | null;
    village?: string | null;
  } | null;
  land?: {
    mouza?: string | null;
    dag_no?: string | null;
    land_size?: number | null;
    parcel_size?: number | null;
  } | null;
  season?: { name?: string | null; type?: string | null; year?: number | null } | null;
}

const fmt2 = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function statusBn(s?: string | null) {
  switch (s) {
    case "draft": return "খসড়া";
    case "generated": return "ইস্যুকৃত";
    case "partial_paid": return "আংশিক পরিশোধিত";
    case "paid": return "পরিশোধিত";
    case "overdue": return "মেয়াদোত্তীর্ণ";
    case "cancelled": return "বাতিল";
    default: return "—";
  }
}

function copyHtml(d: IrrigationInvoiceData, brand: CompanyBranding, copyLabel: string, settings: InvoicePdfSettings, role: "office" | "farmer", qrDataUrl?: string, wide = false): string {
  const farmer = d.farmer ?? {};
  const land = d.land ?? {};
  const seasonLabel = [d.season?.name ?? d.season?.type, d.season?.year].filter(Boolean).join(" ");

  const logoBlock = brand.logo_url
    ? `<img src="${brand.logo_url}" crossorigin="anonymous" style="height:${wide ? 40 : 46}px;display:block;" />`
    : "";

  const orgName = brand.company_name_bn ?? brand.company_name ?? "";
  const orgLine2 = [brand.address, brand.mobile, brand.email].filter(Boolean).join(" • ");
  const regLine = brand.registration_no ? `নিবন্ধন নং: ${toBnDigits(brand.registration_no)}` : "";
  const amountWords = bnAmountInWords(Number(d.payable_amount ?? 0));

  const layout = getReceiptLayoutSettings();
  const { mouza: mouzaLabel, dag: dagLabel } = getIrrigationLabels("bn");
  const dagJoined = parseDagNumbers(land.dag_no).join(dagSeparatorString(layout.dagSeparator));
  const srcRaw = (d.rate_source ?? "STANDARD").toString().toUpperCase();
  const srcBn = srcRaw === "MANUAL" ? "ম্যানুয়াল" : srcRaw === "CATEGORY" ? "ক্যাটেগরি" : "মানক";
  const srcColor = srcRaw === "MANUAL" ? "#b45309" : srcRaw === "CATEGORY" ? "#1d4ed8" : "#15803d";
  const appliedRateText = d.applied_rate != null ? `${fmt2(d.applied_rate)}` : "—";
  const stdRateText = d.original_standard_rate != null ? ` (মানক: ${fmt2(d.original_standard_rate)})` : "";

  // Billed portion vs total parcel — makes barga (sharecropper) invoices explicit.
  const billedText = formatLandSize(land.land_size, "with_katha") ?? "—";
  const showPortion = d.is_borga && land.parcel_size != null
    && Number(land.parcel_size) > 0
    && Number(land.parcel_size) !== Number(land.land_size ?? 0);
  const landSizeText = showPortion
    ? `বিল হওয়া অংশ ${billedText} (মোট ${formatLandSize(land.parcel_size, "with_katha") ?? "—"})`
    : billedText;

  const rows: Array<[string, string]> = [
    ["কৃষকের নাম", `${farmer.name ?? "—"}${farmer.farmer_code ? " (" + farmer.farmer_code + ")" : ""}`],
    ["গ্রাম / মোবাইল", `${farmer.village ?? "—"}${farmer.mobile ? " / " + farmer.mobile : ""}`],
    ["জমির ধরন", d.is_borga ? "বর্গাদার" : "নিজ মালিক"],
    [mouzaLabel, `${land.mouza ?? "—"} / ${landSizeText}`],
    [dagLabel, dagJoined || "—"],
    ["সিজন", seasonLabel || "—"],
    ["রেট উৎস", `${srcBn}${d.irrigation_category_name ? " — " + d.irrigation_category_name : ""}`],
    ["প্রযোজ্য রেট/শতক", `${appliedRateText}${stdRateText}`],
    ["ইস্যু তারিখ", fmtDate(d.generated_at)],
    ["মেয়াদ তারিখ", fmtDate(d.due_date)],
    ["অবস্থা", statusBn(d.invoice_status)],
  ];

  const chargeRows: Array<[string, number | null | undefined]> = [
    ["চলতি সেচ চার্জ", d.irrigation_amount],
    ["রক্ষণাবেক্ষণ", d.maintenance_amount],
    ["খাল / নালা", d.canal_amount],
    ["অন্যান্য", d.other_charge],
    ["বিলম্ব ফি", d.delay_fee],
  ];
  if (Number(d.previous_due_amount) > 0) {
    chargeRows.push(["পূর্বের বকেয়া (পূর্ববর্তী সিজন)", d.previous_due_amount]);
  }
  if (Number(d.discount_amount) > 0) {
    chargeRows.push([`ডিসকাউন্ট (Discount)${d.discount_reason ? " — " + d.discount_reason : ""}`, -Number(d.discount_amount)]);
  }

  // Adaptive typography: shrink font / tighten line-height when there is a lot
  // of content (long farmer names, big addresses, many charge rows) so nothing
  // overflows or collides with borders. Header rows (মোট প্রদেয়/বকেয়া) stay legible.
  const maxValueLen = Math.max(
    orgName.length,
    orgLine2.length,
    ...rows.map(([, v]) => v.length),
    ...chargeRows.map(([k]) => k.length),
    0,
  );
  const totalRows = rows.length + chargeRows.length;
  const dense = maxValueLen > 46 || totalRows > 18 || (orgLine2?.length ?? 0) > 60;
  const veryDense = maxValueLen > 64 || totalRows > 22;
  const cellFont = veryDense ? 9.5 : dense ? 10 : 11;
  const cellPadV = veryDense ? 4 : dense ? 5 : 6;
  const cellLh = veryDense ? 1.35 : dense ? 1.45 : 1.55;

  const farmerSig = `
    <div style="text-align:center;min-width:150px;">
      <div style="border-top:1px solid #111;padding-top:2px;">${settings.farmerSignTitle || "কৃষকের স্বাক্ষর"}</div>
      ${settings.farmerSignName ? `<div style="font-weight:600;font-size:11px;">${settings.farmerSignName}</div>` : (farmer.name ? `<div style="font-size:11px;color:#444;">${farmer.name}</div>` : "")}
    </div>`;

  const collectorSig = `
    <div style="text-align:center;min-width:150px;">
      <div style="border-top:1px solid #111;padding-top:2px;">${settings.collectorSignTitle || "আদায়কারীর স্বাক্ষর"}</div>
      ${settings.collectorSignName ? `<div style="font-weight:600;font-size:11px;">${settings.collectorSignName}</div>` : ""}
    </div>`;

  const infoTable = `
    <table style="width:100%;border-collapse:collapse;font-size:${cellFont}px;line-height:${cellLh};table-layout:fixed;">
      ${rows.map(([k, v], i) => `
        <tr>
          <td style="padding:${cellPadV}px 12px ${cellPadV}px 4px;vertical-align:top;width:42%;color:#374151;border-bottom:1px dotted #cbcbcb;word-break:break-word;">${k}</td>
          <td style="padding:${cellPadV}px 4px ${cellPadV}px 8px;vertical-align:top;font-weight:600;border-bottom:1px dotted #cbcbcb;word-break:break-word;">${v}</td>
        </tr>`).join("")}
    </table>`;

  const chargeTable = `
    <table style="width:100%;border-collapse:collapse;font-size:${cellFont}px;line-height:${cellLh};table-layout:fixed;">
      <thead>
        <tr>
          <th style="text-align:left;padding:${cellPadV}px 8px ${cellPadV}px 4px;border-bottom:1.5px solid #333;font-weight:700;">বিবরণ</th>
          <th style="text-align:right;padding:${cellPadV}px 4px ${cellPadV}px 8px;border-bottom:1.5px solid #333;font-weight:700;width:34%;">টাকা</th>
        </tr>
      </thead>
      <tbody>
        ${chargeRows.map(([k, v]) => `
          <tr>
            <td style="padding:${cellPadV}px 8px ${cellPadV}px 4px;border-bottom:1px dotted #cbcbcb;color:#374151;word-break:break-word;">${k}</td>
            <td style="padding:${cellPadV}px 4px ${cellPadV}px 8px;text-align:right;border-bottom:1px dotted #cbcbcb;white-space:nowrap;">${fmt2(v as number)}</td>
          </tr>`).join("")}
        <tr>
          <td style="padding:${cellPadV + 1}px 8px ${cellPadV + 1}px 4px;font-weight:700;border-top:1.5px solid #333;border-bottom:1px dotted #cbcbcb;">মোট প্রদেয়</td>
          <td style="padding:${cellPadV + 1}px 4px ${cellPadV + 1}px 8px;text-align:right;font-weight:700;border-top:1.5px solid #333;border-bottom:1px dotted #cbcbcb;white-space:nowrap;">${fmt2(d.payable_amount)}</td>
        </tr>
        <tr>
          <td style="padding:${cellPadV}px 8px ${cellPadV}px 4px;color:#374151;border-bottom:1px dotted #cbcbcb;">পরিশোধিত</td>
          <td style="padding:${cellPadV}px 4px ${cellPadV}px 8px;text-align:right;border-bottom:1px dotted #cbcbcb;white-space:nowrap;">${fmt2(d.paid_amount)}</td>
        </tr>
        <tr>
          <td style="padding:${cellPadV + 1}px 8px ${cellPadV + 1}px 4px;font-weight:700;color:#b91c1c;border-bottom:1.5px solid #b91c1c;">বকেয়া</td>
          <td style="padding:${cellPadV + 1}px 4px ${cellPadV + 1}px 8px;text-align:right;font-weight:700;color:#b91c1c;border-bottom:1.5px solid #b91c1c;white-space:nowrap;">${fmt2(d.due_amount)}</td>
        </tr>
      </tbody>
    </table>`;



  const wordsBlock = `
    <div style="font-size:10.5px;margin-top:6px;">কথায়: ${amountWords} টাকা মাত্র।</div>
    ${d.note ? `<div style="font-size:10px;margin-top:2px;"><b>মন্তব্য:</b> ${d.note}</div>` : ""}`;

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div style="width:${wide ? 130 : 90}px;flex-shrink:0;">${logoBlock}</div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:15px;font-weight:700;">${orgName}</div>
        ${orgLine2 ? `<div style="font-size:10px;color:#333;margin-top:1px;">${orgLine2}</div>` : ""}
        ${regLine ? `<div style="font-size:10px;color:#333;">${regLine}</div>` : ""}
        <div style="font-size:14px;font-weight:700;margin-top:6px;border-bottom:1px solid #333;display:inline-block;padding-bottom:1px;">সেচ ইনভয়েস</div>
        <div style="margin-top:4px;">
          <span style="display:inline-block;border:1px solid #111;padding:2px 14px;font-size:11px;">${copyLabel}</span>
          <span style="display:inline-block;border:1px solid ${srcColor};color:${srcColor};padding:2px 8px;margin-left:4px;font-size:10px;font-weight:600;border-radius:3px;">${srcBn}</span>
        </div>
      </div>
      <div style="width:${wide ? 130 : 90}px;flex-shrink:0;text-align:right;">
        ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:${wide ? 66 : 54}px;height:${wide ? 66 : 54}px;display:inline-block;" alt="QR" />` : ""}
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:8px;font-size:11px;">
      <div>রসিদ নং: <b>${d.invoice_no}</b></div>
      <div>তারিখ: ${fmtDate(d.generated_at)}</div>
    </div>`;

  const body = wide
    ? `
      <div style="display:flex;gap:28px;margin-top:12px;align-items:flex-start;">
        <div style="flex:1;">${infoTable}</div>
        <div style="flex:1;">${chargeTable}${wordsBlock}</div>
      </div>`
    : `
      <div style="margin-top:10px;">${infoTable}</div>
      <div style="margin-top:10px;">${chargeTable}</div>
      ${wordsBlock}`;

  return `
  <div style="font-family:'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif;color:#111;padding:14px 20px;" data-invoice-copy="${role}">
    ${header}
    ${body}
    <div style="display:flex;justify-content:space-between;margin-top:${wide ? 34 : 26}px;font-size:10px;gap:12px;">
      ${farmerSig}
      ${collectorSig}
    </div>
  </div>`;
}

async function renderCopyToCanvas(d: IrrigationInvoiceData, brand: CompanyBranding, copyLabel: string, settings: InvoicePdfSettings, role: "office" | "farmer", wide = false): Promise<HTMLCanvasElement> {
  // QR points to the public receipt verification page for this invoice.
  let qrDataUrl: string | undefined;
  try {
    const verifyUrl = `${window.location.origin}/r/${encodeURIComponent(d.invoice_no)}`;
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 120 });
  } catch { /* QR is optional; skip on failure */ }
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${wide ? 1040 : 780}px;background:#fff;`;
  wrap.innerHTML = copyHtml(d, brand, copyLabel, settings, role, qrDataUrl, wide);
  document.body.appendChild(wrap);
  try {
    await new Promise((r) => setTimeout(r, 60));
    return await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  } finally {
    wrap.remove();
  }
}

// "both" always prints on an A4 portrait sheet (office copy on top, farmer copy
// below a cut line). Single copies print on an A5 landscape sheet.
function makePdf(settings: InvoicePdfSettings, copy: InvoiceCopy): jsPDF {
  if (copy === "both") {
    return new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
  }
  if (settings.paperFormat === "a5-landscape") {
    return new jsPDF({ unit: "mm", format: "a5", orientation: "l" });
  }
  if (settings.paperFormat === "a5") return new jsPDF({ unit: "mm", format: "a5", orientation: "p" });
  const fmt = settings.paperFormat === "letter" ? "letter" : "a4";
  return new jsPDF({ unit: "mm", format: fmt, orientation: "p" });
}

async function paintInvoiceOnPage(pdf: jsPDF, d: IrrigationInvoiceData, brand: CompanyBranding, copy: InvoiceCopy, settings: InvoicePdfSettings) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const innerW = pageW - settings.marginLeftMm - settings.marginRightMm;
  // For "both" split an A4 portrait page in half.
  const cutY = pageH / 2;
  const wide = copy !== "both";

  const placeImage = (canvas: HTMLCanvasElement, yTop: number, yBottom: number) => {
    const slotH = yBottom - yTop;
    const aspect = canvas.height / canvas.width;
    const drawW = innerW;
    const drawH = drawW * aspect;
    const finalW = drawH > slotH ? slotH / aspect : drawW;
    const finalH = drawH > slotH ? slotH : drawH;
    const x = settings.marginLeftMm + (innerW - finalW) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, yTop, finalW, finalH);
  };

  if (copy === "office" || copy === "both") {
    const c = await renderCopyToCanvas(d, brand, "অফিস কপি", settings, "office", wide);
    if (copy === "office") placeImage(c, settings.marginTopMm, pageH - settings.marginBottomMm);
    else placeImage(c, settings.marginTopMm, cutY - 3);
  }
  if (copy === "farmer" || copy === "both") {
    const c = await renderCopyToCanvas(d, brand, "কৃষকের কপি", settings, "farmer", wide);
    if (copy === "farmer") placeImage(c, settings.marginTopMm, pageH - settings.marginBottomMm);
    else placeImage(c, cutY + 3, pageH - settings.marginBottomMm);
  }

  if (copy === "both") {
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.setDrawColor(60);
    pdf.setLineWidth(0.3);
    pdf.line(settings.marginLeftMm, cutY, pageW - settings.marginRightMm, cutY);
    pdf.setLineDashPattern([], 0);
    pdf.setFontSize(7);
    pdf.setTextColor(110);
    pdf.text("— এখান থেকে কেটে আলাদা করুন —", pageW / 2, cutY - 1, { align: "center" });
    pdf.setTextColor(0);
  }
}

async function renderPdf(d: IrrigationInvoiceData, copy: InvoiceCopy, settings: InvoicePdfSettings): Promise<jsPDF> {
  const brand = await loadBranding();
  const pdf = makePdf(settings, copy);
  await paintInvoiceOnPage(pdf, d, brand, copy, settings);
  return pdf;
}

async function renderBulkPdf(items: IrrigationInvoiceData[], copy: InvoiceCopy, settings: InvoicePdfSettings): Promise<jsPDF> {
  const brand = await loadBranding();
  const pdf = makePdf(settings, copy);
  for (let i = 0; i < items.length; i++) {
    if (i > 0) pdf.addPage();
    await paintInvoiceOnPage(pdf, items[i], brand, copy, settings);
  }
  return pdf;
}

export async function downloadIrrigationInvoicePdf(d: IrrigationInvoiceData, copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<void> {
  const s = settings ?? loadInvoiceSettings();
  const pdf = await renderPdf(d, copy, s);
  const suffix = copy === "office" ? "_office" : copy === "farmer" ? "_farmer" : "";
  pdf.save(`irrigation_invoice_${d.invoice_no}${suffix}.pdf`);
}

export async function previewIrrigationInvoicePdf(d: IrrigationInvoiceData, copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<string> {
  const s = settings ?? loadInvoiceSettings();
  const pdf = await renderPdf(d, copy, s);
  const blob = pdf.output("blob");
  return URL.createObjectURL(blob);
}

/** Bulk download multiple invoices as a single multi-page PDF. */
export async function downloadIrrigationInvoicesBulkPdf(items: IrrigationInvoiceData[], copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<void> {
  if (!items.length) return;
  const s = settings ?? loadInvoiceSettings();
  const pdf = await renderBulkPdf(items, copy, s);
  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`irrigation_invoices_${items.length}_${stamp}.pdf`);
}

/** Bulk preview as one multi-page PDF (returns object URL). */
export async function previewIrrigationInvoicesBulkPdf(items: IrrigationInvoiceData[], copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<string> {
  const s = settings ?? loadInvoiceSettings();
  const pdf = await renderBulkPdf(items, copy, s);
  return URL.createObjectURL(pdf.output("blob"));
}

/** Get a Blob (used by share). */
export async function getIrrigationInvoicePdfBlob(d: IrrigationInvoiceData, copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<Blob> {
  const s = settings ?? loadInvoiceSettings();
  const pdf = await renderPdf(d, copy, s);
  return pdf.output("blob");
}

/**
 * Try Web Share API (mobile) with the PDF as a file. Falls back to download.
 * Returns the action that happened: "shared" | "downloaded".
 */
export async function shareIrrigationInvoicePdf(d: IrrigationInvoiceData, copy: InvoiceCopy = "both", settings?: InvoicePdfSettings): Promise<"shared" | "downloaded"> {
  const blob = await getIrrigationInvoicePdfBlob(d, copy, settings);
  const fileName = `irrigation_invoice_${d.invoice_no}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: `সেচ ইনভয়েস ${d.invoice_no}`, text: `ইনভয়েস ${d.invoice_no} — মোট প্রদেয় ${fmt2(d.payable_amount)} টাকা` });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "shared"; // user cancelled
      // fall through to download
    }
  }
  // Fallback: download the file
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

/** Build a WhatsApp share link with text only (PDF must be sent separately on desktop). */
export function buildWhatsAppShareLink(d: IrrigationInvoiceData, mobile?: string | null): string {
  const text = `সেচ ইনভয়েস ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nবকেয়া: ${fmt2(d.due_amount)} টাকা\nমেয়াদ: ${fmtDate(d.due_date)}`;
  const cleaned = (mobile ?? "").replace(/[^\d]/g, "");
  const phone = cleaned ? (cleaned.startsWith("88") ? cleaned : "88" + cleaned) : "";
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Build an email mailto: link with the invoice summary. */
export function buildMailtoLink(d: IrrigationInvoiceData, to?: string | null): string {
  const subject = `সেচ ইনভয়েস ${d.invoice_no}`;
  const body = `প্রিয় ${d.farmer?.name ?? "কৃষক"},\n\nইনভয়েস নং: ${d.invoice_no}\nমোট প্রদেয়: ${fmt2(d.payable_amount)} টাকা\nপরিশোধিত: ${fmt2(d.paid_amount)} টাকা\nবকেয়া: ${fmt2(d.due_amount)} টাকা\nমেয়াদ: ${fmtDate(d.due_date)}\n\nধন্যবাদ।`;
  return `mailto:${to ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Test-only: build the irrigation invoice copy HTML (no DOM, no canvas). */
export function buildIrrigationInvoiceHtmlForTest(
  d: IrrigationInvoiceData,
  brand: Partial<CompanyBranding> = { company_name_bn: "Test Org" } as any,
  role: "office" | "farmer" = "farmer",
  settings: InvoicePdfSettings = DEFAULT_INVOICE_SETTINGS,
): string {
  const label = role === "office" ? "অফিস কপি" : "কৃষকের কপি";
  return copyHtml(d, brand as CompanyBranding, label, settings, role);
}
