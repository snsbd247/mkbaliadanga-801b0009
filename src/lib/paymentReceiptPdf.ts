import { jsPDF } from "jspdf";

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
  note?: string | null;
  collected_by_name?: string | null;
  office_name?: string | null;
  idempotency_key: string;
  company_name: string;
  company_name_bn?: string | null;
}

const fmtBdt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export function downloadPaymentReceiptPdf(data: PaymentReceiptData) {
  // A5 portrait — receipt-friendly size.
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.company_name, pageW / 2, margin + 4, { align: "center" });
  if (data.company_name_bn) {
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    // jsPDF cannot embed Bangla without custom font; fall back to ASCII representation
    doc.text(data.company_name_bn, pageW / 2, margin + 9, { align: "center" });
  }
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", pageW / 2, margin + 16, { align: "center" });

  doc.setDrawColor(180);
  doc.line(margin, margin + 19, pageW - margin, margin + 19);

  // Meta block
  let y = margin + 25;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const date = new Date(data.paid_at);
  doc.text(`Receipt No: ${data.receipt_no}`, margin, y);
  doc.text(`Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, pageW - margin, y, { align: "right" });
  y += 5;
  if (data.office_name) { doc.text(`Office: ${data.office_name}`, margin, y); y += 5; }

  // Farmer block
  y += 3;
  doc.setFont("helvetica", "bold"); doc.text("Farmer", margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${data.farmer_name}`, margin, y); y += 4;
  if (data.farmer_code) { doc.text(`Code: ${data.farmer_code}`, margin, y); y += 4; }
  if (data.member_no) { doc.text(`Member No: ${data.member_no}`, margin, y); y += 4; }
  if (data.village) { doc.text(`Village: ${data.village}`, margin, y); y += 4; }
  if (data.mobile_masked) { doc.text(`Mobile: ${data.mobile_masked}`, margin, y); y += 4; }

  // Token block
  y += 3;
  doc.setFont("helvetica", "bold"); doc.text("QR Card", margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Token: ${data.token_masked}`, margin, y);
  doc.text(`Status: ${data.token_status.toUpperCase()}`, pageW - margin, y, { align: "right" });
  y += 6;

  // Payment table
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, pageW - 2 * margin, 26);
  doc.setFont("helvetica", "bold");
  doc.text("Type", margin + 2, y + 5);
  doc.text("Method", margin + 50, y + 5);
  doc.text("Amount (BDT)", pageW - margin - 2, y + 5, { align: "right" });
  doc.line(margin, y + 7, pageW - margin, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(data.kind, margin + 2, y + 13);
  doc.text(data.method, margin + 50, y + 13);
  doc.setFont("helvetica", "bold");
  doc.text(fmtBdt(data.amount), pageW - margin - 2, y + 13, { align: "right" });
  if (data.note) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    const lines = doc.splitTextToSize(`Note: ${data.note}`, pageW - 2 * margin - 4);
    doc.text(lines.slice(0, 2), margin + 2, y + 20);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
  }
  y += 32;

  // Footer references
  doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`Payment ID: ${data.payment_id}`, margin, y); y += 4;
  doc.text(`Idempotency: ${data.idempotency_key.slice(0, 24)}…`, margin, y); y += 4;
  if (data.collected_by_name) { doc.text(`Collected by: ${data.collected_by_name}`, margin, y); y += 4; }

  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.text(
    "This is a system-generated receipt. Please retain for your records.",
    pageW / 2, pageH - margin, { align: "center" },
  );

  doc.save(`receipt-${data.receipt_no}.pdf`);
}

export function maskToken(token: string): string {
  if (!token) return "—";
  if (token.length <= 8) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
