import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { money, fmtDate } from "./format";

export function exportFarmerReportPDF(farmer: any, ctx: any) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Farmer Full Report", 14, 16);
  doc.setFontSize(10);
  doc.text(`Farmer ID: ${farmer.farmer_code}`, 14, 24);
  doc.text(`Name: ${farmer.name_en}`, 14, 30);
  doc.text(`Mobile: ${farmer.mobile ?? "-"}    NID: ${farmer.nid ?? "-"}`, 14, 36);
  doc.text(`Address: ${[farmer.village, farmer.upazila, farmer.district].filter(Boolean).join(", ")}`, 14, 42);

  autoTable(doc, {
    startY: 48, head: [["Summary", "Amount"]],
    body: [
      ["Savings Balance", money(ctx.savingsBal)],
      ["Share Balance", money(ctx.share)],
      ["Loan Due", money(ctx.loanDue)],
      ["Irrigation Due", money(ctx.irrDue)],
    ],
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.text("Lands", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Mouza", "Dag No", "Size", "Owner", "Field"]],
    body: ctx.lands.map((l: any) => [l.mouza, l.dag_no, l.land_size, l.owner_type, l.field_type]),
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  doc.text("Irrigation Charges", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Date", "Season", "Total", "Paid", "Due"]],
    body: ctx.irr.map((i: any) => [fmtDate(i.entry_date), i.seasons?.name ?? "-", money(i.total), money(i.paid_amount), money(i.due_amount)]),
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  doc.text("Loans", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Issued", "Principal", "Rate %", "Payable", "Status"]],
    body: ctx.loans.map((l: any) => [fmtDate(l.issued_on), money(l.principal), l.interest_rate, money(l.total_payable), l.status]),
  });

  doc.save(`farmer-${farmer.farmer_code}.pdf`);
}

export function exportTablePDF(title: string, head: string[], rows: any[][]) {
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text(title, 14, 14);
  autoTable(doc, { startY: 20, head: [head], body: rows });
  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportExcel(filename: string, sheetName: string, rows: any[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
