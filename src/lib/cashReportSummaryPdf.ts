// Generates a downloadable PDF summary after a QuickSeed / DemoManager run:
// per-table row counts, mismatch warnings, and the totals rendered for
// Cash Book, Hand Cash and Cash Statement (Irrigation + Society).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fetchCashReportCounts, flagCashMismatches, type CashCountRow } from "@/lib/cashReportBackup";
import { computeStatement } from "@/lib/irrigationCashStatement";
import { computeSocietyStatement } from "@/lib/societyCashStatement";

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
  doc.setFontSize(16);
  doc.text("Cash Report Demo Summary", 14, 18);
  doc.setFontSize(10);
  doc.text(`Source: ${opts.source}   Generated: ${new Date().toLocaleString()}`, 14, 26);
  doc.text(`Modules: ${opts.modules.join(", ") || "-"}`, 14, 32);

  if (mismatches.length) {
    doc.setTextColor(200, 0, 0);
    doc.text(`WARNING: ${mismatches.length} required table(s) empty: ${mismatches.map((m) => m.table).join(", ")}`, 14, 39);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(0, 140, 0);
    doc.text("Validation: all required tables populated.", 14, 39);
    doc.setTextColor(0, 0, 0);
  }

  autoTable(doc, {
    startY: 44,
    head: [["Table", "Rows", "Required", "Status"]],
    body: counts.map((r) => [r.table, String(r.count), r.required ? "Yes" : "No", r.ok ? "OK" : "EMPTY"]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 90, 160] },
  });

  const afterCounts = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: afterCounts,
    head: [["Report", "Income / In", "Expense / Out", "Closing / Net"]],
    body: [
      ["Cash Book (receipts)", money(totals.cashBookReceipts), "-", "-"],
      ["Hand Cash", money(totals.handCash.income), money(totals.handCash.expense), money(totals.handCash.closing)],
      ["Cash Statement (Irrigation)", money(totals.irrigation.totalIncome), money(totals.irrigation.totalExpense), money(totals.irrigation.closingFund)],
      ["Cash Statement (Society)", money(totals.society.totalIncome), money(totals.society.totalExpense), money(totals.society.closingFund)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 90, 160] },
  });

  return doc.output("blob");
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
