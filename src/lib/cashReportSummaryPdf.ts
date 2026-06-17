// Generates a downloadable PDF summary after a QuickSeed / DemoManager run:
// per-table row counts, mismatch warnings, and the totals rendered for
// Cash Book, Hand Cash and Cash Statement (Irrigation + Society).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fetchCashReportCounts, flagCashMismatches, type CashCountRow } from "@/lib/cashReportBackup";
import { computeStatement } from "@/lib/irrigationCashStatement";
import { computeSocietyStatement } from "@/lib/societyCashStatement";
import { ensureBanglaFont } from "@/lib/pdfFonts";
import { rowsToCsvBlob } from "@/lib/csvExport";

function isBn(): boolean {
  try { return localStorage.getItem("lang") === "bn"; } catch { return false; }
}

// Bilingual label helper for PDF/CSV.
const L = {
  title: ["Cash Report Demo Summary", "ক্যাশ রিপোর্ট ডেমো সারাংশ"],
  source: ["Source", "উৎস"],
  generated: ["Generated", "তৈরি"],
  modules: ["Modules", "মডিউল"],
  warning: ["WARNING: required table(s) empty", "সতর্কতা: প্রয়োজনীয় টেবিল খালি"],
  allOk: ["Validation: all required tables populated.", "যাচাই: সব প্রয়োজনীয় টেবিলে ডাটা আছে।"],
  table: ["Table", "টেবিল"],
  rows: ["Rows", "সারি"],
  required: ["Required", "আবশ্যক"],
  status: ["Status", "অবস্থা"],
  yes: ["Yes", "হ্যাঁ"],
  no: ["No", "না"],
  ok: ["OK", "ঠিক"],
  empty: ["EMPTY", "খালি"],
  report: ["Report", "রিপোর্ট"],
  incomeIn: ["Income / In", "আয় / জমা"],
  expenseOut: ["Expense / Out", "ব্যয় / খরচ"],
  closingNet: ["Closing / Net", "সমাপনী / নিট"],
  cashBook: ["Cash Book (receipts)", "ক্যাশ বহি (রসিদ)"],
  handCash: ["Hand Cash", "হ্যান্ড ক্যাশ"],
  csIrr: ["Cash Statement (Irrigation)", "ক্যাশ স্টেটমেন্ট (সেচ)"],
  csSoc: ["Cash Statement (Society)", "ক্যাশ স্টেটমেন্ট (সমিতি)"],
};
const pick = (k: keyof typeof L) => (isBn() ? L[k][1] : L[k][0]);

const sb = supabase as any;

function currentFy() {
  const today = new Date();
  const y = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${y}-07-01`, to: `${y + 1}-06-30` };
}

const money = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export type CashTotals = {
  cashBookReceipts: number;
  handCash: { opening: number; income: number; expense: number; closing: number };
  irrigation: { totalIncome: number; totalExpense: number; closingFund: number };
  society: { totalIncome: number; totalExpense: number; closingFund: number };
};

export async function computeCashTotals(officeId?: string | null): Promise<CashTotals> {
  const { from, to } = currentFy();
  const scope = (q: any) => (officeId ? q.eq("office_id", officeId) : q);

  const [rcpt, pay, oi, ex, hc, sv, lp, bt, loans] = await Promise.all([
    scope(sb.from("receipts").select("amount,created_at")).gte("created_at", from).lte("created_at", `${to}T23:59:59`),
    scope(sb.from("payments").select("kind,amount,status,deleted_at,voided_at,created_at")).gte("created_at", from).lte("created_at", `${to}T23:59:59`),
    scope(sb.from("office_incomes").select("income_type,amount,stream,received_on")).gte("received_on", from).lte("received_on", to),
    scope(sb.from("expenses").select("head,amount,stream,expense_date,deleted_at")).is("deleted_at", null).gte("expense_date", from).lte("expense_date", to),
    scope(sb.from("hand_cash_submissions").select("opening_cash,total_income,total_expense,closing_cash")),
    scope(sb.from("savings_transactions").select("type,amount,created_at")).gte("created_at", from).lte("created_at", `${to}T23:59:59`),
    scope(sb.from("loan_payments").select("amount,created_at")).gte("created_at", from).lte("created_at", `${to}T23:59:59`),
    scope(sb.from("bank_transactions").select("txn_type,amount,txn_date")).gte("txn_date", from).lte("txn_date", to),
    scope(sb.from("loans").select("principal,created_at")).gte("created_at", from).lte("created_at", `${to}T23:59:59`),
  ]);

  const num = (v: any) => Number(v || 0);
  const payRows = (pay.data ?? []).filter((p: any) => !p.deleted_at && !p.voided_at && p.status !== "rejected");

  const irr = computeStatement(
    [...payRows, ...(oi.data ?? []).filter((o: any) => o.stream === "sech")],
    ex.data ?? [], 0, "bn",
  );
  const soc = computeSocietyStatement({
    savings: sv.data ?? [],
    loanPayments: lp.data ?? [],
    bankTx: bt.data ?? [],
    officeIncomes: (oi.data ?? []).filter((o: any) => o.stream !== "sech"),
    expenses: (ex.data ?? []).filter((e: any) => e.stream === "savings"),
    loansIssued: loans.data ?? [],
    opening: 0,
  }, "bn");

  const hcRows = hc.data ?? [];
  return {
    cashBookReceipts: (rcpt.data ?? []).reduce((s: number, r: any) => s + num(r.amount), 0),
    handCash: {
      opening: hcRows.reduce((s: number, r: any) => s + num(r.opening_cash), 0),
      income: hcRows.reduce((s: number, r: any) => s + num(r.total_income), 0),
      expense: hcRows.reduce((s: number, r: any) => s + num(r.total_expense), 0),
      closing: hcRows.reduce((s: number, r: any) => s + num(r.closing_cash), 0),
    },
    irrigation: { totalIncome: irr.totalIncome, totalExpense: irr.totalExpense, closingFund: irr.closingFund },
    society: { totalIncome: soc.totalIncome, totalExpense: soc.totalExpense, closingFund: soc.closingFund },
  };
}

export async function generateCashReportSummaryPdf(opts: {
  source: string;
  modules: string[];
  officeId?: string | null;
  counts?: CashCountRow[] | null;
}): Promise<Blob> {
  const counts = opts.counts ?? (await fetchCashReportCounts(opts.officeId));
  const totals = await computeCashTotals(opts.officeId);
  const mismatches = flagCashMismatches(counts);

  const doc = new jsPDF();
  // Register a proper Bangla-capable font so localized headers/labels render
  // correctly instead of falling back to ASCII boxes.
  const bn = isBn();
  const family = await ensureBanglaFont(doc);
  const setBody = () => { if (bn && family) doc.setFont(family, "normal"); else doc.setFont("helvetica", "normal"); };
  setBody();

  doc.setFontSize(16);
  doc.text(pick("title"), 14, 18);
  doc.setFontSize(10);
  doc.text(`${pick("source")}: ${opts.source}   ${pick("generated")}: ${new Date().toLocaleString()}`, 14, 26);
  doc.text(`${pick("modules")}: ${opts.modules.join(", ") || "-"}`, 14, 32);

  if (mismatches.length) {
    doc.setTextColor(200, 0, 0);
    doc.text(`${pick("warning")}: ${mismatches.map((m) => m.table).join(", ")}`, 14, 39);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(0, 140, 0);
    doc.text(pick("allOk"), 14, 39);
    doc.setTextColor(0, 0, 0);
  }

  const tableFont = bn && family ? family : "helvetica";
  autoTable(doc, {
    startY: 44,
    head: [[pick("table"), pick("rows"), pick("required"), pick("status")]],
    body: counts.map((r) => [r.table, String(r.count), r.required ? pick("yes") : pick("no"), r.ok ? pick("ok") : pick("empty")]),
    styles: { fontSize: 9, font: tableFont },
    headStyles: { fillColor: [40, 90, 160], font: tableFont },
  });

  const afterCounts = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: afterCounts,
    head: [[pick("report"), pick("incomeIn"), pick("expenseOut"), pick("closingNet")]],
    body: [
      [pick("cashBook"), money(totals.cashBookReceipts), "-", "-"],
      [pick("handCash"), money(totals.handCash.income), money(totals.handCash.expense), money(totals.handCash.closing)],
      [pick("csIrr"), money(totals.irrigation.totalIncome), money(totals.irrigation.totalExpense), money(totals.irrigation.closingFund)],
      [pick("csSoc"), money(totals.society.totalIncome), money(totals.society.totalExpense), money(totals.society.closingFund)],
    ],
    styles: { fontSize: 9, font: tableFont },
    headStyles: { fillColor: [40, 90, 160], font: tableFont },
  });

  return doc.output("blob");
}

// CSV variant: row counts, mismatch warnings, and the same totals.
export async function generateCashReportSummaryCsv(opts: {
  source: string;
  modules: string[];
  officeId?: string | null;
  counts?: CashCountRow[] | null;
}): Promise<Blob> {
  const counts = opts.counts ?? (await fetchCashReportCounts(opts.officeId));
  const totals = await computeCashTotals(opts.officeId);
  const mismatches = flagCashMismatches(counts);

  type Row = { section: string; a: string; b: string; c: string; d: string };
  const rows: Row[] = [];
  rows.push({ section: pick("source"), a: opts.source, b: pick("generated"), c: new Date().toLocaleString(), d: "" });
  rows.push({ section: pick("modules"), a: opts.modules.join(" | ") || "-", b: "", c: "", d: "" });
  rows.push({
    section: mismatches.length ? pick("warning") : pick("allOk"),
    a: mismatches.map((m) => m.table).join(" | "), b: "", c: "", d: "",
  });
  rows.push({ section: "", a: "", b: "", c: "", d: "" });
  rows.push({ section: pick("table"), a: pick("rows"), b: pick("required"), c: pick("status"), d: "" });
  for (const r of counts) {
    rows.push({ section: r.table, a: String(r.count), b: r.required ? pick("yes") : pick("no"), c: r.ok ? pick("ok") : pick("empty"), d: "" });
  }
  rows.push({ section: "", a: "", b: "", c: "", d: "" });
  rows.push({ section: pick("report"), a: pick("incomeIn"), b: pick("expenseOut"), c: pick("closingNet"), d: "" });
  rows.push({ section: pick("cashBook"), a: money(totals.cashBookReceipts), b: "-", c: "-", d: "" });
  rows.push({ section: pick("handCash"), a: money(totals.handCash.income), b: money(totals.handCash.expense), c: money(totals.handCash.closing), d: "" });
  rows.push({ section: pick("csIrr"), a: money(totals.irrigation.totalIncome), b: money(totals.irrigation.totalExpense), c: money(totals.irrigation.closingFund), d: "" });
  rows.push({ section: pick("csSoc"), a: money(totals.society.totalIncome), b: money(totals.society.totalExpense), c: money(totals.society.closingFund), d: "" });

  return rowsToCsvBlob(rows, [
    { header: pick("title"), accessor: (r) => r.section },
    { header: "1", accessor: (r) => r.a },
    { header: "2", accessor: (r) => r.b },
    { header: "3", accessor: (r) => r.c },
    { header: "4", accessor: (r) => r.d },
  ]);
}

export async function downloadCashReportSummaryCsv(opts: Parameters<typeof generateCashReportSummaryCsv>[0]) {
  const blob = await generateCashReportSummaryCsv(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cash-report-summary-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadCashReportSummaryPdf(opts: Parameters<typeof generateCashReportSummaryPdf>[0]) {
  const blob = await generateCashReportSummaryPdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cash-report-summary-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
