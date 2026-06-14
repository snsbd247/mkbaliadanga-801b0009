import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";

const sb = supabase as any;

type Stream = "irrigation" | "savings";

// Which receipt kinds feed which cash stream (income side) — must mirror Cashbook.tsx.
const STREAM_INCOME_KINDS: Record<Stream, Set<string>> = {
  irrigation: new Set(["irrigation", "bigha_rent", "pond", "crop_sale", "scrap"]),
  savings: new Set(["savings_deposit", "share", "loan_taken", "donation", "other"]),
};

const KIND_LABEL: Record<string, string> = {
  irrigation: "সেচ", bigha_rent: "বিঘা ভাড়া", pond: "পুকুর", crop_sale: "ফসল বিক্রি", scrap: "ভাঙারি",
  savings_deposit: "সঞ্চয় জমা", share: "শেয়ার", loan_taken: "হাওলাত", donation: "অনুদান", other: "অন্যান্য",
};

type AuditLine = { label: string; income: number; expense: number };

export default function CashAudit() {
  const { t, tx } = useLang();
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [openingManual, setOpeningManual] = useState<Record<Stream, number>>({
    irrigation: Number(localStorage.getItem("cb_open_irrigation") ?? 0),
    savings: Number(localStorage.getItem("cb_open_savings") ?? 0),
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fromYear = Number(from.slice(0, 4));
  const fromMonth = Number(from.slice(5, 7));

  // Auto-linked opening cash from cashbook submission for the month of `from`; falls back to manual.
  function subFor(stream: Stream) {
    return submissions.find(s => s.year === fromYear && s.month === fromMonth && s.stream === stream);
  }
  const opening: Record<Stream, number> = {
    irrigation: subFor("irrigation") ? Number(subFor("irrigation").opening_cash || 0) : openingManual.irrigation,
    savings: subFor("savings") ? Number(subFor("savings").opening_cash || 0) : openingManual.savings,
  };

  useEffect(() => { document.title = `${tx("Cash Audit", "ক্যাশ অডিট")} — MK Baliadanga`; }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [from, to]);

  async function load() {
    setLoading(true);
    try {
      const [rec, exp, subs] = await Promise.all([
        sb.from("receipts").select("kind,amount,receipt_date").gte("receipt_date", from).lte("receipt_date", to),
        sb.from("expenses").select("stream,head,amount,expense_date").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to),
        sb.from("cashbook_submissions").select("year,month,stream,opening_cash,closing_cash,locked").eq("year", fromYear).eq("month", fromMonth),
      ]);
      setReceipts(rec.data ?? []);
      setExpenses(exp.data ?? []);
      setSubmissions(subs.data ?? []);
    } finally { setLoading(false); }
  }

  function buildLines(stream: Stream): { lines: AuditLine[]; totalIncome: number; totalExpense: number } {
    const incomeKinds = STREAM_INCOME_KINDS[stream];
    const map = new Map<string, AuditLine>();
    const get = (label: string) => {
      const cur = map.get(label) ?? { label, income: 0, expense: 0 };
      map.set(label, cur);
      return cur;
    };
    let totalIncome = 0, totalExpense = 0;
    for (const r of receipts) {
      if (!incomeKinds.has(r.kind)) continue;
      const amt = Number(r.amount || 0);
      get(KIND_LABEL[r.kind] ?? r.kind).income += amt;
      totalIncome += amt;
    }
    for (const e of expenses) {
      if (e.stream !== stream) continue;
      const amt = Number(e.amount || 0);
      get(e.head || tx("Other expense", "অন্যান্য ব্যয়")).expense += amt;
      totalExpense += amt;
    }
    const lines = Array.from(map.values()).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
    return { lines, totalIncome, totalExpense };
  }

  const irrigation = useMemo(() => buildLines("irrigation"), [receipts, expenses]);
  const savings = useMemo(() => buildLines("savings"), [receipts, expenses]);

  function streamTitle(stream: Stream) {
    return stream === "irrigation" ? tx("Irrigation Audit", "সেচ অডিট") : tx("Savings Audit", "সেভিং অডিট");
  }

  function rowsFor(stream: Stream) {
    const d = stream === "irrigation" ? irrigation : savings;
    const open = Number(opening[stream] || 0);
    const closing = open + d.totalIncome - d.totalExpense;
    return { ...d, open, closing };
  }

  function exportPdf(stream: Stream) {
    const d = rowsFor(stream);
    const body: any[][] = [
      [tx("Opening cash", "প্রারম্ভিক ক্যাশ"), "", money(d.open)],
      ...d.lines.map(l => [l.label, l.income ? money(l.income) : "—", l.expense ? money(l.expense) : "—"]),
      [tx("Total", "মোট"), money(d.totalIncome), money(d.totalExpense)],
      [tx("Closing cash", "সমাপনী ক্যাশ"), "", money(d.closing)],
    ];
    exportTablePDF(streamTitle(stream), [tx("Description", "বিবরণ"), tx("Income", "আয়"), tx("Expense", "ব্যয়")], body, { from, to },
      { signatures: [tx("Prepared by", "প্রস্তুতকারী"), tx("Manager", "ম্যানেজার"), tx("President", "সভাপতি"), tx("Auditor", "নিরীক্ষক")] });
  }

  function exportXlsx(stream: Stream) {
    const d = rowsFor(stream);
    const rows = [
      { [tx("Description", "বিবরণ")]: tx("Opening cash", "প্রারম্ভিক ক্যাশ"), [tx("Income", "আয়")]: "", [tx("Expense", "ব্যয়")]: d.open },
      ...d.lines.map(l => ({ [tx("Description", "বিবরণ")]: l.label, [tx("Income", "আয়")]: l.income, [tx("Expense", "ব্যয়")]: l.expense })),
      { [tx("Description", "বিবরণ")]: tx("Total", "মোট"), [tx("Income", "আয়")]: d.totalIncome, [tx("Expense", "ব্যয়")]: d.totalExpense },
      { [tx("Description", "বিবরণ")]: tx("Closing cash", "সমাপনী ক্যাশ"), [tx("Income", "আয়")]: "", [tx("Expense", "ব্যয়")]: d.closing },
    ];
    exportExcel(`cash-audit-${stream}`, streamTitle(stream), rows, { from, to });
  }

  function AuditTable({ stream }: { stream: Stream }) {
    const d = rowsFor(stream);
    const sub = subFor(stream);
    const linked = !!sub;
    return (
      <>
        <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
          <div><Label>{tx("Opening cash", "প্রারম্ভিক ক্যাশ")}</Label>
            <Input type="number" value={opening[stream] || ""} disabled={linked} className="w-36"
              onChange={e => { const val = +e.target.value; setOpeningManual(prev => ({ ...prev, [stream]: val })); localStorage.setItem(`cb_open_${stream}`, String(val || 0)); }} />
            <div className="text-xs text-muted-foreground mt-1">
              {linked
                ? (sub.locked ? tx("Linked from cashbook (locked)", "ক্যাশবুক থেকে লিংক (লক করা)") : tx("Linked from cashbook", "ক্যাশবুক থেকে লিংক"))
                : tx("Manual (no cashbook submission)", "ম্যানুয়াল (ক্যাশবুক সাবমিশন নেই)")}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportPdf(stream)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" onClick={() => exportXlsx(stream)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          </div>
        </Card>
        <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><div className="text-xs text-muted-foreground">{tx("Opening", "প্রারম্ভিক")}</div><div className="text-lg font-bold">{money(d.open)}</div></div>
          <div><div className="text-xs text-muted-foreground">{tx("Income", "আয়")}</div><div className="text-lg font-bold text-success">{money(d.totalIncome)}</div></div>
          <div><div className="text-xs text-muted-foreground">{tx("Expense", "ব্যয়")}</div><div className="text-lg font-bold text-destructive">{money(d.totalExpense)}</div></div>
          <div><div className="text-xs text-muted-foreground">{tx("Closing", "সমাপনী")}</div><div className="text-lg font-bold text-primary">{money(d.closing)}</div></div>
        </Card>
        <Card className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>{tx("Description", "বিবরণ")}</TableHead>
            <TableHead className="text-right">{tx("Income", "আয়")}</TableHead>
            <TableHead className="text-right">{tx("Expense", "ব্যয়")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell>{tx("Opening cash", "প্রারম্ভিক ক্যাশ")}</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right font-semibold">{money(d.open)}</TableCell>
            </TableRow>
            {d.lines.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">{tx("No data in this period", "এই সময়ে কোনো তথ্য নেই")}</TableCell></TableRow>
            )}
            {d.lines.map((l) => (
              <TableRow key={l.label}>
                <TableCell>{l.label}</TableCell>
                <TableCell className="text-right text-success">{l.income ? money(l.income) : "—"}</TableCell>
                <TableCell className="text-right text-destructive">{l.expense ? money(l.expense) : "—"}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/60 font-bold">
              <TableCell>{tx("Total", "মোট")}</TableCell>
              <TableCell className="text-right text-success">{money(d.totalIncome)}</TableCell>
              <TableCell className="text-right text-destructive">{money(d.totalExpense)}</TableCell>
            </TableRow>
            <TableRow className="bg-primary/10 font-bold">
              <TableCell>{tx("Closing cash", "সমাপনী ক্যাশ")}</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right text-primary">{money(d.closing)}</TableCell>
            </TableRow>
          </TableBody>
        </Table></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={tx("Cash Audit", "ক্যাশ অডিট")} description={tx("Irrigation & savings audit from cashbook data", "ক্যাশবুক থেকে সেচ ও সেভিং অডিট")} />
      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        {loading && <span className="text-muted-foreground text-sm">{t("loading")}</span>}
      </Card>
      <Tabs defaultValue="irrigation">
        <TabsList>
          <TabsTrigger value="irrigation">{tx("Irrigation Audit", "সেচ অডিট")}</TabsTrigger>
          <TabsTrigger value="savings">{tx("Savings Audit", "সেভিং অডিট")}</TabsTrigger>
        </TabsList>
        <TabsContent value="irrigation"><AuditTable stream="irrigation" /></TabsContent>
        <TabsContent value="savings"><AuditTable stream="savings" /></TabsContent>
      </Tabs>
    </>
  );
}
