/**
 * Lump-sum ("একবারে পরিশোধ — মেয়াদ শেষে") loan repayment receipt export.
 * Produces an A5 landscape PDF (bilingual labels) and an Excel sheet so the
 * receipt amounts (principal, interest, discount, net) stay consistent across
 * formats. Discount/waiver is shown as a separate line and subtracted from the
 * gross to compute the net paid amount.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { ensureBanglaFont } from "@/lib/pdfFonts";

export type LumpSumReceiptData = {
  receipt_no: string;
  paid_on: string;
  farmer_name: string;
  member_no?: string | null;
  loan_no?: string | null;
  principal_amount: number;
  interest_amount: number;
  discount_amount: number; // interest waiver applied by admin
  company_name?: string | null;
  company_name_bn?: string | null;
  office_name?: string | null;
  collected_by_name?: string | null;
};

const fmt = (n: number) => `৳${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

export function lumpSumNet(d: Pick<LumpSumReceiptData, "principal_amount" | "interest_amount" | "discount_amount">): number {
  const gross = Number(d.principal_amount || 0) + Number(d.interest_amount || 0);
  return Math.max(0, gross - Number(d.discount_amount || 0));
}

/** Bilingual label rows used by both PDF and Excel exports. */
function rows(d: LumpSumReceiptData): [string, string][] {
  return [
    ["Receipt No / রশিদ নং", d.receipt_no],
    ["Date / তারিখ", d.paid_on],
    ["Member / সদস্য", d.farmer_name],
    ["Member No / সদস্য নং", d.member_no ?? "-"],
    ["Loan No / ঋণ নং", d.loan_no ?? "-"],
    ["Principal / আসল", fmt(d.principal_amount)],
    ["Interest / লাভ", fmt(d.interest_amount)],
    ["Discount (waiver) / ছাড়", fmt(d.discount_amount)],
    ["Net Paid / নিট পরিশোধ", fmt(lumpSumNet(d))],
  ];
}

export async function exportLumpSumReceiptPdf(d: LumpSumReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" });
  const family = await ensureBanglaFont(doc);
  const setBn = () => { if (family) doc.setFont(family, "normal"); };

  setBn();
  doc.setFontSize(13);
  const title = d.company_name_bn || d.company_name || "Loan Repayment Receipt";
  doc.text(title, 12, 14);
  doc.setFontSize(10);
  doc.text("একবারে পরিশোধ ঋণ আদায় রশিদ / Lump-sum Loan Repayment Receipt", 12, 21);

  autoTable(doc, {
    startY: 26,
    margin: { left: 12, right: 12 },
    styles: { font: family || undefined, fontSize: 10, cellPadding: 2 },
    head: [["বিবরণ / Detail", "মান / Value"]],
    body: rows(d),
    theme: "grid",
  });

  const endY = (doc as any).lastAutoTable?.finalY ?? 100;
  setBn();
  doc.setFontSize(9);
  if (d.office_name) doc.text(`অফিস / Office: ${d.office_name}`, 12, endY + 8);
  if (d.collected_by_name) doc.text(`আদায়কারী / Collected by: ${d.collected_by_name}`, 12, endY + 14);
  return doc;
}

export async function downloadLumpSumReceiptPdf(d: LumpSumReceiptData): Promise<void> {
  const doc = await exportLumpSumReceiptPdf(d);
  doc.save(`lumpsum-receipt-${d.receipt_no || "loan"}.pdf`);
}

export function exportLumpSumReceiptExcel(d: LumpSumReceiptData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const aoa = [["বিবরণ / Detail", "মান / Value"], ...rows(d)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Receipt");
  return wb;
}

export function downloadLumpSumReceiptExcel(d: LumpSumReceiptData): void {
  const wb = exportLumpSumReceiptExcel(d);
  XLSX.writeFile(wb, `lumpsum-receipt-${d.receipt_no || "loan"}.xlsx`);
}
