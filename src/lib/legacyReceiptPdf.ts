// Legacy irrigation receipt PDF — generates a printable সেচ চার্জ ও বিবিধ আদায় রশিদ
// for one or more legacy irrigation records. Rendered via html2canvas so Bengali text is crisp.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { loadBranding } from "@/lib/branding";
import { computeReceiptFit, getPaperPreset, PAGE_MARGIN_MM } from "@/lib/legacyReceiptLayout";
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

// Bengali numeral conversion + amount-in-words (টাকা).
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBn = (v: unknown) => String(v ?? "").replace(/[0-9]/g, (d) => BN_DIGITS[+d]);

const ONES = ["", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়", "দশ",
  "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোল", "সতেরো", "আঠারো", "উনিশ", "বিশ",
  "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ", "ত্রিশ",
  "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ", "চল্লিশ",
  "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ", "পঞ্চাশ",
  "একান্ন", "বায়ান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট", "ষাট",
  "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর", "সত্তর",
  "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি", "আশি",
  "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই", "নব্বই",
  "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই"];

function numToWordsBn(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "শূন্য";
  const parts: string[] = [];
  const units: [number, string][] = [[10000000, "কোটি"], [100000, "লক্ষ"], [1000, "হাজার"], [100, "শত"]];
  for (const [div, name] of units) {
    if (n >= div) {
      const q = Math.floor(n / div);
      parts.push(`${ONES[q] ?? numToWordsBn(q)} ${name}`);
      n %= div;
    }
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}
const amountWords = (n?: number | null) =>
  n == null ? "—" : `${numToWordsBn(n)} টাকা মাত্র।`;

async function receiptHtml(r: LegacyIrrigationRecord, company: string, qr: string, logoUrl?: string | null, editorSigUrl?: string | null): Promise<string> {
  const cell = (k: string, v: string) =>
    `<tr>
       <td style="padding:10px 8px;border:1px solid #333;font-weight:600;width:48%;vertical-align:top;">${k}</td>
       <td style="padding:10px 8px;border:1px solid #333;font-weight:600;vertical-align:top;">: ${v}</td>
     </tr>`;
  const brandBlock = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" style="max-width:170px;max-height:70px;object-fit:contain;display:block;" />`
    : `<div style="font-size:15px;font-weight:700;max-width:180px;">${company}</div>`;
  const farmerLine = `${val(r.farmer_name)}${r.legacy_farmer_code ? `-${toBn(r.legacy_farmer_code)}` : ""}` +
    `${r.owner_type_name ? `/${r.owner_type_name}` : ""}${r.owner_fid ? `-${toBn(r.owner_fid)}` : ""}`;
  const paid = r.paid_amount ?? 0;
  const leftRows = [
    cell("কৃষকের নাম ও আইডি/মালিকের নাম ও আইডি", farmerLine),
    cell("পিতার/স্বামীর নাম:", val(r.father_name)),
    cell("গ্রাম/মহল্লা/মোবাইল নং:", `${val(r.village)}/${val(r.mobile_no)}`),
    cell("কৃষক এবং মালিক সভা সদস্য:", `${toBn(val(r.legacy_farmer_code))}/${toBn(val(r.owner_fid))}`),
    cell("মৌজা:", val(r.mouza_name)),
    cell("জমির ধরন/ চার্জ রেট (একর/বিঘা):", val(r.owner_type_name)),
    cell("দাগ নং:", toBn(val(r.dag_no))),
  ].join("");
  const rightRows = [
    cell("জমির পরিমাণ:", `${toBn(val(r.land_shatak))} শতক`),
    cell("চার্জের পরিমাণ (হাল)/জরিমানা:", `${toBn(val(r.rate))}`),
    cell("চার্জের পরিমাণ (বকেয়া)/জরিমানা:", `${toBn(val(r.due_amount))}`),
    cell("মোট আদায়ের পরিমাণ:", `${toBn(String(paid))} টাকা`),
    cell("কথায়:", amountWords(paid)),
    cell("হোল্ডিং এর বিবরন/পাটুয়ারীর নাম ও মোবা নং:", val(r.receipt_no)),
  ].join("");
  const tableStyle = "width:50%;border-collapse:collapse;font-size:13px;border:1px solid #333;vertical-align:top;";
  return `
  <div style="width:1040px;padding:22px 30px;font-family:'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif;color:#111;background:#fff;border:2px solid #111;border-radius:6px;box-sizing:border-box;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div style="max-width:200px;">${brandBlock}</div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:22px;font-weight:700;text-decoration:underline;">সেচ চার্জ ও বিবিধ আদায় রশিদ</div>
      </div>
      <div style="text-align:center;width:80px;">
        <img src="${qr}" style="width:64px;height:64px;display:block;margin:0 auto;" />
        <div style="font-size:10px;color:#333;margin-top:2px;">যাচাই করুন</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;font-size:13px;">
      <div>
        <div style="font-weight:600;">রশিদ নং: ${toBn(val(r.receipt_no))}</div>
        <div style="font-weight:600;margin-top:4px;">আদায়ের তথ্য: ${val(r.season_year)}</div>
      </div>
      <div style="font-weight:600;">সংগৃহীত তারিখ: ${toBn(fmtDate(r.collection_date))} ইং</div>
    </div>
    <div style="display:flex;gap:14px;margin-top:10px;align-items:flex-start;">
      <table style="${tableStyle}">${leftRows}</table>
      <table style="${tableStyle}">${rightRows}</table>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:44px;font-size:12px;">
      <div style="text-align:center;width:44%;">
        <div style="border-top:1px solid #111;padding-top:4px;">সদস্যের স্বাক্ষর / প্রদানকারীর স্বাক্ষর</div>
      </div>
      <div style="text-align:center;width:44%;">
        <div style="border-top:1px solid #111;padding-top:4px;">আদায়কারীর স্বাক্ষর</div>
      </div>
    </div>
  </div>`;
}

const slug = (s: unknown) =>
  String(s ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "farmer";

/** Build the same-origin verification URL a QR code should resolve to. */
export function legacyVerifyUrl(r: LegacyIrrigationRecord): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = r.receipt_no
    ? `legacy-${r.receipt_no}`
    : `legacy-${r.legacy_farmer_code ?? ""}-${r.collection_date ?? ""}`;
  return `${origin}/verify/${encodeURIComponent(token)}`;
}

async function makeQr(r: LegacyIrrigationRecord): Promise<string> {
  try {
    return await QRCode.toDataURL(legacyVerifyUrl(r), { margin: 0, width: 128 });
  } catch {
    return "";
  }
}

export async function downloadLegacyReceipts(
  records: LegacyIrrigationRecord[],
  onProgress?: (done: number, total: number) => void,
  paperId?: string,
) {
  if (!records.length) return;
  const branding = await loadBranding().catch(() => null);
  const company = branding?.company_name_bn || branding?.company_name || "সেচ রশিদ";
  const logoUrl = branding?.logo_url || null;

  const paper = getPaperPreset(paperId);
  const pdf = new jsPDF({ unit: "mm", format: paper.format, orientation: paper.orientation });

  for (let i = 0; i < records.length; i++) {
    const qr = await makeQr(records[i]);
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.innerHTML = await receiptHtml(records[i], company, qr, logoUrl);
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder.firstElementChild as HTMLElement, { scale: 2, backgroundColor: "#fff", useCORS: true });
      const img = canvas.toDataURL("image/png");
      // Shared aspect-preserving fit — identical rule used by the on-screen preview.
      const { imgW, imgH, x, y } = computeReceiptFit(paper, canvas.width, canvas.height, PAGE_MARGIN_MM);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "PNG", x, y, imgW, imgH);
    } finally {
      document.body.removeChild(holder);
    }
    onProgress?.(i + 1, records.length);
  }


  const first = records[0];
  const today = new Date().toISOString().slice(0, 10);
  // Consistent naming: farmer name + receipt no + date for both single & bulk.
  const name = records.length === 1
    ? `sech-receipt-${slug(first.farmer_name)}-${slug(first.receipt_no ?? "no-receipt")}-${fmtDate(first.collection_date)}.pdf`
    : `sech-receipts-${slug(first.farmer_name)}-${records.length}-${today}.pdf`;
  pdf.save(name);
}

/** Build preview HTML (for a verification modal) for the given records. */
export async function buildLegacyReceiptPreview(records: LegacyIrrigationRecord[]): Promise<string> {
  const branding = await loadBranding().catch(() => null);
  const company = branding?.company_name_bn || branding?.company_name || "সেচ রশিদ";
  const logoUrl = branding?.logo_url || null;
  const parts = await Promise.all(
    records.map(async (r) => receiptHtml(r, company, await makeQr(r), logoUrl)),
  );
  return parts.join('<div style="height:16px;"></div>');
}
