import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { money, moneyPdf, fmtDate } from "./format";
import { loadBranding } from "./branding";

// Shared A4 PDF header/footer. Adds branded company name + period at top, and
// "Page X of Y · printed at" footer on every page. Returns the Y position
// where body content can safely start.
export async function applyPdfHeaderFooter(
  doc: jsPDF,
  opts: { title: string; range?: { from?: string | null; to?: string | null } } = { title: "" }
): Promise<number> {
  const brand = await loadBranding().catch(() => null);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header (drawn only on page 1; subsequent pages get a slim title bar via hook)
  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text(brand?.company_name || "Report", pageW / 2, 12, { align: "center" });
  if (brand?.address) {
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text(brand.address, pageW / 2, 17, { align: "center" });
  }
  doc.setFontSize(12); doc.setFont(undefined, "bold");
  doc.text(opts.title || "", pageW / 2, 24, { align: "center" });
  if (opts.range?.from || opts.range?.to) {
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text(`Period: ${opts.range.from || "—"} to ${opts.range.to || "—"}`, pageW / 2, 29, { align: "center" });
  }
  // Footer drawer — call drawFooters() AFTER all content is added.
  (doc as any).__drawFooters = () => {
    const total = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setFont(undefined, "normal");
      doc.text(`Printed: ${new Date().toLocaleString()}`, 14, pageH - 6);
      doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 6, { align: "right" });
    }
  };
  return opts.range?.from || opts.range?.to ? 33 : 28;
}

export function finalizePdf(doc: jsPDF) {
  const fn = (doc as any).__drawFooters;
  if (typeof fn === "function") fn();
}

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
      ["Savings Balance", moneyPdf(ctx.savingsBal)],
      ["Share Balance", moneyPdf(ctx.share)],
      ["Loan Due", moneyPdf(ctx.loanDue)],
      ["Irrigation Due", moneyPdf(ctx.irrDue)],
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
    body: ctx.irr.map((i: any) => [fmtDate(i.entry_date), i.seasons?.name ?? "-", moneyPdf(i.total), moneyPdf(i.paid_amount), moneyPdf(i.due_amount)]),
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  doc.text("Loans", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Issued", "Principal", "Rate %", "Payable", "Status"]],
    body: ctx.loans.map((l: any) => [fmtDate(l.issued_on), moneyPdf(l.principal), l.interest_rate, moneyPdf(l.total_payable), l.status]),
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
    body: opts.allocations.map(a => [a.kind.toUpperCase(), moneyPdf(a.amount)]),
    foot: [["TOTAL", moneyPdf(opts.amount)]],
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
    body: opts.summary.map(s => [s.label, moneyPdf(s.value)]),
    theme: "striped",
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  if (opts.byOffice && opts.byOffice.length) {
    doc.setFont(undefined, "bold"); doc.text("By Office", 14, y); doc.setFont(undefined, "normal");
    autoTable(doc, {
      startY: y + 2,
      head: [["Office", "Income", "Expense", "Loan Issued", "Loan Coll.", "Irr Coll.", "Sav. Bal"]],
      body: opts.byOffice.map(o => [o.office, moneyPdf(o.income), moneyPdf(o.expense), moneyPdf(o.loanIssued), moneyPdf(o.loanCollected), moneyPdf(o.irrCollected), moneyPdf(o.savBal)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  if (opts.bySeason && opts.bySeason.length) {
    doc.setFont(undefined, "bold"); doc.text("Irrigation by Season", 14, y); doc.setFont(undefined, "normal");
    autoTable(doc, {
      startY: y + 2,
      head: [["Season", "Charged", "Collected", "Due"]],
      body: opts.bySeason.map(s => [s.season, moneyPdf(s.charged), moneyPdf(s.collected), moneyPdf(s.due)]),
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
  const savRows: any[] = [["—", "Opening Balance", "", "", moneyPdf(bal)]];
  let totDep = 0, totWd = 0;
  for (const s of opts.savings) {
    const dep = s.type === "deposit" ? Number(s.amount) : 0;
    const wd = s.type === "withdraw" ? Number(s.amount) : 0;
    bal = bal + dep - wd;
    totDep += dep; totWd += wd;
    savRows.push([fmtDate(s.txn_date), s.note || s.type, dep ? moneyPdf(dep) : "—", wd ? moneyPdf(wd) : "—", moneyPdf(bal)]);
  }
  savRows.push(["", "Totals", moneyPdf(totDep), moneyPdf(totWd), moneyPdf(bal)]);

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
      ...opts.irrigation.map(r => [fmtDate(r.entry_date), r.season || "—", r.dag || "—", moneyPdf(r.total), moneyPdf(r.paid_amount), moneyPdf(r.due_amount)]),
      ["", "", "Totals", moneyPdf(irrTotals.total), moneyPdf(irrTotals.paid), moneyPdf(irrTotals.due)],
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
      ...opts.loans.map(l => [fmtDate(l.issued_on), moneyPdf(l.principal), l.interest_rate, moneyPdf(l.total_payable), moneyPdf(l.paid), moneyPdf(l.due), l.status]),
      ["Totals", moneyPdf(loanTotals.principal), "", moneyPdf(loanTotals.payable), moneyPdf(loanTotals.paid), moneyPdf(loanTotals.due), ""],
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
      ["Savings closing balance", moneyPdf(bal)],
      ["Irrigation total due", moneyPdf(irrTotals.due)],
      ["Loan total due", moneyPdf(loanTotals.due)],
      ["Net liability (Irr + Loan due − Savings)", moneyPdf(irrTotals.due + loanTotals.due - bal)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
  });

  doc.save(`statement-${(opts.farmer.member_no || opts.farmer.farmer_code || "member")}.pdf`);
}

// ---------- Bank-style ledger Statement (Savings or Loan) ----------
export function exportStatementPDF(opts: {
  brand: { company_name: string; address?: string };
  kind: "savings" | "loan";
  farmer: { name_en: string; name_bn?: string | null; account_number?: string | null; farmer_code?: string | null; mobile?: string | null; village?: string | null };
  from?: string | null;
  to?: string | null;
  rows: Array<{ entry_date: string; description: string | null; debit: number; credit: number; balance: number }>;
  totals: { debit: number; credit: number; closing: number };
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const title = opts.kind === "savings" ? "Savings Statement" : "Loan Statement";

  doc.setFontSize(15); doc.setFont(undefined, "bold");
  doc.text(opts.brand.company_name, W / 2, 14, { align: "center" });
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  if (opts.brand.address) doc.text(opts.brand.address, W / 2, 19, { align: "center" });

  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text(title, W / 2, 27, { align: "center" });
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text(`Period: ${opts.from || "—"} to ${opts.to || "—"}`, W / 2, 32, { align: "center" });

  // Member block
  autoTable(doc, {
    startY: 36,
    theme: "plain",
    body: [[
      `Name: ${opts.farmer.name_en}${opts.farmer.name_bn ? " (" + opts.farmer.name_bn + ")" : ""}`,
      `A/C: ${opts.farmer.account_number || opts.farmer.farmer_code || "—"}`,
      `Mobile: ${opts.farmer.mobile || "—"}`,
      `Village: ${opts.farmer.village || "—"}`,
    ]],
    styles: { fontSize: 9 },
    margin: { left: 12, right: 12 },
  });

  const startY = (doc as any).lastAutoTable.finalY + 2;

  autoTable(doc, {
    startY,
    head: [["Date", "Description", "Debit", "Credit", "Balance"]],
    body: opts.rows.map(r => [
      fmtDate(r.entry_date),
      r.description || "—",
      Number(r.debit) ? moneyPdf(r.debit) : "—",
      Number(r.credit) ? moneyPdf(r.credit) : "—",
      moneyPdf(r.balance),
    ]),
    foot: [[
      "Totals", "",
      moneyPdf(opts.totals.debit),
      moneyPdf(opts.totals.credit),
      moneyPdf(opts.totals.closing),
    ]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 110, 70], halign: "center" },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 12, right: 12 },
  });

  const ac = opts.farmer.account_number || opts.farmer.farmer_code || "member";
  doc.save(`${opts.kind}-statement-${ac}.pdf`);
}
