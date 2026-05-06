import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";

export type ReceiptKind = "irrigation" | "savings" | "loan";

export interface BnReceiptData {
  kind: ReceiptKind;
  receipt_no: string;
  date: string | Date;
  bill_info?: string;       // e.g. "ইরি, ২০২৬" or "মাসিক সঞ্চয়, মে ২০২৬"
  company_name_bn?: string | null;
  company_name?: string;
  logo_url?: string | null;

  farmer: {
    name: string;            // displayed as-is
    member_no?: string | null;
    owner_type_bn?: string | null;     // মালিক / বর্গাচাষী
    father_or_husband?: string | null;
    village?: string | null;
    mobile?: string | null;
    mouza?: string | null;
    field_type_bn?: string | null;     // নিচু জমি(Low Land)
    land_size?: number | null;         // in shotok or as-is
    dag_no?: string | null;
  };

  // For irrigation
  rate?: number | null;
  charge_amount?: number | null;
  previous_due?: number | null;

  // For savings/loan
  description?: string | null;       // free text shown in body
  outstanding?: number | null;       // remaining balance/loan due (optional)

  collected_amount: number;          // total being received now
  collector_signature_url?: string | null;
  office_collector_signature_url?: string | null; // optional override for office copy
}

export type ReceiptCopy = "both" | "farmer" | "office";

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function fmtDateBn(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function titleFor(kind: ReceiptKind): string {
  if (kind === "irrigation") return "সেচ চার্জ সংগ্রহের রশিদ";
  if (kind === "savings") return "সঞ্চয় গ্রহণের রশিদ";
  return "ঋণের কিস্তি গ্রহণের রশিদ";
}

function copyHtml(d: BnReceiptData, copyLabel: string, signatureUrl?: string | null): string {
  const logo = d.logo_url
    ? `<img src="${d.logo_url}" crossorigin="anonymous" style="height:60px;display:block;margin:0 auto 4px;" />`
    : `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#b91c1c;">${d.company_name_bn ?? d.company_name ?? ""}</div>`;

  const rows: Array<[string, string]> = [];
  rows.push(["কৃষকের নাম এবং কৃষক সদস্য নং:", `${d.farmer.name}${d.farmer.member_no ? " - " + d.farmer.member_no : ""}${d.farmer.owner_type_bn ? " (" + d.farmer.owner_type_bn + ")" : ""}`]);
  if (d.farmer.father_or_husband) rows.push(["পিতা/স্বামী নাম:", d.farmer.father_or_husband]);
  rows.push(["গ্রাম/মহল্লা/মোবাইল:", `${d.farmer.village ?? "—"}${d.farmer.mobile ? " / " + d.farmer.mobile : ""}`]);

  if (d.kind === "irrigation") {
    if (d.farmer.mouza) rows.push(["মৌজা:", d.farmer.mouza]);
    if (d.farmer.field_type_bn || d.farmer.land_size != null)
      rows.push(["জমির ধরণ-পরিমান:", `${d.farmer.field_type_bn ?? "—"}${d.farmer.land_size != null ? "-" + Number(d.farmer.land_size).toFixed(6) : ""}`]);
    if (d.farmer.dag_no) rows.push(["দাগ নং:", d.farmer.dag_no]);
    if (d.rate != null) rows.push(["চার্জ রেট:", fmt2(Number(d.rate))]);
    if (d.charge_amount != null) rows.push(["চার্জের পরিমাণ:", fmt2(Number(d.charge_amount))]);
    rows.push(["বকেয়া:", fmt2(Number(d.previous_due ?? 0))]);
  } else if (d.kind === "savings") {
    if (d.description) rows.push(["বিবরণ:", d.description]);
    if (d.outstanding != null) rows.push(["বর্তমান স্থিতি:", fmt2(Number(d.outstanding))]);
  } else {
    if (d.description) rows.push(["ঋণের বিবরণ:", d.description]);
    if (d.outstanding != null) rows.push(["অবশিষ্ট ঋণ:", fmt2(Number(d.outstanding))]);
  }

  const totalLabel = d.kind === "savings" ? "জমাকৃত পরিমাণ:" : d.kind === "loan" ? "প্রাপ্ত কিস্তি:" : "সংগৃহীত পরিমাণ:";
  rows.push([totalLabel, `${fmt2(d.collected_amount)} (${bnAmountInWords(d.collected_amount)})`]);

  const tableRows = rows.map(([k, v]) => `
    <tr>
      <td style="padding:4px 8px;vertical-align:top;width:38%;color:#111;">${k}</td>
      <td style="padding:4px 8px;vertical-align:top;color:#111;">${v}</td>
    </tr>`).join("");

  return `
  <div style="font-family:'Noto Sans Bengali','Hind Siliguri','SolaimanLipi',sans-serif;color:#111;padding:18px 22px;">
    <div style="text-align:center;">
      ${logo}
      <div style="font-size:18px;font-weight:700;margin-top:2px;">${titleFor(d.kind)}</div>
      <div style="display:inline-block;border:1px solid #111;padding:2px 14px;margin-top:6px;font-size:13px;">${copyLabel}</div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:13px;">
      <div>
        <div>রসিদ নম্বরঃ ${toBnDigits(d.receipt_no)}</div>
        ${d.bill_info ? `<div>বিলের তথ্য: ${d.bill_info}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div>সংগৃহীত তারিখ: ${fmtDateBn(d.date)}</div>
      </div>
    </div>

    <table style="width:100%;border:1px solid #111;border-collapse:collapse;margin-top:8px;font-size:13px;">
      ${tableRows}
    </table>

    <div style="display:flex;justify-content:space-between;margin-top:38px;font-size:13px;">
      <div style="text-align:left;">
        <div style="border-top:0;padding-top:0;">সদস্যের স্বাক্ষর</div>
        <div style="margin-top:18px;font-weight:600;">${d.farmer.name}</div>
      </div>
      <div style="text-align:right;">
        <div>আদায়কারীর স্বাক্ষর</div>
        ${signatureUrl ? `<img src="${signatureUrl}" crossorigin="anonymous" style="height:36px;margin-top:4px;display:block;margin-left:auto;" />` : `<div style="margin-top:30px;border-top:1px solid #111;width:140px;height:1px;display:inline-block;"></div>`}
      </div>
    </div>
  </div>`;
}

function buildHtml(d: BnReceiptData): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  wrap.innerHTML = `
    ${copyHtml(d, "কৃষকের কপি")}
    <div style="border-top:1px dashed #111;margin:8px 22px;"></div>
    ${copyHtml(d, "অফিস কপি")}
  `;
  document.body.appendChild(wrap);
  return wrap;
}

export async function downloadBnReceiptPdf(data: BnReceiptData): Promise<void> {
  const node = buildHtml(data);
  try {
    // Wait a tick so images can start loading
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const finalH = Math.min(imgH, pageH);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, finalH);
    pdf.save(`${data.farmer.name.replace(/\s+/g, "_")}_${data.receipt_no}_${data.kind}_receipt.pdf`);
  } finally {
    node.remove();
  }
}

export async function previewBnReceiptPdf(data: BnReceiptData): Promise<string> {
  const node = buildHtml(data);
  try {
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, imgH);
    return pdf.output("datauristring");
  } finally {
    node.remove();
  }
}
