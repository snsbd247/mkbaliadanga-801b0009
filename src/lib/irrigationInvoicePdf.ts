// Irrigation Invoice PDF — A4 page with two A5 halves (Office copy + Farmer copy).
// Design mirrors `bnReceipts.ts` so the print/cut workflow stays identical to
// the existing irrigation charge payment receipt: print one A4 sheet, cut in
// the middle along the dashed line — top half stays in office, bottom half is
// handed to the farmer.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { loadBranding, type CompanyBranding } from "@/lib/branding";
import { formatLandSize } from "@/lib/irrigationCalc";

export type InvoiceCopy = "both" | "office" | "farmer";

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

function copyHtml(d: IrrigationInvoiceData, brand: CompanyBranding, copyLabel: string): string {
  const farmer = d.farmer ?? {};
  const land = d.land ?? {};
  const seasonLabel = [d.season?.name ?? d.season?.type, d.season?.year].filter(Boolean).join(" ");

  const logoBlock = brand.logo_url
    ? `<img src="${brand.logo_url}" crossorigin="anonymous" style="height:48px;display:block;margin:0 auto 2px;" />`
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

  return `
  <div style="font-family:'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif;color:#111;padding:14px 22px;" data-invoice-copy="${copyLabel}">
    <div style="text-align:center;">
      ${logoBlock}
      <div style="font-size:16px;font-weight:700;">${orgName}</div>
      ${orgLine2 ? `<div style="font-size:11px;color:#333;">${orgLine2}</div>` : ""}
      ${regLine ? `<div style="font-size:11px;color:#333;">${regLine}</div>` : ""}
      <div style="font-size:16px;font-weight:700;margin-top:4px;">সেচ ইনভয়েস</div>
      <div style="display:inline-block;border:1px solid #111;padding:1px 12px;margin-top:4px;font-size:12px;">${copyLabel}</div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;">
      <div>রসিদ নং: <b>${d.invoice_no}</b></div>
      <div>তারিখ: ${fmtDate(d.generated_at)}</div>
    </div>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:6px;font-size:12px;">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:3px 8px;vertical-align:top;width:38%;border-bottom:1px solid #ddd;">${k}</td>
          <td style="padding:3px 8px;vertical-align:top;border-bottom:1px solid #ddd;">${v}</td>
        </tr>`).join("")}
    </table>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:6px;font-size:12px;">
      <thead>
        <tr style="background:#f4f4f4;">
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #111;">বিবরণ</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #111;">টাকা</th>
        </tr>
      </thead>
      <tbody>
        ${chargeRows.map(([k, v]) => `
          <tr>
            <td style="padding:3px 8px;border-bottom:1px solid #eee;">${k}</td>
            <td style="padding:3px 8px;text-align:right;border-bottom:1px solid #eee;">${fmt2(v as number)}</td>
          </tr>`).join("")}
        <tr>
          <td style="padding:4px 8px;font-weight:700;background:#fafafa;border-top:1px solid #111;">মোট প্রদেয়</td>
          <td style="padding:4px 8px;text-align:right;font-weight:700;background:#fafafa;border-top:1px solid #111;">${fmt2(d.payable_amount)}</td>
        </tr>
        <tr>
          <td style="padding:3px 8px;">পরিশোধিত</td>
          <td style="padding:3px 8px;text-align:right;">${fmt2(d.paid_amount)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;font-weight:700;background:#fff5f5;color:#b91c1c;">বকেয়া</td>
          <td style="padding:4px 8px;text-align:right;font-weight:700;background:#fff5f5;color:#b91c1c;">${fmt2(d.due_amount)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size:11px;margin-top:4px;">কথায়: ${amountWords} টাকা মাত্র।</div>
    ${d.note ? `<div style="font-size:11px;margin-top:2px;"><b>মন্তব্য:</b> ${d.note}</div>` : ""}

    <div style="display:flex;justify-content:space-between;margin-top:22px;font-size:11px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #111;width:140px;padding-top:2px;">কৃষকের স্বাক্ষর</div>
      </div>
      <div style="text-align:center;">
        <div style="border-top:1px solid #111;width:140px;padding-top:2px;">আদায়কারীর স্বাক্ষর</div>
      </div>
    </div>
  </div>`;
}

function buildHtml(d: IrrigationInvoiceData, brand: CompanyBranding, copy: InvoiceCopy): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  const office = copyHtml(d, brand, "অফিস কপি");
  const farmerC = copyHtml(d, brand, "কৃষকের কপি");
  if (copy === "office") wrap.innerHTML = office;
  else if (copy === "farmer") wrap.innerHTML = farmerC;
  else {
    wrap.innerHTML = `${office}<div style="border-top:1.5px dashed #111;margin:6px 22px;text-align:center;font-size:10px;color:#666;">— এখান থেকে কেটে আলাদা করুন —</div>${farmerC}`;
  }
  document.body.appendChild(wrap);
  return wrap;
}

async function renderPdf(d: IrrigationInvoiceData, copy: InvoiceCopy): Promise<jsPDF> {
  const brand = await loadBranding();
  const node = buildHtml(d, brand, copy);
  try {
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const innerW = pageW - margin * 2;
    const innerH = pageH - margin * 2;
    const imgH = (canvas.height * innerW) / canvas.width;
    // Scale-to-fit so a tall (two-copy) layout always fits on a single A4 page.
    const finalW = imgH > innerH ? (canvas.width * innerH) / canvas.height : innerW;
    const finalH = imgH > innerH ? innerH : imgH;
    const x = margin + (innerW - finalW) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, margin, finalW, finalH);
    return pdf;
  } finally {
    node.remove();
  }
}

export async function downloadIrrigationInvoicePdf(d: IrrigationInvoiceData, copy: InvoiceCopy = "both"): Promise<void> {
  const pdf = await renderPdf(d, copy);
  const suffix = copy === "office" ? "_office" : copy === "farmer" ? "_farmer" : "";
  pdf.save(`irrigation_invoice_${d.invoice_no}${suffix}.pdf`);
}

export async function printIrrigationInvoicePdf(d: IrrigationInvoiceData, copy: InvoiceCopy = "both"): Promise<void> {
  const pdf = await renderPdf(d, copy);
  const url = pdf.output("bloburl");
  const w = window.open(url as any, "_blank");
  if (w) { try { w.focus(); } catch { /* noop */ } }
}
