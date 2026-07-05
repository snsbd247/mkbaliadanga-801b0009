// Legacy irrigation receipt PDF — generates a printable সেচ চার্জ ও বিবিধ আদায় রশিদ
// for one or more legacy irrigation records. Rendered via html2canvas so Bengali text is crisp.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
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

async function receiptHtml(r: LegacyIrrigationRecord, company: string, qr: string): Promise<string> {
  const row = (k: string, v: string) =>
    `<tr>
       <td style="padding:6px 10px;border:1px solid #333;font-weight:600;width:52%;vertical-align:top;">${k}</td>
       <td style="padding:6px 10px;border:1px solid #333;font-weight:600;vertical-align:top;">: ${v}</td>
     </tr>`;
  const farmerLine = `${val(r.farmer_name)}${r.legacy_farmer_code ? `-${toBn(r.legacy_farmer_code)}` : ""}` +
    `${r.owner_type_name ? `/${r.owner_type_name}` : ""}${r.owner_fid ? `-${toBn(r.owner_fid)}` : ""}`;
  const paid = r.paid_amount ?? 0;
  return `
  <div style="width:720px;padding:22px 26px;font-family:'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif;color:#111;background:#fff;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div style="font-size:15px;font-weight:700;max-width:180px;">${company}</div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:20px;font-weight:700;text-decoration:underline;">সেচ চার্জ ও বিবিধ আদায় রশিদ</div>
      </div>
      <div style="text-align:center;width:80px;">
        <img src="${qr}" style="width:64px;height:64px;display:block;margin:0 auto;" />
        <div style="font-size:10px;color:#333;margin-top:2px;">যাচাই করুন</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;font-size:13px;">
      <div>
        <div style="font-weight:600;">রশিদ নং: ${toBn(val(r.receipt_no))}</div>
        <div style="font-weight:600;margin-top:4px;">আদায়ের তথ্য: ${val(r.season_year)}</div>
      </div>
      <div style="font-weight:600;">সংগৃহীত তারিখ: ${toBn(fmtDate(r.collection_date))} ইং</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;">
      ${row("কৃষকের নাম ও আইডি/মালিকের নাম ও আইডি", farmerLine)}
      ${row("পিতার/স্বামীর নাম:", val(r.father_name))}
      ${row("গ্রাম/মহল্লা/মোবাইল নং:", `${val(r.village)}/${val(r.mobile_no)}`)}
      ${row("কৃষক এবং মালিক সভা সদস্য:", `${toBn(val(r.legacy_farmer_code))}/${toBn(val(r.owner_fid))}`)}
      ${row("মৌজা:", val(r.mouza_name))}
      ${row("জমির ধরন/ চার্জ রেট (একর/বিঘা):", val(r.owner_type_name))}
      ${row("দাগ নং:", toBn(val(r.dag_no)))}
      ${row("জমির পরিমাণ:", `${toBn(val(r.land_shatak))} শতক`)}
      ${row("চার্জের পরিমাণ (হাল)/জরিমানা:", `${toBn(val(r.rate))}`)}
      ${row("চার্জের পরিমাণ (বকেয়া)/জরিমানা:", `${toBn(val(r.due_amount))}`)}
      ${row("মোট আদায়ের পরিমাণ:", toBn(String(paid)))}
      ${row("কথায়:", amountWords(paid))}
      ${row("হোল্ডিং এর বিবরন/পাটুয়ারীর নাম ও মোবা নং:", val(r.receipt_no))}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:44px;font-size:12px;">
      <div style="text-align:center;">________________________<br/>সদস্যের স্বাক্ষর/প্রদানকারীর স্বাক্ষর</div>
      <div style="text-align:center;">________________________<br/>আদায়কারীর স্বাক্ষর</div>
    </div>
  </div>`;
}

const slug = (s: unknown) =>
  String(s ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "farmer";

async function makeQr(r: LegacyIrrigationRecord): Promise<string> {
  const payload = r.receipt_no ? String(r.receipt_no) : `${r.legacy_farmer_code ?? ""}-${r.collection_date ?? ""}`;
  try {
    return await QRCode.toDataURL(payload, { margin: 0, width: 128 });
  } catch {
    return "";
  }
}

export async function downloadLegacyReceipts(
  records: LegacyIrrigationRecord[],
  onProgress?: (done: number, total: number) => void,
) {
  if (!records.length) return;
  const branding = await loadBranding().catch(() => null);
  const company = branding?.company_name_bn || branding?.company_name || "সেচ রশিদ";

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();

  for (let i = 0; i < records.length; i++) {
    const qr = await makeQr(records[i]);
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.innerHTML = await receiptHtml(records[i], company, qr);
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

/** Build preview HTML (for a verification modal) for the given records. */
export async function buildLegacyReceiptPreview(records: LegacyIrrigationRecord[]): Promise<string> {
  const branding = await loadBranding().catch(() => null);
  const company = branding?.company_name_bn || branding?.company_name || "সেচ রশিদ";
  const parts = await Promise.all(
    records.map(async (r) => receiptHtml(r, company, await makeQr(r))),
  );
  return parts.join('<div style="height:16px;"></div>');
}
