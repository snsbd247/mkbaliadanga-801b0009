import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet, Link2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";

const sb = supabase as any;

type Stream = "irrigation" | "savings";
type Orientation = "portrait" | "landscape";

// Optional/extra columns the user can toggle for the exported & on-screen report.
type ColKey = "sl" | "description" | "income" | "expense" | "balance";
const ALL_COLS: { key: ColKey; en: string; bn: string; default: boolean }[] = [
  { key: "sl", en: "Sl", bn: "ক্রমিক", default: true },
  { key: "description", en: "Description", bn: "বিবরণ", default: true },
  { key: "income", en: "Income", bn: "আয়", default: true },
  { key: "expense", en: "Expense", bn: "ব্যয়", default: true },
  { key: "balance", en: "Running balance", bn: "চলতি জের", default: false },
];

// Which receipt kinds feed which cash stream (income side) — must mirror Cashbook.tsx.
const STREAM_INCOME_KINDS: Record<Stream, Set<string>> = {
  irrigation: new Set(["irrigation", "bigha_rent", "pond", "crop_sale", "scrap"]),
  savings: new Set(["savings_deposit", "share", "loan_taken", "donation", "other"]),
};

const KIND_LABEL: Record<string, string> = {
  irrigation: "সেচ", bigha_rent: "বিঘা ভাড়া", pond: "পুকুর", crop_sale: "ফসল বিক্রি", scrap: "ভাঙারি",
  savings_deposit: "সঞ্চয় জমা", share: "শেয়ার", loan_taken: "হাওলাত", donation: "অনুদান", other: "অন্যান্য",
};

type AuditLine = { label: string; income: number; expense: number; linked: boolean };

export default function CashAudit() {
  const { t, tx } = useLang();
  const { officeId: myOffice } = useAuth();
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);
  const [office, setOffice] = useState<string>("");        // "" = all offices I can see
  const [offices, setOffices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [openingManual, setOpeningManual] = useState<Record<Stream, number>>({
    irrigation: Number(localStorage.getItem("cb_open_irrigation") ?? 0),
    savings: Number(localStorage.getItem("cb_open_savings") ?? 0),
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // A4 orientation, persisted in settings (localStorage).
  const [orientation, setOrientation] = useState<Orientation>(
    (localStorage.getItem("cash_audit_orientation") as Orientation) || "portrait"
  );
  // Column customization, persisted.
  const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cash_audit_cols") || "null");
      if (saved) return saved;
    } catch { /* ignore */ }
    return Object.fromEntries(ALL_COLS.map(c => [c.key, c.default])) as Record<ColKey, boolean>;
  });

  const fromYear = Number(from.slice(0, 4));
  const fromMonth = Number(from.slice(5, 7));

  // Cash-month quick selector: snaps from/to to the chosen calendar month.
  const cashMonth = `${from.slice(0, 7)}`;
  function setCashMonth(ym: string) {
    if (!ym) return;
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    setFrom(`${ym}-01`);
    setTo(`${ym}-${String(last).padStart(2, "0")}`);
  }

  function subFor(stream: Stream) {
    return submissions.find(s => s.year === fromYear && s.month === fromMonth && s.stream === stream);
  }
  const opening: Record<Stream, number> = {
    irrigation: subFor("irrigation") ? Number(subFor("irrigation").opening_cash || 0) : openingManual.irrigation,
    savings: subFor("savings") ? Number(subFor("savings").opening_cash || 0) : openingManual.savings,
  };

  useEffect(() => { document.title = `${tx("Cash Audit", "ক্যাশ অডিট")} — MK Baliadanga`; }, []);
  useEffect(() => {
    (async () => {
      const { data } = await sb.from("offices").select("id,name").order("name");
      setOffices(data ?? []);
    })();
  }, []);
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [from, to, office]);

  useEffect(() => { localStorage.setItem("cash_audit_orientation", orientation); }, [orientation]);
  useEffect(() => { localStorage.setItem("cash_audit_cols", JSON.stringify(cols)); }, [cols]);

  async function load() {
    setLoading(true);
    try {
      let recQ = sb.from("receipts").select("kind,amount,receipt_date,office_id").gte("receipt_date", from).lte("receipt_date", to);
      let expQ = sb.from("expenses").select("stream,head,amount,expense_date,office_id").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to);
      if (office) { recQ = recQ.eq("office_id", office); expQ = expQ.eq("office_id", office); }
      const [rec, exp, subs] = await Promise.all([
        recQ,
        expQ,
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
      const cur = map.get(label) ?? { label, income: 0, expense: 0, linked: true };
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

  const activeCols = ALL_COLS.filter(c => cols[c.key]);
  function colHeaders() { return activeCols.map(c => tx(c.en, c.bn)); }

  // Compute one report row (array, in active-column order) for a given line / running balance.
  function lineCells(c: { sl: string; label: string; income: number | string; expense: number | string; balance: number | string }) {
    return activeCols.map(col => {
      switch (col.key) {
        case "sl": return c.sl;
        case "description": return c.label;
        case "income": return typeof c.income === "number" ? (c.income ? money(c.income) : "—") : c.income;
        case "expense": return typeof c.expense === "number" ? (c.expense ? money(c.expense) : "—") : c.expense;
        case "balance": return typeof c.balance === "number" ? money(c.balance) : c.balance;
      }
    });
  }

  function buildBody(stream: Stream) {
    const d = rowsFor(stream);
    let sl = 0;
    let running = d.open;
    const body: any[][] = [];
    body.push(lineCells({ sl: "", label: tx("Opening cash", "প্রারম্ভিক ক্যাশ"), income: "—", expense: "—", balance: d.open }));
    for (const l of d.lines) {
      running += l.income - l.expense;
      body.push(lineCells({ sl: String(++sl), label: l.label, income: l.income, expense: l.expense, balance: running }));
    }
    body.push(lineCells({ sl: "", label: tx("Total", "মোট"), income: d.totalIncome, expense: d.totalExpense, balance: "" }));
    body.push(lineCells({ sl: "", label: tx("Closing cash", "সমাপনী ক্যাশ"), income: "—", expense: "—", balance: d.closing }));
    return body;
  }

  function exportPdf(stream: Stream) {
    exportTablePDF(streamTitle(stream), colHeaders(), buildBody(stream), { from, to },
      {
        landscape: orientation === "landscape",
        signatures: [tx("Prepared by", "প্রস্তুতকারী"), tx("Manager", "ম্যানেজার"), tx("President", "সভাপতি"), tx("Auditor", "নিরীক্ষক")],
      });
  }

  function exportXlsx(stream: Stream) {
    const headers = colHeaders();
    const rows = buildBody(stream).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
    exportExcel(`cash-audit-${stream}`, streamTitle(stream), rows, { from, to });
  }

  function AuditTable({ stream }: { stream: Stream }) {
    const d = rowsFor(stream);
    const sub = subFor(stream);
    const linked = !!sub;
    let running = d.open;
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
            <Button size="sm" variant="outline" onClick={() => exportPdf(stream)}><FileDown className="h-4 w-4 mr-1" />PDF (A4 {orientation === "landscape" ? tx("Landscape", "ল্যান্ডস্কেপ") : tx("Portrait", "পোর্ট্রেট")})</Button>
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
            {cols.balance && <TableHead className="text-right">{tx("Running balance", "চলতি জের")}</TableHead>}
            <TableHead>{tx("Source", "উৎস")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell>{tx("Opening cash", "প্রারম্ভিক ক্যাশ")}</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right font-semibold">{money(d.open)}</TableCell>
              {cols.balance && <TableCell className="text-right">{money(d.open)}</TableCell>}
              <TableCell>
                {linked
                  ? <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" />{tx("Linked from cashbook", "ক্যাশবুক থেকে লিংক")}</Badge>
                  : <span className="text-xs text-muted-foreground">{tx("Manual", "ম্যানুয়াল")}</span>}
              </TableCell>
            </TableRow>
            {d.lines.length === 0 && (
              <TableRow><TableCell colSpan={cols.balance ? 5 : 4} className="text-center py-6 text-muted-foreground">{tx("No data in this period", "এই সময়ে কোনো তথ্য নেই")}</TableCell></TableRow>
            )}
            {d.lines.map((l) => {
              running += l.income - l.expense;
              return (
                <TableRow key={l.label}>
                  <TableCell>{l.label}</TableCell>
                  <TableCell className="text-right text-success">{l.income ? money(l.income) : "—"}</TableCell>
                  <TableCell className="text-right text-destructive">{l.expense ? money(l.expense) : "—"}</TableCell>
                  {cols.balance && <TableCell className="text-right">{money(running)}</TableCell>}
                  <TableCell><Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" />{tx("Linked from cashbook", "ক্যাশবুক থেকে লিংক")}</Badge></TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/60 font-bold">
              <TableCell>{tx("Total", "মোট")}</TableCell>
              <TableCell className="text-right text-success">{money(d.totalIncome)}</TableCell>
              <TableCell className="text-right text-destructive">{money(d.totalExpense)}</TableCell>
              {cols.balance && <TableCell />}
              <TableCell />
            </TableRow>
            <TableRow className="bg-primary/10 font-bold">
              <TableCell>{tx("Closing cash", "সমাপনী ক্যাশ")}</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right text-primary">{money(d.closing)}</TableCell>
              {cols.balance && <TableCell className="text-right text-primary">{money(d.closing)}</TableCell>}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={tx("Cash Audit", "ক্যাশ অডিট")} description={tx("Irrigation & savings audit from cashbook data", "ক্যাশবুক থেকে সেচ ও সেভিং অডিট")} />

      {/* Shared filters — apply to both tabs and to PDF/Excel export */}
      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div><Label>{tx("Cash month", "ক্যাশ মাস")}</Label>
          <Input type="month" value={cashMonth} onChange={e => setCashMonth(e.target.value)} className="w-40" /></div>
        <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div><Label>{tx("Office", "অফিস")}</Label>
          <Select value={office || "all"} onValueChange={v => setOffice(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
              {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading && <span className="text-muted-foreground text-sm">{t("loading")}</span>}
      </Card>

      {/* Report customization — orientation + columns (applied on screen + export) */}
      <Card className="p-3 mb-3 flex flex-wrap items-end gap-6">
        <div>
          <Label className="block mb-1">{tx("PDF page (A4)", "পিডিএফ পেজ (A4)")}</Label>
          <Select value={orientation} onValueChange={v => setOrientation(v as Orientation)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">{tx("A4 Portrait", "A4 পোর্ট্রেট")}</SelectItem>
              <SelectItem value="landscape">{tx("A4 Landscape", "A4 ল্যান্ডস্কেপ")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="block mb-1">{tx("Report columns", "রিপোর্ট কলাম")}</Label>
          <div className="flex flex-wrap gap-3">
            {ALL_COLS.map(c => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!cols[c.key]} disabled={c.key === "description"}
                  onCheckedChange={v => setCols(prev => ({ ...prev, [c.key]: !!v }))} />
                {tx(c.en, c.bn)}
              </label>
            ))}
          </div>
        </div>
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
