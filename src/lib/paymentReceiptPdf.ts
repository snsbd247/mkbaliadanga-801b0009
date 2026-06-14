import { jsPDF } from "jspdf";
import { getDefaultPaperSize } from "@/lib/receiptLayoutSettings";

export interface PaymentReceiptData {
  receipt_no: string;
  payment_id: string;
  paid_at: string | Date;
  farmer_name: string;
  farmer_code?: string | null;
  member_no?: string | null;
  mobile_masked?: string | null;
  village?: string | null;
  token_masked: string;
  token_status: "active" | "revoked" | "expiring";
  kind: string;
  amount: number;
  method: string;
  /** Optional breakdown for irrigation/dues receipts: current (hal) vs arrears (bokeya). */
  hal_amount?: number | null;
  bokeya_amount?: number | null;
  penalty_amount?: number | null;
  note?: string | null;
  collected_by_name?: string | null;
  office_name?: string | null;
  idempotency_key: string;
  company_name: string;
  company_name_bn?: string | null;
}

export interface ReceiptTemplate {
  language: "en" | "bn" | "both";
  paper_size: "a4" | "a5" | "a6";
  accent_color: string; // hex
  show_logo: boolean;
  show_signature_line: boolean;
  show_office: boolean;
  show_token_block: boolean;
  header_alignment: "left" | "center" | "right";
  footer_note: string;
  footer_note_bn: string;
  logo_url?: string | null;
  show_watermark: boolean;
  watermark_text: string;
  show_penalty_row: boolean;
  show_charge_row: boolean;
  qr_placement: "left" | "center" | "right" | "none";
}

export const DEFAULT_TEMPLATE: ReceiptTemplate = {
  language: "en",
  paper_size: "a5",
  accent_color: "#1f4e79",
  show_logo: true,
  show_signature_line: true,
  show_office: true,
  show_token_block: true,
  header_alignment: "center",
  footer_note: "This is a system-generated receipt. Please retain for your records.",
  footer_note_bn: "এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।",
  show_watermark: false,
  watermark_text: "",
  show_penalty_row: true,
  show_charge_row: true,
  qr_placement: "right",
};

const fmtBdt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return [31, 78, 121];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// English / Bangla label pairs. jsPDF cannot embed Bangla glyphs, so when language
// includes Bangla, the BN string is shown beneath the EN one in italic for guidance.
const L = {
  en: {
    title: "PAYMENT RECEIPT",
    receipt: "Receipt No",
    date: "Date",
    office: "Office",
    farmer: "Farmer",
    name: "Name", code: "Code", member: "Farmer ID", village: "Village", mobile: "Mobile",
    qr: "QR Card", token: "Token", status: "Status",
    type: "Type", method: "Method", amount: "Amount (BDT)",
    hal: "Current (Hal)", bokeya: "Arrears (Bokeya)", penalty: "Penalty",
    note: "Note",
    paymentId: "Payment ID", idem: "Idempotency", collected: "Collected by",
    signature: "Authorised signature",
  },
  bn: {
    title: "পেমেন্ট রসিদ",
    receipt: "রসিদ নং",
    date: "তারিখ",
    office: "অফিস",
    farmer: "কৃষক",
    name: "নাম", code: "কোড", member: "ফার্মার আইডি", village: "গ্রাম", mobile: "মোবাইল",
    qr: "কিউআর কার্ড", token: "টোকেন", status: "অবস্থা",
    type: "ধরন", method: "পদ্ধতি", amount: "টাকা (BDT)",
    hal: "হাল", bokeya: "বকেয়া", penalty: "জরিমানা",
    note: "মন্তব্য",
    paymentId: "পেমেন্ট আইডি", idem: "ইডেমপোটেন্সি", collected: "গ্রহীতা",
    signature: "অনুমোদিত স্বাক্ষর",
  },
};

function pickLabels(_lang: ReceiptTemplate["language"]) {
  // jsPDF's built-in fonts don't support Bangla glyphs, so PDFs always render
  // English labels. The on-screen UI continues to honour the language toggle.
  return L.en;
}

function paperFormat(size: ReceiptTemplate["paper_size"]) {
  return size; // jsPDF accepts 'a4' | 'a5' | 'a6'
}

function buildPaymentReceiptDoc(data: PaymentReceiptData, tplIn?: Partial<ReceiptTemplate>): jsPDF {
  // Honour the global A4/A5 toggle unless the caller explicitly overrides paper_size.
  const tpl: ReceiptTemplate = { ...DEFAULT_TEMPLATE, paper_size: getDefaultPaperSize(), ...(tplIn ?? {}) };
  const doc = new jsPDF({ unit: "mm", format: paperFormat(tpl.paper_size) });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = tpl.paper_size === "a6" ? 8 : 12;
  const accent = hexToRgb(tpl.accent_color);

  // Optional diagonal watermark (drawn first so content sits on top).
  if (tpl.show_watermark && tpl.watermark_text.trim()) {
    doc.saveGraphicsState();
    // @ts-ignore - GState is available at runtime in jsPDF
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setTextColor(120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tpl.paper_size === "a6" ? 28 : 48);
    doc.text(tpl.watermark_text.trim(), pageW / 2, pageH / 2, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
    doc.setTextColor(0);
  }
  // Bangla cannot be embedded in jsPDF's built-in fonts, so we never render
  // BN strings in the PDF — the "both" mode falls back to English-only.
  const showBoth = false;
  const labels = pickLabels(tpl.language);
  const labelsBn = L.en;

  const align = tpl.header_alignment;
  const headerX = align === "left" ? margin : align === "right" ? pageW - margin : pageW / 2;

  // Optional logo (top-left). Logos are rendered only if the URL is a same-origin
  // image (data: URI). Cross-origin URLs are skipped to avoid CORS taint issues.
  let headerTopOffset = 0;
  if (tpl.show_logo && tpl.logo_url && tpl.logo_url.startsWith("data:image")) {
    try {
      doc.addImage(tpl.logo_url, "PNG", margin, margin, 14, 14);
      headerTopOffset = align === "left" ? 16 : 0;
    } catch { /* ignore */ }
  }

  // Header / company name
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tpl.paper_size === "a6" ? 12 : 14);
  doc.text(data.company_name, headerX + headerTopOffset, margin + 4, { align });
  let cursorY = margin + 4;
  if (showBoth && data.company_name_bn) {
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text(data.company_name_bn, headerX + headerTopOffset, margin + 9, { align });
    cursorY = margin + 9;
  }
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(labels.title, pageW / 2, cursorY + 7, { align: "center" });
  if (showBoth) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text(labelsBn.title, pageW / 2, cursorY + 12, { align: "center" });
    cursorY += 5;
  }

  // Accent rule
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY + 10, pageW - margin, cursorY + 10);
  doc.setLineWidth(0.2);
  doc.setDrawColor(180);

  // Meta block
  let y = cursorY + 16;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const date = new Date(data.paid_at);
  doc.text(`${labels.receipt}: ${data.receipt_no}`, margin, y);
  doc.text(`${labels.date}: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, pageW - margin, y, { align: "right" });
  y += 5;
  if (tpl.show_office && data.office_name) { doc.text(`${labels.office}: ${data.office_name}`, margin, y); y += 5; }

  // Farmer block
  y += 2;
  doc.setFont("helvetica", "bold"); doc.text(labels.farmer, margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  const farmerLines: string[] = [];
  farmerLines.push(`${labels.name}: ${data.farmer_name}`);
  if (data.farmer_code) farmerLines.push(`${labels.code}: ${data.farmer_code}`);
  if (data.member_no) farmerLines.push(`${labels.member}: ${data.member_no}`);
  if (data.village) farmerLines.push(`${labels.village}: ${data.village}`);
  if (data.mobile_masked) farmerLines.push(`${labels.mobile}: ${data.mobile_masked}`);
  for (const line of farmerLines) { doc.text(line, margin, y); y += 4; }

  // Token / QR block — placement configurable (left/center/right) or hidden.
  if (tpl.show_token_block && tpl.qr_placement !== "none") {
    const qrAlign = tpl.qr_placement;
    const qrX = qrAlign === "left" ? margin : qrAlign === "right" ? pageW - margin : pageW / 2;
    y += 2;
    doc.setFont("helvetica", "bold"); doc.text(labels.qr, qrX, y, { align: qrAlign }); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`${labels.token}: ${data.token_masked}`, qrX, y, { align: qrAlign }); y += 4;
    doc.text(`${labels.status}: ${data.token_status.toUpperCase()}`, qrX, y, { align: qrAlign });
    y += 6;
  }

  // Payment table
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, pageW - 2 * margin, 26);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.text(labels.type, margin + 2, y + 5);
  doc.text(labels.method, margin + 50, y + 5);
  doc.text(labels.amount, pageW - margin - 2, y + 5, { align: "right" });
  doc.line(margin, y + 7, pageW - margin, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(data.kind, margin + 2, y + 13);
  doc.text(data.method, margin + 50, y + 13);
  doc.setFont("helvetica", "bold");
  doc.text(fmtBdt(data.amount), pageW - margin - 2, y + 13, { align: "right" });
  if (data.note) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    const lines = doc.splitTextToSize(`${labels.note}: ${data.note}`, pageW - 2 * margin - 4);
    doc.text(lines.slice(0, 2), margin + 2, y + 20);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
  }
  y += 32;

  // Optional hal/bokeya/penalty breakdown (irrigation & dues receipts)
  const showCharge = tpl.show_charge_row;
  const showPenalty = tpl.show_penalty_row;
  const hasBreakdown =
    (showCharge && ((data.hal_amount != null) || (data.bokeya_amount != null))) ||
    (showPenalty && (data.penalty_amount != null));
  if (hasBreakdown) {
    doc.setFontSize(8); doc.setTextColor(60); doc.setFont("helvetica", "normal");
    if (showCharge && data.hal_amount != null) {
      doc.text(`${labels.hal}: ${fmtBdt(data.hal_amount)}`, margin, y); y += 4;
    }
    if (showCharge && data.bokeya_amount != null) {
      doc.text(`${labels.bokeya}: ${fmtBdt(data.bokeya_amount)}`, margin, y); y += 4;
    }
    if (showPenalty && data.penalty_amount != null) {
      doc.text(`${labels.penalty}: ${fmtBdt(data.penalty_amount)}`, margin, y); y += 4;
    }
    doc.setTextColor(0); y += 2;
  }



  // Footer references
  doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`${labels.paymentId}: ${data.payment_id}`, margin, y); y += 4;
  doc.text(`${labels.idem}: ${data.idempotency_key.slice(0, 24)}…`, margin, y); y += 4;
  if (data.collected_by_name) { doc.text(`${labels.collected}: ${data.collected_by_name}`, margin, y); y += 4; }

  // Signature line
  if (tpl.show_signature_line) {
    const sigY = Math.min(y + 14, pageH - margin - 14);
    doc.setDrawColor(120);
    doc.line(pageW - margin - 50, sigY, pageW - margin, sigY);
    doc.setFontSize(8); doc.setTextColor(110);
    doc.text(labels.signature, pageW - margin - 25, sigY + 4, { align: "center" });
  }

  // Footer note
  doc.setTextColor(0);
  doc.setFontSize(7);
  const footer = tpl.footer_note;
  doc.text(footer, pageW / 2, pageH - margin, { align: "center" });
  return doc;
}

export function downloadPaymentReceiptPdf(data: PaymentReceiptData, tpl?: Partial<ReceiptTemplate>) {
  const doc = buildPaymentReceiptDoc(data, tpl);
  doc.save(`receipt-${data.receipt_no}.pdf`);
}

export function previewPaymentReceiptPdf(data: PaymentReceiptData, tpl?: Partial<ReceiptTemplate>): string {
  const doc = buildPaymentReceiptDoc(data, tpl);
  // Chrome blocks navigating iframes to data: URLs ("This page has been blocked
  // by Chrome"), so emit a same-origin blob: URL instead.
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

export function maskToken(token: string): string {
  if (!token) return "—";
  if (token.length <= 8) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
