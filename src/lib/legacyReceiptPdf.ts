// Legacy irrigation receipt PDF — generates a printable সেচ রশিদ for one or more
// legacy irrigation records. Rendered via html2canvas so Bengali text is crisp.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { loadBranding } from "@/lib/branding";
import type { LegacyIrrigationRecord } from "@/lib/api/legacyIrrigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${m[3].padStart(2, "0")}-${MONTHS[mo - 1]}-${m[1]}`;
  }
  return s;
}
const val = (v: unknown) => (v == null || v === "" ? "—" : String(v));

function receiptHtml(r: LegacyIrrigationRecord, company: string): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 8px;color:#555;white-space:nowrap;">${k}</td>
     <td style="padding:4px 8px;font-weight:600;">${v}</td></tr>`;
  return `
  <div style="width:520px;padding:24px;font-family:'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif;color:#111;border:1px solid #ccc;border-radius:8px;background:#fff;">
    <div style="text-align:center;border-bottom:2px solid #16a34a;padding-bottom:8px;margin-bottom:12px;">
      <div style="font-size:20px;font-weight:700;">${company}</div>
      <div style="font-size:14px;color:#16a34a;font-weight:600;margin-top:2px;">সেচ রশিদ (পুরনো ডাটা)</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${row("রশিদ নং", val(r.receipt_no))}
      ${row("তারিখ", fmtDate(r.collection_date))}
      ${row("কৃষকের নাম", val(r.farmer_name))}
      ${row("পিতা/স্বামী", val(r.father_name))}
      ${row("গ্রাম", val(r.village))}
      ${row("মোবাইল", val(r.mobile_no))}
      ${row("ফার্মার কোড", val(r.legacy_farmer_code))}
      ${row("মৌজা", val(r.mouza_name))}
      ${row("দাগ নং", val(r.dag_no))}
      ${row("সিজন", val(r.season_year))}
      ${row("জমি (শতক)", val(r.land_shatak))}
      ${row("রেট", val(r.rate))}
      ${row("মালিক/বর্গা", val(r.owner_type_name))}
      ${row("বকেয়া", val(r.due_amount))}
      <tr><td style="padding:8px;color:#111;font-weight:700;border-top:1px solid #ddd;">পরিশোধিত টাকা</td>
      <td style="padding:8px;font-weight:700;font-size:16px;border-top:1px solid #ddd;">৳ ${val(r.paid_amount)}</td></tr>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:12px;color:#555;">
      <div style="text-align:center;">__________________<br/>কৃষকের স্বাক্ষর</div>
      <div style="text-align:center;">__________________<br/>আদায়কারীর স্বাক্ষর</div>
    </div>
  </div>`;
}

const slug = (s: unknown) =>
  String(s ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "farmer";

export async function downloadLegacyReceipts(
  records: LegacyIrrigationRecord[],
  onProgress?: (done: number, total: number) => void,
) {
  if (!records.length) return;
  const branding = await loadBranding().catch(() => null);
  const company = branding?.company_name_bn || branding?.company_name || "সেচ রশিদ";

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();

  for (let i = 0; i < records.length; i++) {
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.innerHTML = receiptHtml(records[i], company);
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder.firstElementChild as HTMLElement, { scale: 2, backgroundColor: "#fff" });
      const img = canvas.toDataURL("image/png");
      const imgW = pageW - 20;
      const imgH = (canvas.height / canvas.width) * imgW;
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "PNG", 10, 12, imgW, imgH);
    } finally {
      document.body.removeChild(holder);
    }
    onProgress?.(i + 1, records.length);
  }

  const first = records[0];
  const name = records.length === 1
    ? `sech-receipt-${slug(first.farmer_name)}-${first.receipt_no ?? fmtDate(first.collection_date)}.pdf`
    : `sech-receipts-${slug(first.farmer_name)}-${records.length}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(name);
}
