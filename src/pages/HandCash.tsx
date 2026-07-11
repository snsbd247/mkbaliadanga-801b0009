import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Lock, Unlock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

const sb = db as any;

type DayRow = { date: string; opening: number; income: number; expense: number; closing: number; receiptFrom: string; receiptTo: string };

const receiptNum = (s: unknown) => {
  const m = String(s ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
};

const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

export default function HandCash() {
  const { user, isAdmin, isSuper, officeId } = useAuth();
  const { tx, lang } = useLang();
  const MONTHS = lang === "bn" ? MONTHS_BN : ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any | null>(null);

  const mFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const mTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  useEffect(() => { document.title = `${tx("Hand Cash", "হ্যান্ড ক্যাশ")} — MK Baliadanga`; }, [lang]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  async function load() {
    const [rec, exp, sub] = await Promise.all([
      sb.from("receipts").select("receipt_date,amount,receipt_no").gte("receipt_date", mFrom).lte("receipt_date", mTo).limit(20000),
      sb.from("expenses").select("expense_date,amount").is("deleted_at", null).gte("expense_date", mFrom).lte("expense_date", mTo).limit(20000),
      sb.from("hand_cash_submissions").select("*").eq("year", year).eq("month", month).is("office_id", officeId ?? null).maybeSingle(),
    ]);
    setReceipts(rec.data ?? []);
    setExpenses(exp.data ?? []);
    setSubmission(sub.data ?? null);
    if (sub.data) {
      setOpeningBalance(Number(sub.data.opening_cash || 0));
    } else {
      // Auto-carry: opening = previous month's submitted closing, fallback 0.
      const pm = month === 1 ? 12 : month - 1;
      const py = month === 1 ? year - 1 : year;
      const { data: prev } = await sb.from("hand_cash_submissions").select("closing_cash").eq("year", py).eq("month", pm).is("office_id", officeId ?? null).maybeSingle();
      setOpeningBalance(prev ? Number(prev.closing_cash || 0) : 0);
    }
  }

  const locked = !!submission?.locked;

  const rows: DayRow[] = useMemo(() => {
    const incomeByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const receiptNosByDay = new Map<string, number[]>();
    receipts.forEach((r: any) => {
      const d = String(r.receipt_date).slice(0, 10);
      incomeByDay.set(d, (incomeByDay.get(d) ?? 0) + Number(r.amount || 0));
      const num = receiptNum(r.receipt_no);
      if (!Number.isNaN(num)) {
        const arr = receiptNosByDay.get(d) ?? [];
        arr.push(num);
        receiptNosByDay.set(d, arr);
      }
    });
    expenses.forEach((e: any) => {
      const d = String(e.expense_date).slice(0, 10);
      expenseByDay.set(d, (expenseByDay.get(d) ?? 0) + Number(e.amount || 0));
    });
    const days = Array.from(new Set([...incomeByDay.keys(), ...expenseByDay.keys()])).sort();
    let opening = openingBalance;
    const out: DayRow[] = [];
    for (const d of days) {
      const income = incomeByDay.get(d) ?? 0;
      const expense = expenseByDay.get(d) ?? 0;
      const closing = opening + income - expense;
      const nos = (receiptNosByDay.get(d) ?? []).sort((a, b) => a - b);
      const receiptFrom = nos.length ? String(nos[0]) : "";
      const receiptTo = nos.length ? String(nos[nos.length - 1]) : "";
      out.push({ date: d, opening, income, expense, closing, receiptFrom, receiptTo });
      opening = closing;
    }
    return out;
  }, [receipts, expenses, openingBalance]);


  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const finalClosing = rows.length ? rows[rows.length - 1].closing : openingBalance;

  async function submitMonth() {
    if (locked) return toast.error(tx("This month is already submitted/locked", "এই মাস ইতিমধ্যে সাবমিট/লক করা"));
    if (!confirm(`${MONTHS[month - 1]} ${year} — ${tx("Final submit hand cash? Opening balance will be locked.", "হ্যান্ড ক্যাশ ফাইনাল সাবমিট করবেন? এরপর প্রারম্ভিক জমা লক হয়ে যাবে।")}`)) return;
    const payload = {
      office_id: officeId ?? null, year, month,
      opening_cash: openingBalance, total_income: totalIncome, total_expense: totalExpense,
      closing_cash: finalClosing, locked: true, submitted_by: user?.id, submitted_at: new Date().toISOString(),
    };
    const { error } = await sb.from("hand_cash_submissions").upsert(payload, { onConflict: "office_id,year,month" });
    if (error) return toast.error(error.message);
    toast.success(tx("Submitted", "সাবমিট হয়েছে"));
    load();
  }

  async function saveOpeningDraft() {
    if (locked) return;
    const payload = {
      office_id: officeId ?? null, year, month,
      opening_cash: openingBalance, total_income: totalIncome, total_expense: totalExpense,
      closing_cash: finalClosing, locked: false,
    };
    const { error } = await sb.from("hand_cash_submissions").upsert(payload, { onConflict: "office_id,year,month" });
    if (error) return toast.error(error.message);
    toast.success(tx("Opening balance saved", "প্রারম্ভিক জমা সংরক্ষিত"));
    load();
  }

  async function unlockMonth() {
    if (!submission?.id) return;
    const { error } = await sb.from("hand_cash_submissions").update({ locked: false }).eq("id", submission.id);
    if (error) return toast.error(error.message);
    toast.success(tx("Unlocked", "আনলক হয়েছে"));
    load();
  }

  const rangeLabel = (r: DayRow) => (r.receiptFrom ? (r.receiptFrom === r.receiptTo ? r.receiptFrom : `${r.receiptFrom}–${r.receiptTo}`) : "—");
  function exportPdf() {
    exportTablePDF(tx("Hand Cash", "হ্যান্ড ক্যাশ"), [tx("Date", "তারিখ"), tx("Receipt no.", "রশিদ নং"), tx("Opening balance", "প্রারম্ভিক জমা"), tx("Income", "আয়"), tx("Expense", "ব্যয়"), tx("Closing", "সমাপনী")],
      rows.map(r => [fmtDate(r.date), rangeLabel(r), r.opening, r.income, r.expense, r.closing]), { from: mFrom, to: mTo });
  }
  function exportXlsx() {
    exportExcel("hand-cash", "HandCash",
      rows.map(r => ({ "তারিখ": r.date, "রশিদ নং": rangeLabel(r), "প্রারম্ভিক জমা": r.opening, "আয়": r.income, "ব্যয়": r.expense, "সমাপনী": r.closing })), { from: mFrom, to: mTo });
  }


  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - i);

  return (
    <>
      <PageHeader title={tx("Hand Cash", "হ্যান্ড ক্যাশ")} description={tx("Daily cash account from cashbook (monthly)", "ক্যাশবুক থেকে দৈনিক নগদ হিসাব (মাসিক)")} />

      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div>
          <Label>{tx("Year", "বছর")}</Label>
          <select className="block h-9 rounded-md border bg-background px-2 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <Label>{tx("Month", "মাস")}</Label>
          <select className="block h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <Label>{tx("Opening balance", "প্রারম্ভিক জমা")}</Label>
          <Input type="number" value={openingBalance || ""} disabled={locked} onChange={e => setOpeningBalance(+e.target.value)} className="w-36" />
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {locked
            ? <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> {tx("Locked", "লক করা")}</Badge>
            : <Button size="sm" variant="outline" onClick={saveOpeningDraft}>{tx("Save", "সংরক্ষণ")}</Button>}
          {!locked && <Button size="sm" onClick={submitMonth}><CheckCircle2 className="h-4 w-4 mr-1" />{tx("Final submit", "ফাইনাল সাবমিট")}</Button>}
          {locked && (isAdmin || isSuper) && <Button size="sm" variant="outline" onClick={unlockMonth}><Unlock className="h-4 w-4 mr-1" />{tx("Unlock", "আনলক")}</Button>}
          <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </Card>

      <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><div className="text-xs text-muted-foreground">{tx("Opening balance", "প্রারম্ভিক জমা")}</div><div className="text-lg font-bold">{money(openingBalance)}</div></div>
        <div><div className="text-xs text-muted-foreground">{tx("Total income", "মোট আয়")}</div><div className="text-lg font-bold text-success">{money(totalIncome)}</div></div>
        <div><div className="text-xs text-muted-foreground">{tx("Total expense", "মোট ব্যয়")}</div><div className="text-lg font-bold text-destructive">{money(totalExpense)}</div></div>
        <div><div className="text-xs text-muted-foreground">{tx("Closing balance", "সমাপনী জমা")}</div><div className="text-lg font-bold text-primary">{money(finalClosing)}</div></div>
      </Card>

      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>{tx("Date", "তারিখ")}</TableHead>
          <TableHead>{tx("Receipt no.", "রশিদ নং")}</TableHead>
          <TableHead className="text-right">{tx("Opening balance", "প্রারম্ভিক জমা")}</TableHead>
          <TableHead className="text-right">{tx("Income", "আয়")}</TableHead>
          <TableHead className="text-right">{tx("Expense", "ব্যয়")}</TableHead>
          <TableHead className="text-right">{tx("Closing", "সমাপনী")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{tx("No transactions this month", "এই মাসে কোনো লেনদেন নেই")}</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.date}>
              <TableCell>{fmtDate(r.date)}</TableCell>
              <TableCell>{rangeLabel(r)}</TableCell>
              <TableCell className="text-right">{money(r.opening)}</TableCell>
              <TableCell className="text-right text-success">{r.income ? money(r.income) : "—"}</TableCell>
              <TableCell className="text-right text-destructive">{r.expense ? money(r.expense) : "—"}</TableCell>
              <TableCell className="text-right font-semibold text-primary">{money(r.closing)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-muted/60 font-bold">
              <TableCell className="text-right" colSpan={2}>{tx("Total", "মোট")}</TableCell>
              <TableCell />
              <TableCell className="text-right text-success">{money(totalIncome)}</TableCell>
              <TableCell className="text-right text-destructive">{money(totalExpense)}</TableCell>
              <TableCell className="text-right text-primary">{money(finalClosing)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table></Card>
    </>
  );
}
