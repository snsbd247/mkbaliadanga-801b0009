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

// Build a clean filename: "report-name_2025-01-01_to_2025-01-31"
export function buildExportName(
  reportName: string,
  range?: { from?: string | null; to?: string | null }
) {
  const slug = reportName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const f = range?.from?.slice(0, 10);
  const t = range?.to?.slice(0, 10);
  if (f && t) return `${slug}_${f}_to_${t}`;
  if (f) return `${slug}_from_${f}`;
  if (t) return `${slug}_until_${t}`;
  return `${slug}_${new Date().toISOString().slice(0, 10)}`;
}

export function exportTablePDF(
  title: string,
  head: string[],
  rows: any[][],
  range?: { from?: string | null; to?: string | null }
) {
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text(title, 14, 14);
  if (range?.from || range?.to) {
    doc.setFontSize(9);
    doc.text(`Period: ${range.from || "—"} to ${range.to || "—"}`, 14, 20);
    autoTable(doc, { startY: 26, head: [head], body: rows });
  } else {
    autoTable(doc, { startY: 20, head: [head], body: rows });
  }
  doc.save(`${buildExportName(title, range)}.pdf`);
}

export function exportExcel(
  filename: string,
  sheetName: string,
  rows: any[],
  range?: { from?: string | null; to?: string | null }
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${buildExportName(filename, range)}.xlsx`);
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

  doc.text(`Member: ${opts.farmer.member_no ?? opts.farmer.farmer_code ?? "-"}`, 12, 47);
  doc.text(`Name: ${opts.farmer.name_en}`, 12, 52);
  if (opts.farmer.village) doc.text(`Village: ${opts.farmer.village}`, 12, 57);
  if (opts.farmer.mobile) doc.text(`Mobile: ${opts.farmer.mobile}`, w - 12, 57, { align: "right" });

  autoTable(doc, {
    startY: 62,
    head: [["Allocation", "Amount (BDT)"]],
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
  doc.line(15, y, 60, y); doc.text("Collector / গ্রহীতা", 37, y + 4, { align: "center" });
  doc.line(w - 60, y, w - 15, y); doc.text("Authorized Sig. / অনুমোদিত", w - 37, y + 4, { align: "center" });

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

// ---------- Combined Farmer Statement (Loans + Savings + Irrigation) ----------
export function exportFarmerCombinedStatementPDF(opts: {
  brand: { company_name: string; address?: string; mobile?: string };
  farmer: { name_en: string; name_bn?: string; farmer_code?: string; member_no?: string; mobile?: string; village?: string };
  range: { from: string; to: string };
  opening_savings: number;
  savings: Array<{ txn_date: string; type: string; amount: number; note?: string | null }>;
  irrigation: Array<{ entry_date: string; season?: string; dag?: string; total: number; paid_amount: number; due_amount: number }>;
  loans: Array<{ issued_on: string; principal: number; interest_rate: number; total_payable: number; status: string; paid: number; due: number }>;
}) {
  const doc = new jsPDF();
  doc.setFontSize(15); doc.setFont(undefined, "bold");
  doc.text(opts.brand.company_name, 105, 14, { align: "center" });
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  if (opts.brand.address) doc.text(opts.brand.address, 105, 20, { align: "center" });
  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text("Farmer Statement", 105, 28, { align: "center" });
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text(`Period: ${opts.range.from || "—"}  to  ${opts.range.to || "—"}`, 105, 33, { align: "center" });

  // Member block
  autoTable(doc, {
    startY: 38,
    theme: "plain",
    body: [[
      `Member: ${opts.farmer.name_en}${opts.farmer.name_bn ? " (" + opts.farmer.name_bn + ")" : ""}`,
      `Code: ${opts.farmer.member_no || opts.farmer.farmer_code || "—"}`,
      `Mobile: ${opts.farmer.mobile || "—"}`,
      `Village: ${opts.farmer.village || "—"}`,
    ]],
    styles: { fontSize: 9 },
  });

  // Savings ledger w/ running balance
  let bal = Number(opts.opening_savings || 0);
  const savRows: any[] = [["—", "Opening Balance", "", "", money(bal)]];
  let totDep = 0, totWd = 0;
  for (const s of opts.savings) {
    const dep = s.type === "deposit" ? Number(s.amount) : 0;
    const wd = s.type === "withdraw" ? Number(s.amount) : 0;
    bal = bal + dep - wd;
    totDep += dep; totWd += wd;
    savRows.push([fmtDate(s.txn_date), s.note || s.type, dep ? money(dep) : "—", wd ? money(wd) : "—", money(bal)]);
  }
  savRows.push(["", "Totals", money(totDep), money(totWd), money(bal)]);

  let y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont(undefined, "bold"); doc.text("Savings", 14, y); doc.setFont(undefined, "normal");
  autoTable(doc, {
    startY: y + 2,
    head: [["Date", "Particulars", "Deposit", "Withdraw", "Balance"]],
    body: savRows,
    theme: "striped",
    styles: { fontSize: 8 },
  });

  // Irrigation
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont(undefined, "bold"); doc.text("Irrigation Charges", 14, y); doc.setFont(undefined, "normal");
  const irrTotals = opts.irrigation.reduce((a, r) => ({
    total: a.total + Number(r.total || 0),
    paid: a.paid + Number(r.paid_amount || 0),
    due: a.due + Number(r.due_amount || 0),
  }), { total: 0, paid: 0, due: 0 });
  autoTable(doc, {
    startY: y + 2,
    head: [["Date", "Season", "Dag", "Total", "Paid", "Due"]],
    body: [
      ...opts.irrigation.map(r => [fmtDate(r.entry_date), r.season || "—", r.dag || "—", money(r.total), money(r.paid_amount), money(r.due_amount)]),
      ["", "", "Totals", money(irrTotals.total), money(irrTotals.paid), money(irrTotals.due)],
    ],
    theme: "striped",
    styles: { fontSize: 8 },
  });

  // Loans
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont(undefined, "bold"); doc.text("Loans", 14, y); doc.setFont(undefined, "normal");
  const loanTotals = opts.loans.reduce((a, r) => ({
    principal: a.principal + Number(r.principal || 0),
    payable: a.payable + Number(r.total_payable || 0),
    paid: a.paid + Number(r.paid || 0),
    due: a.due + Number(r.due || 0),
  }), { principal: 0, payable: 0, paid: 0, due: 0 });
  autoTable(doc, {
    startY: y + 2,
    head: [["Issued", "Principal", "Rate %", "Payable", "Paid", "Due", "Status"]],
    body: [
      ...opts.loans.map(l => [fmtDate(l.issued_on), money(l.principal), l.interest_rate, money(l.total_payable), money(l.paid), money(l.due), l.status]),
      ["Totals", money(loanTotals.principal), "", money(loanTotals.payable), money(loanTotals.paid), money(loanTotals.due), ""],
    ],
    theme: "striped",
    styles: { fontSize: 8 },
  });

  // Grand summary
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont(undefined, "bold"); doc.text("Summary", 14, y); doc.setFont(undefined, "normal");
  autoTable(doc, {
    startY: y + 2,
    head: [["Metric", "Amount"]],
    body: [
      ["Savings closing balance", money(bal)],
      ["Irrigation total due", money(irrTotals.due)],
      ["Loan total due", money(loanTotals.due)],
      ["Net liability (Irr + Loan due − Savings)", money(irrTotals.due + loanTotals.due - bal)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
  });

  doc.save(`statement-${(opts.farmer.member_no || opts.farmer.farmer_code || "member")}.pdf`);
}
