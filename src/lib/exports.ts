import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { money, moneyPdf, fmtDate } from "./format";
import { loadBranding } from "./branding";
import { ensureBanglaFont, BANGLA_FONT } from "./pdfFonts";
import { formatDagNumbers } from "./dagNumbers";



// Resolve current PDF language from the app's persisted user choice. Reports
// then translate their static labels (Period / Printed / Page) automatically.
function pdfLang(): "en" | "bn" {
  if (typeof window === "undefined") return "en";
  const v = localStorage.getItem("lang");
  return v === "bn" ? "bn" : "en";
}
function tPdf(enKey: string, bnKey: string): string {
  const lang = pdfLang();
  if (lang === "bn") return bnKey;
  return enKey;
}

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

  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setLangFont = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };

  doc.setFontSize(13); setLangFont("bold");
  doc.text(brand?.company_name || (useBn ? "প্রতিবেদন" : "Report"), pageW / 2, 12, { align: "center" });
  if (brand?.address) {
    doc.setFontSize(9); setLangFont("normal");
    doc.text(brand.address, pageW / 2, 17, { align: "center" });
  }
  doc.setFontSize(12); setLangFont("bold");
  doc.text(opts.title || "", pageW / 2, 24, { align: "center" });
  if (opts.range?.from || opts.range?.to) {
    doc.setFontSize(9); setLangFont("normal");
    const periodLabel = useBn ? "সময়কাল" : "Period";
    const toWord = useBn ? "থেকে" : "to";
    doc.text(`${periodLabel}: ${opts.range.from || "—"} ${toWord} ${opts.range.to || "—"}`, pageW / 2, 29, { align: "center" });
  }
  (doc as any).__drawFooters = () => {
    const total = (doc as any).internal.getNumberOfPages();
    const printedLabel = useBn ? "মুদ্রিত" : "Printed";
    const pageLabel = useBn ? "পৃষ্ঠা" : "Page";
    const ofWord = useBn ? "/" : "of";
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8); setLangFont("normal");
      doc.text(`${printedLabel}: ${new Date().toLocaleString()}`, 14, pageH - 6);
      doc.text(`${pageLabel} ${i} ${ofWord} ${total}`, pageW - 14, pageH - 6, { align: "right" });
    }
  };
  return opts.range?.from || opts.range?.to ? 33 : 28;
}

export function finalizePdf(doc: jsPDF) {
  const fn = (doc as any).__drawFooters;
  if (typeof fn === "function") fn();
}

export async function exportFarmerReportPDF(farmer: any, ctx: any) {
  const doc = new jsPDF();
  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setF = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };
  doc.setFontSize(16); setF("bold");
  doc.text(tPdf("Farmer Full Report", "কৃষক পূর্ণ প্রতিবেদন"), 14, 16);
  doc.setFontSize(10); setF("normal");
  doc.text(`${tPdf("Farmer ID", "কৃষক আইডি")}: ${farmer.farmer_code}`, 14, 24);
  doc.text(`${tPdf("Name", "নাম")}: ${useBn ? (farmer.name_bn || farmer.name_en) : farmer.name_en}`, 14, 30);
  doc.text(`${tPdf("Mobile", "মোবাইল")}: ${farmer.mobile ?? "-"}    ${tPdf("NID", "এনআইডি")}: ${farmer.nid ?? "-"}`, 14, 36);
  doc.text(`${tPdf("Address", "ঠিকানা")}: ${[farmer.village, farmer.upazila, farmer.district].filter(Boolean).join(", ")}`, 14, 42);

  const tableFont: any = useBn && bnFamily ? { font: bnFamily, fontStyle: "normal" } : {};
  autoTable(doc, {
    startY: 48, head: [[tPdf("Summary", "সারাংশ"), tPdf("Amount", "পরিমাণ")]],
    body: [
      [tPdf("Savings Balance", "সঞ্চয় স্থিতি"), moneyPdf(ctx.savingsBal)],
      [tPdf("Share Balance", "শেয়ার স্থিতি"), moneyPdf(ctx.share)],
      [tPdf("Loan Due", "ঋণ বকেয়া"), moneyPdf(ctx.loanDue)],
      [tPdf("Irrigation Due", "সেচ বকেয়া"), moneyPdf(ctx.irrDue)],
    ],
    styles: tableFont, headStyles: tableFont,
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  setF("normal"); doc.text(tPdf("Lands", "জমি"), 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Mouza", "মৌজা"), tPdf("Dag No", "দাগ নং"), tPdf("Size", "পরিমাণ"), tPdf("Owner", "মালিকানা"), tPdf("Field", "ক্ষেত্র")]],
    body: ctx.lands.map((l: any) => [l.mouza, formatDagNumbers(l.dag_no), l.land_size, l.owner_type, l.field_type]),
    styles: tableFont, headStyles: tableFont,
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  setF("normal"); doc.text(tPdf("Irrigation Charges", "সেচ চার্জ"), 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Date", "তারিখ"), tPdf("Season", "মৌসুম"), tPdf("Total", "মোট"), tPdf("Paid", "পরিশোধিত"), tPdf("Due", "বকেয়া")]],
    body: ctx.irr.map((i: any) => [fmtDate(i.entry_date), i.seasons?.name ?? "-", moneyPdf(i.total), moneyPdf(i.paid_amount), moneyPdf(i.due_amount)]),
    styles: tableFont, headStyles: tableFont,
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  setF("normal"); doc.text(tPdf("Loans", "ঋণ"), 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Issued", "ইস্যু তারিখ"), tPdf("Principal", "মূলধন"), tPdf("Rate %", "হার %"), tPdf("Payable", "প্রদেয়"), tPdf("Status", "অবস্থা")]],
    body: ctx.loans.map((l: any) => [fmtDate(l.issued_on), moneyPdf(l.principal), l.interest_rate, moneyPdf(l.total_payable), l.status]),
    styles: tableFont, headStyles: tableFont,
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

export async function exportTablePDF(
  title: string,
  head: string[],
  rows: any[][],
  range?: { from?: string | null; to?: string | null },
  opts?: { signatures?: string[]; landscape?: boolean },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: opts?.landscape ? "landscape" : "portrait" });
  const startY = await applyPdfHeaderFooter(doc, { title, range });
  autoTable(doc, { startY: startY + 2, head: [head], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [30, 110, 70] }, theme: "grid" });

  // Client-format signature block at the bottom of the last page.
  const sigs = opts?.signatures;
  if (sigs && sigs.length) {
    const lang = pdfLang();
    const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
    const useBn = lang === "bn" && !!bnFamily;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = ((doc as any).lastAutoTable?.finalY ?? startY) + 24;
    if (y > pageH - 24) { doc.addPage(); y = 40; }
    const slot = (pageW - 28) / sigs.length;
    doc.setFontSize(9);
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal"); else doc.setFont(undefined, "normal");
    sigs.forEach((label, i) => {
      const cx = 14 + slot * i + slot / 2;
      doc.line(cx - 22, y, cx + 22, y);
      doc.text(label, cx, y + 5, { align: "center" });
    });
  }

  finalizePdf(doc);
  doc.save(`${buildExportName(title, range)}.pdf`);
}


export function exportExcel(
  filename: string,
  sheetName: string,
  rows: any[],
  range?: { from?: string | null; to?: string | null }
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // A4-friendly column widths: size each column to its widest cell (header or value),
  // clamped so the sheet stays within a printable A4 width.
  const headers = rows.length ? Object.keys(rows[0]) : [];
  ws["!cols"] = headers.map((h) => {
    const maxLen = rows.reduce((m, r) => {
      const v = r[h];
      const len = v === null || v === undefined ? 0 : String(v).length;
      return Math.max(m, len);
    }, h.length);
    return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
  });
  ws["!margins"] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${buildExportName(filename, range)}.xlsx`);
}

// CSV writer with UTF-8 BOM so Excel opens Bengali/Unicode correctly.
export function exportCSV(
  filename: string,
  head: string[],
  rows: any[][],
  range?: { from?: string | null; to?: string | null }
) {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExportName(filename, range)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Payment Receipt PDF ----------
export async function exportPaymentReceiptPDF(opts: {
  brand: { company_name: string; address?: string; mobile?: string };
  receipt_no: string;
  date: string;
  farmer: { name_en: string; member_no?: string; farmer_code?: string; mobile?: string; village?: string };
  amount: number;
  method: string;
  note?: string;
  allocations: Array<{ kind: string; amount: number }>;
  loanContext?: Array<{
    label: string;
    totalPayable: number; paidToDate: number; due: number;
    installments?: Array<{ no: number; due_date: string; amount: number; paid_amount: number; status: string }>;
    paymentHistory?: Array<{ date: string; amount: number; note?: string }>;
  }>;
  /** Optional QR payload — typically a verify URL like `${origin}/r/${verify_token}`. Renders top-right corner. */
  qrText?: string | null;
}) {

  const doc = new jsPDF({ unit: "mm", format: [148, 210] }); // A5
  const w = 148;
  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setF = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };
  const tableFont: any = useBn && bnFamily ? { font: bnFamily, fontStyle: "normal" } : {};

  doc.setFontSize(14); setF("bold");
  doc.text(opts.brand.company_name, w / 2, 14, { align: "center" });
  doc.setFontSize(9); setF("normal");
  if (opts.brand.address) doc.text(opts.brand.address, w / 2, 19, { align: "center" });
  if (opts.brand.mobile) doc.text(`${tPdf("Mobile", "মোবাইল")}: ${opts.brand.mobile}`, w / 2, 23, { align: "center" });

  doc.setFontSize(11); setF("bold");
  doc.text(tPdf("PAYMENT RECEIPT", "পেমেন্ট রসিদ"), w / 2, 32, { align: "center" });
  doc.setLineWidth(0.3); doc.line(10, 35, w - 10, 35);

  doc.setFontSize(9); setF("normal");
  doc.text(`${tPdf("Receipt #", "রসিদ নং")}: ${opts.receipt_no}`, 12, 41);
  doc.text(`${tPdf("Date", "তারিখ")}: ${fmtDate(opts.date)}`, w - 12, 41, { align: "right" });

  doc.text(`${tPdf("Farmer ID", "কৃষক আইডি")}: ${opts.farmer.member_no ?? opts.farmer.farmer_code ?? "-"}`, 12, 47);
  doc.text(`${tPdf("Name", "নাম")}: ${opts.farmer.name_en}`, 12, 52);
  if (opts.farmer.village) doc.text(`${tPdf("Village", "গ্রাম")}: ${opts.farmer.village}`, 12, 57);
  if (opts.farmer.mobile) doc.text(`${tPdf("Mobile", "মোবাইল")}: ${opts.farmer.mobile}`, w - 12, 57, { align: "right" });

  // Optional QR code (top-right corner under date)
  if (opts.qrText) {
    try {
      const qrUrl = await QRCode.toDataURL(opts.qrText, { margin: 0, width: 160 });
      doc.addImage(qrUrl, "PNG", w - 12 - 18, 8, 18, 18);
      doc.setFontSize(6); doc.setTextColor(110);
      doc.text(tPdf("Scan to verify", "যাচাইয়ের জন্য স্ক্যান"), w - 12 - 9, 28, { align: "center" });
      doc.setFontSize(9); doc.setTextColor(0);
    } catch { /* ignore */ }
  }

  autoTable(doc, {

    startY: 62,
    head: [[tPdf("Allocation", "বরাদ্দ"), tPdf("Amount (BDT)", "পরিমাণ (টাকা)")]],
    body: opts.allocations.map(a => [a.kind.toUpperCase(), moneyPdf(a.amount)]),
    foot: [[tPdf("TOTAL", "মোট"), moneyPdf(opts.amount)]],
    theme: "grid",
    styles: { fontSize: 9, ...tableFont },
    headStyles: { fillColor: [30, 110, 70], ...tableFont },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", ...tableFont },
    margin: { left: 12, right: 12 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9); setF("normal");
  doc.text(`${tPdf("Method", "মাধ্যম")}: ${opts.method ?? "cash"}`, 12, y);
  if (opts.note) { y += 5; doc.text(`${tPdf("Note", "মন্তব্য")}: ${opts.note}`, 12, y); }

  // Signature lines
  y = Math.max(y + 18, 170);
  doc.line(15, y, 60, y); doc.text(tPdf("Collector", "কালেক্টর"), 37, y + 4, { align: "center" });
  doc.line(w - 60, y, w - 15, y); doc.text(tPdf("Authorized Sig.", "অনুমোদিত স্বাক্ষর"), w - 37, y + 4, { align: "center" });

  // Optional loan context (installments + history) on additional pages
  if (opts.loanContext && opts.loanContext.length) {
    for (const ctx of opts.loanContext) {
      doc.addPage("a4", "p");
      const aw = doc.internal.pageSize.getWidth();
      doc.setFontSize(12); setF("bold");
      doc.text(`${tPdf("Loan", "ঋণ")}: ${ctx.label}`, aw / 2, 14, { align: "center" });
      doc.setFontSize(9); setF("normal");
      doc.text(`${tPdf("Total Payable", "মোট প্রদেয়")}: ${moneyPdf(ctx.totalPayable)}    ${tPdf("Paid", "পরিশোধিত")}: ${moneyPdf(ctx.paidToDate)}    ${tPdf("Due", "বকেয়া")}: ${moneyPdf(ctx.due)}`, 14, 22);
      let yy = 28;
      if (ctx.installments && ctx.installments.length) {
        autoTable(doc, {
          startY: yy,
          head: [["#", tPdf("Due Date", "নির্ধারিত তারিখ"), tPdf("Amount", "পরিমাণ"), tPdf("Paid", "পরিশোধিত"), tPdf("Status", "অবস্থা")]],
          body: ctx.installments.map(i => [i.no, fmtDate(i.due_date), moneyPdf(i.amount), moneyPdf(i.paid_amount), i.status]),
          styles: { fontSize: 8, ...tableFont }, headStyles: { fillColor: [30, 110, 70], ...tableFont },
        });
        yy = (doc as any).lastAutoTable.finalY + 6;
      }
      if (ctx.paymentHistory && ctx.paymentHistory.length) {
        setF("bold"); doc.text(tPdf("Payment History", "পেমেন্ট ইতিহাস"), 14, yy); yy += 2;
        autoTable(doc, {
          startY: yy,
          head: [[tPdf("Date", "তারিখ"), tPdf("Amount", "পরিমাণ"), tPdf("Note", "মন্তব্য")]],
          body: ctx.paymentHistory.map(p => [fmtDate(p.date), moneyPdf(p.amount), p.note ?? ""]),
          styles: { fontSize: 8, ...tableFont }, headStyles: { fillColor: [30, 110, 70], ...tableFont },
        });
      }
    }
  }

  doc.save(`receipt-${opts.receipt_no}.pdf`);
}

// ---------- Cooperative Audit-ready Report ----------
export async function exportAuditReportPDF(opts: {
  brand: { company_name: string; address?: string };
  range: string;
  summary: Array<{ label: string; value: number }>;
  byOffice?: Array<{ office: string; income: number; expense: number; loanIssued: number; loanCollected: number; irrCollected: number; savBal: number }>;
  bySeason?: Array<{ season: string; charged: number; collected: number; due: number }>;
}) {
  const doc = new jsPDF();
  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setF = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };
  const tableFont: any = useBn && bnFamily ? { font: bnFamily, fontStyle: "normal" } : {};

  doc.setFontSize(16); setF("bold");
  doc.text(opts.brand.company_name, 105, 14, { align: "center" });
  doc.setFontSize(11); setF("normal");
  if (opts.brand.address) doc.text(opts.brand.address, 105, 20, { align: "center" });
  doc.setFontSize(13); setF("bold");
  doc.text(tPdf("Cooperative Audit Report", "সমবায় অডিট প্রতিবেদন"), 105, 28, { align: "center" });
  doc.setFontSize(9); setF("normal");
  doc.text(`${tPdf("Period", "সময়কাল")}: ${opts.range}`, 105, 33, { align: "center" });

  autoTable(doc, {
    startY: 38, head: [[tPdf("Summary", "সারাংশ"), tPdf("Amount", "পরিমাণ")]],
    body: opts.summary.map(s => [s.label, moneyPdf(s.value)]),
    theme: "striped",
    styles: tableFont, headStyles: tableFont,
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  if (opts.byOffice && opts.byOffice.length) {
    setF("bold"); doc.text(tPdf("By Office", "অফিস অনুযায়ী"), 14, y); setF("normal");
    autoTable(doc, {
      startY: y + 2,
      head: [[tPdf("Office", "অফিস"), tPdf("Income", "আয়"), tPdf("Expense", "ব্যয়"), tPdf("Loan Issued", "ঋণ প্রদান"), tPdf("Loan Coll.", "ঋণ আদায়"), tPdf("Irr Coll.", "সেচ আদায়"), tPdf("Sav. Bal", "সঞ্চয় স্থিতি")]],
      body: opts.byOffice.map(o => [o.office, moneyPdf(o.income), moneyPdf(o.expense), moneyPdf(o.loanIssued), moneyPdf(o.loanCollected), moneyPdf(o.irrCollected), moneyPdf(o.savBal)]),
      styles: tableFont, headStyles: tableFont,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  if (opts.bySeason && opts.bySeason.length) {
    setF("bold"); doc.text(tPdf("Irrigation by Season", "মৌসুম অনুযায়ী সেচ"), 14, y); setF("normal");
    autoTable(doc, {
      startY: y + 2,
      head: [[tPdf("Season", "মৌসুম"), tPdf("Charged", "ধার্য"), tPdf("Collected", "আদায়"), tPdf("Due", "বকেয়া")]],
      body: opts.bySeason.map(s => [s.season, moneyPdf(s.charged), moneyPdf(s.collected), moneyPdf(s.due)]),
      styles: tableFont, headStyles: tableFont,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  doc.setFontSize(9); setF("normal");
  y = Math.max(y + 30, 260);
  doc.line(20, y, 80, y); doc.text(tPdf("Treasurer", "কোষাধ্যক্ষ"), 50, y + 5, { align: "center" });
  doc.line(130, y, 190, y); doc.text(tPdf("Chairman", "চেয়ারম্যান"), 160, y + 5, { align: "center" });

  doc.save(`audit-report.pdf`);
}

// ---------- Combined Farmer Statement (Loans + Savings + Irrigation) ----------
export async function exportFarmerCombinedStatementPDF(opts: {
  brand: { company_name: string; address?: string; mobile?: string };
  farmer: { name_en: string; name_bn?: string; farmer_code?: string; member_no?: string; mobile?: string; village?: string };
  range: { from: string; to: string };
  opening_savings: number;
  savings: Array<{ txn_date: string; type: string; amount: number; note?: string | null }>;
  irrigation: Array<{ entry_date: string; season?: string; dag?: string; total: number; paid_amount: number; due_amount: number }>;
  loans: Array<{ issued_on: string; principal: number; interest_rate: number; total_payable: number; status: string; paid: number; due: number }>;
}) {
  const doc = new jsPDF();
  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setF = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };
  const tableFont: any = useBn && bnFamily ? { font: bnFamily, fontStyle: "normal" } : {};

  doc.setFontSize(15); setF("bold");
  doc.text(opts.brand.company_name, 105, 14, { align: "center" });
  doc.setFontSize(10); setF("normal");
  if (opts.brand.address) doc.text(opts.brand.address, 105, 20, { align: "center" });
  doc.setFontSize(13); setF("bold");
  doc.text(tPdf("Farmer Statement", "কৃষক স্টেটমেন্ট"), 105, 28, { align: "center" });
  doc.setFontSize(9); setF("normal");
  doc.text(`${tPdf("Period", "সময়কাল")}: ${opts.range.from || "—"}  ${tPdf("to", "থেকে")}  ${opts.range.to || "—"}`, 105, 33, { align: "center" });

  // Member block
  autoTable(doc, {
    startY: 38,
    theme: "plain",
    body: [[
      `${tPdf("Farmer ID", "কৃষক")}: ${opts.farmer.name_en}${opts.farmer.name_bn ? " (" + opts.farmer.name_bn + ")" : ""}`,
      `${tPdf("Code", "কোড")}: ${opts.farmer.member_no || opts.farmer.farmer_code || "—"}`,
      `${tPdf("Mobile", "মোবাইল")}: ${opts.farmer.mobile || "—"}`,
      `${tPdf("Village", "গ্রাম")}: ${opts.farmer.village || "—"}`,
    ]],
    styles: { fontSize: 9, ...tableFont },
  });

  let bal = Number(opts.opening_savings || 0);
  const savRows: any[] = [["—", tPdf("Opening Balance", "প্রারম্ভিক স্থিতি"), "", "", moneyPdf(bal)]];
  let totDep = 0, totWd = 0;
  for (const s of opts.savings) {
    const dep = s.type === "deposit" ? Number(s.amount) : 0;
    const wd = s.type === "withdraw" ? Number(s.amount) : 0;
    bal = bal + dep - wd;
    totDep += dep; totWd += wd;
    savRows.push([fmtDate(s.txn_date), s.note || s.type, dep ? moneyPdf(dep) : "—", wd ? moneyPdf(wd) : "—", moneyPdf(bal)]);
  }
  savRows.push(["", tPdf("Totals", "মোট"), moneyPdf(totDep), moneyPdf(totWd), moneyPdf(bal)]);

  let y = (doc as any).lastAutoTable.finalY + 4;
  setF("bold"); doc.text(tPdf("Savings", "সঞ্চয়"), 14, y); setF("normal");
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Date", "তারিখ"), tPdf("Particulars", "বিবরণ"), tPdf("Deposit", "জমা"), tPdf("Withdraw", "উত্তোলন"), tPdf("Balance", "স্থিতি")]],
    body: savRows,
    theme: "striped",
    styles: { fontSize: 8, ...tableFont }, headStyles: tableFont,
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  setF("bold"); doc.text(tPdf("Irrigation Charges", "সেচ চার্জ"), 14, y); setF("normal");
  const irrTotals = opts.irrigation.reduce((a, r) => ({
    total: a.total + Number(r.total || 0),
    paid: a.paid + Number(r.paid_amount || 0),
    due: a.due + Number(r.due_amount || 0),
  }), { total: 0, paid: 0, due: 0 });
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Date", "তারিখ"), tPdf("Season", "মৌসুম"), tPdf("Dag", "দাগ"), tPdf("Total", "মোট"), tPdf("Paid", "পরিশোধিত"), tPdf("Due", "বকেয়া")]],
    body: [
      ...opts.irrigation.map(r => [fmtDate(r.entry_date), r.season || "—", r.dag || "—", moneyPdf(r.total), moneyPdf(r.paid_amount), moneyPdf(r.due_amount)]),
      ["", "", tPdf("Totals", "মোট"), moneyPdf(irrTotals.total), moneyPdf(irrTotals.paid), moneyPdf(irrTotals.due)],
    ],
    theme: "striped",
    styles: { fontSize: 8, ...tableFont }, headStyles: tableFont,
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  setF("bold"); doc.text(tPdf("Loans", "ঋণ"), 14, y); setF("normal");
  const loanTotals = opts.loans.reduce((a, r) => ({
    principal: a.principal + Number(r.principal || 0),
    payable: a.payable + Number(r.total_payable || 0),
    paid: a.paid + Number(r.paid || 0),
    due: a.due + Number(r.due || 0),
  }), { principal: 0, payable: 0, paid: 0, due: 0 });
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Issued", "ইস্যু"), tPdf("Principal", "মূলধন"), tPdf("Rate %", "হার %"), tPdf("Payable", "প্রদেয়"), tPdf("Paid", "পরিশোধিত"), tPdf("Due", "বকেয়া"), tPdf("Status", "অবস্থা")]],
    body: [
      ...opts.loans.map(l => [fmtDate(l.issued_on), moneyPdf(l.principal), l.interest_rate, moneyPdf(l.total_payable), moneyPdf(l.paid), moneyPdf(l.due), l.status]),
      [tPdf("Totals", "মোট"), moneyPdf(loanTotals.principal), "", moneyPdf(loanTotals.payable), moneyPdf(loanTotals.paid), moneyPdf(loanTotals.due), ""],
    ],
    theme: "striped",
    styles: { fontSize: 8, ...tableFont }, headStyles: tableFont,
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  setF("bold"); doc.text(tPdf("Summary", "সারাংশ"), 14, y); setF("normal");
  autoTable(doc, {
    startY: y + 2,
    head: [[tPdf("Metric", "মেট্রিক"), tPdf("Amount", "পরিমাণ")]],
    body: [
      [tPdf("Savings closing balance", "সঞ্চয় সমাপনী স্থিতি"), moneyPdf(bal)],
      [tPdf("Irrigation total due", "সেচ মোট বকেয়া"), moneyPdf(irrTotals.due)],
      [tPdf("Loan total due", "ঋণ মোট বকেয়া"), moneyPdf(loanTotals.due)],
      [tPdf("Net liability (Irr + Loan due − Savings)", "নিট দায় (সেচ + ঋণ বকেয়া − সঞ্চয়)"), moneyPdf(irrTotals.due + loanTotals.due - bal)],
    ],
    theme: "grid",
    styles: { fontSize: 9, ...tableFont }, headStyles: tableFont,
  });

  doc.save(`statement-${(opts.farmer.member_no || opts.farmer.farmer_code || "member")}.pdf`);
}

// ---------- Bank-style ledger Statement (Savings or Loan) ----------
export async function exportStatementPDF(opts: {
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
  const lang = pdfLang();
  const bnFamily = lang === "bn" ? await ensureBanglaFont(doc) : null;
  const useBn = lang === "bn" && !!bnFamily;
  const setF = (style: "normal" | "bold" = "normal") => {
    if (useBn && bnFamily) doc.setFont(bnFamily, "normal");
    else doc.setFont(undefined, style);
  };
  const tableFont: any = useBn && bnFamily ? { font: bnFamily, fontStyle: "normal" } : {};

  const title = opts.kind === "savings"
    ? tPdf("Savings Statement", "সঞ্চয় স্টেটমেন্ট")
    : tPdf("Loan Statement", "ঋণ স্টেটমেন্ট");

  doc.setFontSize(15); setF("bold");
  doc.text(opts.brand.company_name, W / 2, 14, { align: "center" });
  doc.setFontSize(10); setF("normal");
  if (opts.brand.address) doc.text(opts.brand.address, W / 2, 19, { align: "center" });

  doc.setFontSize(13); setF("bold");
  doc.text(title, W / 2, 27, { align: "center" });
  doc.setFontSize(9); setF("normal");
  doc.text(`${tPdf("Period", "সময়কাল")}: ${opts.from || "—"} ${tPdf("to", "থেকে")} ${opts.to || "—"}`, W / 2, 32, { align: "center" });

  // Member block
  autoTable(doc, {
    startY: 36,
    theme: "plain",
    body: [[
      `${tPdf("Name", "নাম")}: ${opts.farmer.name_en}${opts.farmer.name_bn ? " (" + opts.farmer.name_bn + ")" : ""}`,
      `${tPdf("A/C", "অ্যাকাউন্ট")}: ${opts.farmer.account_number || opts.farmer.farmer_code || "—"}`,
      `${tPdf("Mobile", "মোবাইল")}: ${opts.farmer.mobile || "—"}`,
      `${tPdf("Village", "গ্রাম")}: ${opts.farmer.village || "—"}`,
    ]],
    styles: { fontSize: 9, ...tableFont },
    margin: { left: 12, right: 12 },
  });

  const startY = (doc as any).lastAutoTable.finalY + 2;

  autoTable(doc, {
    startY,
    head: [[tPdf("Date", "তারিখ"), tPdf("Description", "বিবরণ"), tPdf("Debit", "ডেবিট"), tPdf("Credit", "ক্রেডিট"), tPdf("Balance", "স্থিতি")]],
    body: opts.rows.map(r => [
      fmtDate(r.entry_date),
      r.description || "—",
      Number(r.debit) ? moneyPdf(r.debit) : "—",
      Number(r.credit) ? moneyPdf(r.credit) : "—",
      moneyPdf(r.balance),
    ]),
    foot: [[
      tPdf("Totals", "মোট"), "",
      moneyPdf(opts.totals.debit),
      moneyPdf(opts.totals.credit),
      moneyPdf(opts.totals.closing),
    ]],
    theme: "grid",
    styles: { fontSize: 9, ...tableFont },
    headStyles: { fillColor: [30, 110, 70], halign: "center", ...tableFont },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", ...tableFont },
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
