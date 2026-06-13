import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet } from "lucide-react";

const sb = supabase as any;

type DayRow = { date: string; opening: number; income: number; expense: number; closing: number };

export default function HandCash() {
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);
  const [openingBalance, setOpeningBalance] = useState<number>(() => Number(localStorage.getItem("handcash_opening") ?? 0));
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => { document.title = "হ্যান্ড ক্যাশ — MK Baliadanga"; }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  async function load() {
    const [rec, exp] = await Promise.all([
      sb.from("receipts").select("receipt_date,amount").gte("receipt_date", from).lte("receipt_date", to),
      sb.from("expenses").select("expense_date,amount").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to),
    ]);
    setReceipts(rec.data ?? []);
    setExpenses(exp.data ?? []);
  }

  function saveOpening(v: number) {
    setOpeningBalance(v);
    localStorage.setItem("handcash_opening", String(v || 0));
  }

  const rows: DayRow[] = useMemo(() => {
    const incomeByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    receipts.forEach((r: any) => {
      const d = String(r.receipt_date).slice(0, 10);
      incomeByDay.set(d, (incomeByDay.get(d) ?? 0) + Number(r.amount || 0));
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
      out.push({ date: d, opening, income, expense, closing });
      opening = closing;
    }
    return out;
  }, [receipts, expenses, openingBalance]);

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const finalClosing = rows.length ? rows[rows.length - 1].closing : openingBalance;

  function exportPdf() {
    exportTablePDF("হ্যান্ড ক্যাশ", ["তারিখ", "প্রারম্ভিক জমা", "আয়", "ব্যয়", "সমাপনী"],
      rows.map(r => [fmtDate(r.date), r.opening, r.income, r.expense, r.closing]), { from, to });
  }
  function exportXlsx() {
    exportExcel("hand-cash", "HandCash",
      rows.map(r => ({ "তারিখ": r.date, "প্রারম্ভিক জমা": r.opening, "আয়": r.income, "ব্যয়": r.expense, "সমাপনী": r.closing })), { from, to });
  }

  return (
    <>
      <PageHeader title="হ্যান্ড ক্যাশ" description="ক্যাশবুক থেকে দৈনিক নগদ হিসাব" />

      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div><Label>প্রারম্ভিক জমা</Label><Input type="number" value={openingBalance || ""} onChange={e => saveOpening(+e.target.value)} className="w-36" /></div>
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </Card>

      <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><div className="text-xs text-muted-foreground">প্রারম্ভিক জমা</div><div className="text-lg font-bold">{money(openingBalance)}</div></div>
        <div><div className="text-xs text-muted-foreground">মোট আয়</div><div className="text-lg font-bold text-success">{money(totalIncome)}</div></div>
        <div><div className="text-xs text-muted-foreground">মোট ব্যয়</div><div className="text-lg font-bold text-destructive">{money(totalExpense)}</div></div>
        <div><div className="text-xs text-muted-foreground">সমাপনী জমা</div><div className="text-lg font-bold text-primary">{money(finalClosing)}</div></div>
      </Card>

      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>তারিখ</TableHead>
          <TableHead className="text-right">প্রারম্ভিক জমা</TableHead>
          <TableHead className="text-right">আয়</TableHead>
          <TableHead className="text-right">ব্যয়</TableHead>
          <TableHead className="text-right">সমাপনী</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">এই সময়ে কোনো লেনদেন নেই</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.date}>
              <TableCell>{fmtDate(r.date)}</TableCell>
              <TableCell className="text-right">{money(r.opening)}</TableCell>
              <TableCell className="text-right text-success">{r.income ? money(r.income) : "—"}</TableCell>
              <TableCell className="text-right text-destructive">{r.expense ? money(r.expense) : "—"}</TableCell>
              <TableCell className="text-right font-semibold text-primary">{money(r.closing)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-muted/60 font-bold">
              <TableCell className="text-right">মোট</TableCell>
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
