// Irrigation Invoice PDF — A4 page with two A5 halves (Office copy + Farmer copy).
// Each copy is rendered independently to its own canvas so margins, cut-line
// position, and signature blocks are configurable per print run.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { loadBranding, type CompanyBranding } from "@/lib/branding";
import { formatLandSize } from "@/lib/irrigationCalc";

export type InvoiceCopy = "both" | "office" | "farmer";

export interface InvoicePdfSettings {
  /** Page margins in mm. */
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  /** Distance from page top (mm) where the dashed cut line is drawn. Default ≈ A4 mid (148.5). */
  cutLineMm: number;
  /** Signature labels under the lines. */
  farmerSignName: string;
  farmerSignTitle: string;
  collectorSignName: string;
  collectorSignTitle: string;
}

export const DEFAULT_INVOICE_SETTINGS: InvoicePdfSettings = {
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

  invoice_status?: string | null;

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

function copyHtml(d: IrrigationInvoiceData, brand: CompanyBranding, copyLabel: string, settings: InvoicePdfSettings, role: "office" | "farmer"): string {
  const farmer = d.farmer ?? {};
  const land = d.land ?? {};
  const seasonLabel = [d.season?.name ?? d.season?.type, d.season?.year].filter(Boolean).join(" ");

  const logoBlock = brand.logo_url
    ? `<img src="${brand.logo_url}" crossorigin="anonymous" style="height:42px;display:block;margin:0 auto 2px;" />`
    : "";

  const orgName = brand.company_name_bn ?? brand.company_name ?? "";
  const orgLine2 = [brand.address, brand.mobile, brand.email].filter(Boolean).join(" • ");
  const regLine = brand.registration_no ? `নিবন্ধন নং: ${toBnDigits(brand.registration_no)}` : "";
  const amountWords = bnAmountInWords(Number(d.payable_amount ?? 0));

  const rows: Array<[string, string]> = [
    ["কৃষকের নাম", `${farmer.name ?? "—"}${farmer.farmer_code ? " (" + farmer.farmer_code + ")" : ""}`],
    ["গ্রাম / মোবাইল", `${farmer.village ?? "—"}${farmer.mobile ? " / " + farmer.mobile : ""}`],
    ["জমির ধরন", d.is_borga ? "বর্গাদার" : "নিজ মালিক"],
    ["মৌজা / দাগ / জমির পরিমাণ", `${land.mouza ?? "—"} / দাগ ${land.dag_no ?? "—"} / ${formatLandSize(land.land_size) ?? "—"}`],
    ["সিজন", seasonLabel || "—"],
    ["ইস্যু তারিখ", fmtDate(d.generated_at)],
    ["মেয়াদ তারিখ", fmtDate(d.due_date)],
    ["অবস্থা", statusBn(d.invoice_status)],
  ];

  const chargeRows: Array<[string, number | null | undefined]> = [
    ["সেচ চার্জ", d.irrigation_amount],
    ["রক্ষণাবেক্ষণ", d.maintenance_amount],
    ["খাল / নালা", d.canal_amount],
    ["অন্যান্য", d.other_charge],
    ["বিলম্ব ফি", d.delay_fee],
  ];

  const farmerSig = `
    <div style="text-align:center;min-width:160px;">
      <div style="border-top:1px solid #111;padding-top:2px;">${settings.farmerSignTitle || "কৃষকের স্বাক্ষর"}</div>
      ${settings.farmerSignName ? `<div style="font-weight:600;font-size:11px;">${settings.farmerSignName}</div>` : (farmer.name ? `<div style="font-size:11px;color:#444;">${farmer.name}</div>` : "")}
    </div>`;

  const collectorSig = `
    <div style="text-align:center;min-width:160px;">
      <div style="border-top:1px solid #111;padding-top:2px;">${settings.collectorSignTitle || "আদায়কারীর স্বাক্ষর"}</div>
      ${settings.collectorSignName ? `<div style="font-weight:600;font-size:11px;">${settings.collectorSignName}</div>` : ""}
    </div>`;

  return `
  <div style="font-family:'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif;color:#111;padding:10px 14px;" data-invoice-copy="${role}">
    <div style="text-align:center;">
      ${logoBlock}
      <div style="font-size:15px;font-weight:700;">${orgName}</div>
      ${orgLine2 ? `<div style="font-size:10px;color:#333;">${orgLine2}</div>` : ""}
      ${regLine ? `<div style="font-size:10px;color:#333;">${regLine}</div>` : ""}
      <div style="font-size:15px;font-weight:700;margin-top:3px;">সেচ ইনভয়েস</div>
      <div style="display:inline-block;border:1px solid #111;padding:1px 12px;margin-top:3px;font-size:11px;">${copyLabel}</div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;">
      <div>রসিদ নং: <b>${d.invoice_no}</b></div>
      <div>তারিখ: ${fmtDate(d.generated_at)}</div>
    </div>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:5px;font-size:11px;">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:2px 6px;vertical-align:top;width:38%;border-bottom:1px solid #ddd;">${k}</td>
          <td style="padding:2px 6px;vertical-align:top;border-bottom:1px solid #ddd;">${v}</td>
        </tr>`).join("")}
    </table>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:5px;font-size:11px;">
      <thead>
        <tr style="background:#f4f4f4;">
          <th style="text-align:left;padding:3px 6px;border-bottom:1px solid #111;">বিবরণ</th>
          <th style="text-align:right;padding:3px 6px;border-bottom:1px solid #111;">টাকা</th>
        </tr>
      </thead>
      <tbody>
        ${chargeRows.map(([k, v]) => `
          <tr>
            <td style="padding:2px 6px;border-bottom:1px solid #eee;">${k}</td>
            <td style="padding:2px 6px;text-align:right;border-bottom:1px solid #eee;">${fmt2(v as number)}</td>
          </tr>`).join("")}
        <tr>
          <td style="padding:3px 6px;font-weight:700;background:#fafafa;border-top:1px solid #111;">মোট প্রদেয়</td>
          <td style="padding:3px 6px;text-align:right;font-weight:700;background:#fafafa;border-top:1px solid #111;">${fmt2(d.payable_amount)}</td>
        </tr>
        <tr>
          <td style="padding:2px 6px;">পরিশোধিত</td>
          <td style="padding:2px 6px;text-align:right;">${fmt2(d.paid_amount)}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px;font-weight:700;background:#fff5f5;color:#b91c1c;">বকেয়া</td>
          <td style="padding:3px 6px;text-align:right;font-weight:700;background:#fff5f5;color:#b91c1c;">${fmt2(d.due_amount)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size:10px;margin-top:3px;">কথায়: ${amountWords} টাকা মাত্র।</div>
    ${d.note ? `<div style="font-size:10px;margin-top:1px;"><b>মন্তব্য:</b> ${d.note}</div>` : ""}

    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:10px;gap:12px;">
      ${farmerSig}
      ${collectorSig}
    </div>
  </div>`;
}

async function renderCopyToCanvas(d: IrrigationInvoiceData, brand: CompanyBranding, copyLabel: string, settings: InvoicePdfSettings, role: "office" | "farmer"): Promise<HTMLCanvasElement> {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:780px;background:#fff;";
  wrap.innerHTML = copyHtml(d, brand, copyLabel, settings, role);
  document.body.appendChild(wrap);
  try {
    await new Promise((r) => setTimeout(r, 60));
    return await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  } finally {
    wrap.remove();
  }
}

async function renderPdf(d: IrrigationInvoiceData, copy: InvoiceCopy, settings: InvoicePdfSettings): Promise<jsPDF> {
  const brand = await loadBranding();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297
  const innerW = pageW - settings.marginLeftMm - settings.marginRightMm;
  const cutY = Math.min(Math.max(settings.cutLineMm, 60), pageH - 60);

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
    const c = await renderCopyToCanvas(d, brand, "অফিস কপি", settings, "office");
    if (copy === "office") {
      placeImage(c, settings.marginTopMm, pageH - settings.marginBottomMm);
    } else {
      placeImage(c, settings.marginTopMm, cutY - 3);
    }
  }
  if (copy === "farmer" || copy === "both") {
    const c = await renderCopyToCanvas(d, brand, "কৃষকের কপি", settings, "farmer");
    if (copy === "farmer") {
      placeImage(c, settings.marginTopMm, pageH - settings.marginBottomMm);
    } else {
      placeImage(c, cutY + 3, pageH - settings.marginBottomMm);
    }
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
