// Legacy irrigation receipt PDF — generates a printable সেচ চার্জ ও বিবিধ আদায় রশিদ
// for one or more legacy irrigation records. Rendered via html2canvas so Bengali text is crisp.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { loadBranding } from "@/lib/branding";
import { computeReceiptFit, getPaperPreset, PAGE_MARGIN_MM } from "@/lib/legacyReceiptLayout";
import type { LegacyIrrigationRecord } from "@/lib/api/legacyIrrigation";
import { buildOfficialIrrigationReceiptHtml, type BnReceiptData } from "@/lib/bnReceipts";

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



/**
 * Map a legacy irrigation record into the shared BnReceiptData shape so the SAME
 * official receipt template renders both live and legacy receipts (no divergence).
 */
export function mapLegacyToReceiptData(
  r: LegacyIrrigationRecord,
  branding: { company_name_bn?: string | null; company_name?: string | null; logo_url?: string | null; editor_signature_url?: string | null } | null,
): BnReceiptData {
  const hal = r.rate ?? 0;
  const due = r.due_amount ?? 0;
  const paid = r.paid_amount ?? 0;
  return {
    kind: "irrigation",
    receipt_no: String(r.receipt_no ?? ""),
    receipt_no_display: r.receipt_no ? String(r.receipt_no) : null,
    date: r.collection_date ?? new Date().toISOString().slice(0, 10),
    bill_info: r.season_year ?? undefined,
    company_name_bn: branding?.company_name_bn ?? null,
    company_name: branding?.company_name ?? undefined,
    logo_url: branding?.logo_url ?? null,
    owner_self: true,
    farmer: {
      name: r.farmer_name ?? "—",
      member_no: r.legacy_farmer_code ?? null,
      father_or_husband: r.father_name ?? null,
      village: r.village ?? null,
      mobile: r.mobile_no ?? null,
      mouza: r.mouza_name ?? null,
      field_type_bn: r.owner_type_name ?? null,
      land_size: r.land_shatak ?? null,
      dag_no: r.dag_no ?? null,
    },
    rate: r.rate ?? null,
    member_summary: `${r.legacy_farmer_code ?? "N/A"}/${r.owner_fid ?? "N/A"}`,
    current_season_charge: hal,
    total_outstanding: due,
    collected_amount: paid,
    collector_signature_url: branding?.editor_signature_url ?? null,
    verify_url: legacyVerifyUrl(r),
  };
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

  const paper = getPaperPreset(paperId);
  const pdf = new jsPDF({ unit: "mm", format: paper.format, orientation: paper.orientation });

  for (let i = 0; i < records.length; i++) {
    const qr = await makeQr(records[i]);
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.style.width = "1040px";
    holder.style.background = "#fff";
    holder.innerHTML = buildOfficialIrrigationReceiptHtml(mapLegacyToReceiptData(records[i], branding), qr);
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
  const parts = await Promise.all(
    records.map(async (r) => buildOfficialIrrigationReceiptHtml(mapLegacyToReceiptData(r, branding), await makeQr(r))),
  );
  return parts.join('<div style="height:16px;"></div>');
}
