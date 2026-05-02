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

// ---------- Payment Receipt PDF ----------
export function exportPaymentReceiptPDF(opts: {
  brand: { company_name: string; address?: string; mobile?: string };
  receipt_no: string;
  date: string;
  farmer: { name_en: string; member_no?: string; farmer_code?: string; mobile?: string; village?: string };
  amount: number;
  method: string;
  note?: string;
  allocations: Array<{ kind: string; amount: number }>;
}) {
  const doc = new jsPDF({ unit: "mm", format: [148, 210] }); // A5
  const w = 148;
  doc.setFontSize(14); doc.setFont(undefined, "bold");
  doc.text(opts.brand.company_name, w / 2, 14, { align: "center" });
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  if (opts.brand.address) doc.text(opts.brand.address, w / 2, 19, { align: "center" });
  if (opts.brand.mobile) doc.text(`Mobile: ${opts.brand.mobile}`, w / 2, 23, { align: "center" });

  doc.setFontSize(11); doc.setFont(undefined, "bold");
  doc.text("PAYMENT RECEIPT", w / 2, 32, { align: "center" });
  doc.setLineWidth(0.3); doc.line(10, 35, w - 10, 35);

  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text(`Receipt #: ${opts.receipt_no}`, 12, 41);
  doc.text(`Date: ${fmtDate(opts.date)}`, w - 12, 41, { align: "right" });

  doc.text(`Member: ${opts.farmer.member_no ?? opts.farmer.farmer_code ?? "—"}`, 12, 47);
  doc.text(`Name: ${opts.farmer.name_en}`, 12, 52);
  if (opts.farmer.village) doc.text(`Village: ${opts.farmer.village}`, 12, 57);
  if (opts.farmer.mobile) doc.text(`Mobile: ${opts.farmer.mobile}`, w - 12, 57, { align: "right" });

  autoTable(doc, {
    startY: 62,
    head: [["Allocation", "Amount"]],
    body: opts.allocations.map(a => [a.kind.toUpperCase(), money(a.amount)]),
    foot: [["TOTAL", money(opts.amount)]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 110, 70] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    margin: { left: 12, right: 12 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.text(`Method: ${opts.method ?? "cash"}`, 12, y);
  if (opts.note) { y += 5; doc.text(`Note: ${opts.note}`, 12, y); }

  // Signature lines
  y = Math.max(y + 18, 170);
  doc.line(15, y, 60, y); doc.text("Collector", 37, y + 4, { align: "center" });
  doc.line(w - 60, y, w - 15, y); doc.text("Authorized Sig.", w - 37, y + 4, { align: "center" });

  doc.save(`receipt-${opts.receipt_no}.pdf`);
}

// ---------- Cooperative Audit-ready Report ----------
export function exportAuditReportPDF(opts: {
  brand: { company_name: string; address?: string };
  range: string;
  summary: Array<{ label: string; value: number }>;
  byOffice?: Array<{ office: string; income: number; expense: number; loanIssued: number; loanCollected: number; irrCollected: number; savBal: number }>;
  bySeason?: Array<{ season: string; charged: number; collected: number; due: number }>;
}) {
  const doc = new jsPDF();
  doc.setFontSize(16); doc.setFont(undefined, "bold");
  doc.text(opts.brand.company_name, 105, 14, { align: "center" });
  doc.setFontSize(11); doc.setFont(undefined, "normal");
  if (opts.brand.address) doc.text(opts.brand.address, 105, 20, { align: "center" });
  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text("Cooperative Audit Report", 105, 28, { align: "center" });
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text(`Period: ${opts.range}`, 105, 33, { align: "center" });

  autoTable(doc, {
    startY: 38, head: [["Summary", "Amount"]],
    body: opts.summary.map(s => [s.label, money(s.value)]),
    theme: "striped",
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  if (opts.byOffice && opts.byOffice.length) {
    doc.setFont(undefined, "bold"); doc.text("By Office", 14, y); doc.setFont(undefined, "normal");
    autoTable(doc, {
      startY: y + 2,
      head: [["Office", "Income", "Expense", "Loan Issued", "Loan Coll.", "Irr Coll.", "Sav. Bal"]],
      body: opts.byOffice.map(o => [o.office, money(o.income), money(o.expense), money(o.loanIssued), money(o.loanCollected), money(o.irrCollected), money(o.savBal)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  if (opts.bySeason && opts.bySeason.length) {
    doc.setFont(undefined, "bold"); doc.text("Irrigation by Season", 14, y); doc.setFont(undefined, "normal");
    autoTable(doc, {
      startY: y + 2,
      head: [["Season", "Charged", "Collected", "Due"]],
      body: opts.bySeason.map(s => [s.season, money(s.charged), money(s.collected), money(s.due)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  doc.setFontSize(9);
  y = Math.max(y + 30, 260);
  doc.line(20, y, 80, y); doc.text("Treasurer", 50, y + 5, { align: "center" });
  doc.line(130, y, 190, y); doc.text("Chairman", 160, y + 5, { align: "center" });

  doc.save(`audit-report.pdf`);
}
