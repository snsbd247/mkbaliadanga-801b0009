import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadCsv } from "@/lib/csvExport";
import { auditExport } from "@/lib/audit";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  buildCashBook, summarizeCashBook, validateHistoricalEntry,
  type CashEntry, type CashBookRow,
} from "@/lib/irrigationCashBookLedger";

const sb = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

export default function IrrigationCashBookLedgerPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const tx = (en: string, bn: string) => (lang === "bn" ? bn : en);

  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [opening, setOpening] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [lockedThrough, setLockedThrough] = useState<string | null>(null);

  // Historical entry form
  const [hDate, setHDate] = useState<string>(today());
  const [hDir, setHDir] = useState<"in" | "out">("in");
  const [hAmount, setHAmount] = useState<string>("");
  const [hHead, setHHead] = useState<string>("");
  const [hError, setHError] = useState<{ en: string; bn: string } | null>(null);

  useEffect(() => {
    sb.from("offices").select("id,name").order("name").then(({ data }: any) => {
      setOffices(data ?? []);
      if (data?.[0]) setOfficeId(data[0].id);
    });
  }, []);

  async function load() {
    if (!officeId) return;
    setLoading(true);
    try {
      let pq = sb.from("irrigation_invoice_payments")
        .select("collected_amount,created_at,payments(receipt_no,method)").eq("office_id", officeId).gt("collected_amount", 0);
      if (from) pq = pq.gte("created_at", from);
      if (to) pq = pq.lte("created_at", `${to}T23:59:59`);
      const { data: pays } = await pq;

      let eq = sb.from("expenses")
        .select("amount,expense_date,head,note").eq("office_id", officeId).is("deleted_at", null);
      if (from) eq = eq.gte("expense_date", from);
      if (to) eq = eq.lte("expense_date", to);
      const { data: exps } = await eq;

      const next: CashEntry[] = [];
      for (const p of (pays ?? []) as any[])
        next.push({ date: String(p.created_at).slice(0, 10), direction: "in", amount: Number(p.collected_amount || 0), head: p.payments?.method ?? tx("Irrigation collection", "সেচ আদায়"), ref: p.payments?.receipt_no ?? null });
      for (const e of exps ?? [])
        next.push({ date: String(e.expense_date).slice(0, 10), direction: "out", amount: Number(e.amount || 0), head: e.head ?? tx("Expense", "খরচ"), ref: e.note });
      setEntries(next);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to load", "লোড করা যায়নি"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [officeId, from, to]);

  const rows = useMemo(() => buildCashBook(entries, opening), [entries, opening]);
  const report = useMemo(() => summarizeCashBook(rows, opening), [rows, opening]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.date, r.head, r.ref].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, search]);

  // Reconciliation: in-rows must equal sum of live receipts (Step 5/6 already
  // excluded voided rows at fetch). Flag if any amount is negative/NaN.
  const recon = useMemo(() => {
    const bad = entries.filter((e) => !(Number(e.amount) >= 0));
    const inTotal = entries.filter((e) => e.direction === "in").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { ok: bad.length === 0, badCount: bad.length, receiptsTotal: Math.round(inTotal * 100) / 100 };
  }, [entries]);

  function addHistorical() {
    const amt = parseFloat(hAmount);
    const check = validateHistoricalEntry({ date: hDate, amount: amt, direction: hDir }, lockedThrough, today());
    if (!check.ok) { setHError(check.error!); return; }
    setHError(null);
    setEntries((prev) => [...prev, { date: hDate, direction: hDir, amount: amt, head: hHead || tx("Historical entry", "পূর্ববর্তী এন্ট্রি"), ref: null }]);
    setHAmount(""); setHHead("");
    toast.success(tx("Entry added — balance updated", "এন্ট্রি যোগ হয়েছে — ব্যালেন্স আপডেট"));
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      [tx("Date", "তারিখ")]: r.date,
      [tx("Head", "খাত")]: r.head ?? "",
      [tx("Ref", "রেফ")]: r.ref ?? "",
      [tx("Debit (In)", "জমা")]: r.debit,
      [tx("Credit (Out)", "খরচ")]: r.credit,
      [tx("Balance", "ব্যালেন্স")]: r.balance,
    })));
    XLSX.utils.sheet_add_aoa(ws, [
      [], [tx("Opening", "প্রারম্ভিক"), report.opening], [tx("Total In", "মোট জমা"), report.total_in],
      [tx("Total Out", "মোট খরচ"), report.total_out], [tx("Closing", "সমাপনী"), report.closing],
    ], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CashBook");
    XLSX.writeFile(wb, `cashbook-${officeId}-${from || "all"}.xlsx`);
  }

  function exportCsv() {
    downloadCsv(`cashbook-${officeId}.csv`, rows, [
      { header: tx("Date", "তারিখ"), accessor: (r: CashBookRow) => r.date },
      { header: tx("Head", "খাত"), accessor: (r: CashBookRow) => r.head ?? "" },
      { header: tx("Debit", "জমা"), accessor: (r: CashBookRow) => r.debit },
      { header: tx("Credit", "খরচ"), accessor: (r: CashBookRow) => r.credit },
      { header: tx("Balance", "ব্যালেন্স"), accessor: (r: CashBookRow) => r.balance },
    ] as any);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text(tx("Irrigation Cash Book", "সেচ ক্যাশ বুক"), 14, 16);
    autoTable(doc, {
      startY: 24,
      head: [[tx("Date", "Date"), tx("Head", "Head"), tx("In", "In"), tx("Out", "Out"), tx("Balance", "Balance")]],
      body: rows.map((r) => [r.date, r.head ?? "", String(r.debit), String(r.credit), String(r.balance)]),
      foot: [
        [tx("Opening", "Opening"), "", "", "", String(report.opening)],
        [tx("Totals", "Totals"), "", String(report.total_in), String(report.total_out), ""],
        [tx("Closing", "Closing"), "", "", "", String(report.closing)],
      ],
    });
    doc.save(`cashbook-${officeId}.pdf`);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Cash Book (Ledger)", "ক্যাশ বুক (লেজার)")} />

      <Card className="p-4 grid gap-3 md:grid-cols-5 items-end">
        <div>
          <Label>{tx("Office", "অফিস")}</Label>
          <Select value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger><SelectValue placeholder={tx("Select", "নির্বাচন")} /></SelectTrigger>
            <SelectContent>
              {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{tx("From", "শুরু")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("To", "শেষ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>{tx("Opening balance", "প্রারম্ভিক")}</Label><Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value) || 0)} /></div>
        <div><Label>{tx("Search", "খুঁজুন")}</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("date / head / ref", "তারিখ / খাত / রেফ")} /></div>
      </Card>

      <Card className="p-4 flex flex-wrap items-center gap-4">
        {recon.ok ? (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />{tx("Reconciled with receipts & lifecycle", "রসিদ ও লাইফসাইকেলের সাথে মিল আছে")}</Badge>
        ) : (
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{tx(`${recon.badCount} discrepancy(ies)`, `${recon.badCount} টি অমিল`)}</Badge>
        )}
        <span className="text-sm text-muted-foreground">{tx("In", "জমা")}: {report.total_in} · {tx("Out", "খরচ")}: {report.total_out} · {tx("Closing", "সমাপনী")}: {report.closing}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileDown className="mr-1 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
        </div>
      </Card>

      <Card className="p-4 grid gap-3 md:grid-cols-5 items-end">
        <div className="md:col-span-5 text-sm font-medium">{tx("Historical (back-dated) entry", "পূর্ববর্তী তারিখের এন্ট্রি")}</div>
        <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} /></div>
        <div>
          <Label>{tx("Direction", "ধরন")}</Label>
          <Select value={hDir} onValueChange={(v) => setHDir(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">{tx("In (জমা)", "জমা")}</SelectItem>
              <SelectItem value="out">{tx("Out (খরচ)", "খরচ")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{tx("Amount", "পরিমাণ")}</Label><Input type="number" value={hAmount} onChange={(e) => setHAmount(e.target.value)} /></div>
        <div><Label>{tx("Head", "খাত")}</Label><Input value={hHead} onChange={(e) => setHHead(e.target.value)} /></div>
        <div><Button onClick={addHistorical} className="w-full">{tx("Add", "যোগ করুন")}</Button></div>
        {hError && <p className="md:col-span-5 text-sm text-destructive">{tx(hError.en, hError.bn)}</p>}
      </Card>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Head", "খাত")}</TableHead>
              <TableHead>{tx("Ref", "রেফ")}</TableHead>
              <TableHead className="text-right">{tx("In", "জমা")}</TableHead>
              <TableHead className="text-right">{tx("Out", "খরচ")}</TableHead>
              <TableHead className="text-right">{tx("Balance", "ব্যালেন্স")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.head}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.ref ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.debit || ""}</TableCell>
                <TableCell className="text-right tabular-nums">{r.credit || ""}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{r.balance}</TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{loading ? tx("Loading…", "লোড হচ্ছে…") : tx("No data", "কোনো তথ্য নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
