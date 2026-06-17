import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";

const ALL = "__all__";

type ExpenseRow = {
  id: string;
  expense_date: string;
  head: string;
  payee: string | null;
  amount: number;
  method: string | null;
  note: string | null;
};

export default function ExpensesReport() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [head, setHead] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const fromStatement = !!(params.get("from") || params.get("to") || params.get("stream"));

  useEffect(() => {
    document.title = `${t("expensesReport")} — ${t("appName")}`;
  }, [t]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [from, to, head, method]);

  async function load() {
    setLoading(true);
    try {
      let q: any = supabase
        .from("expenses")
        .select("id,expense_date,head,payee,amount,method,note")
        .is("deleted_at", null)
        .order("expense_date", { ascending: false });
      if (from) q = q.gte("expense_date", from);
      if (to) q = q.lte("expense_date", to);
      if (head !== ALL) q = q.eq("head", head);
      if (method !== ALL) q = q.eq("method", method);
      const { data } = await q;
      setRows((data ?? []) as ExpenseRow[]);
    } finally {
      setLoading(false);
    }
  }

  const heads = useMemo(() => Array.from(new Set(rows.map((r) => r.head).filter(Boolean))).sort(), [rows]);
  const methods = useMemo(() => Array.from(new Set(rows.map((r) => r.method || "cash"))).sort(), [rows]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const byHead = useMemo(() => {
    const m = new Map<string, { head: string; total: number; count: number }>();
    for (const r of rows) {
      const k = r.head || "—";
      const cur = m.get(k) ?? { head: k, total: 0, count: 0 };
      cur.total += Number(r.amount || 0);
      cur.count += 1;
      m.set(k, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const range = { from, to };

  function exportPdf() {
    exportTablePDF(
      "Expenses Report",
      ["Date", "Head", "Payee", "Method", "Amount", "Note"],
      rows.map((r) => [fmtDate(r.expense_date), r.head, r.payee ?? "—", r.method ?? "cash", r.amount, r.note ?? ""]),
      range,
    );
  }

  function exportXlsx() {
    exportExcel(
      "expenses-report",
      "Expenses",
      rows.map((r) => ({
        Date: r.expense_date,
        Head: r.head,
        Payee: r.payee,
        Method: r.method,
        Amount: r.amount,
        Note: r.note,
      })),
      range,
    );
  }

  function exportSummaryPdf() {
    exportTablePDF(
      "Expenses by Head",
      ["Head", "Entries", "Total"],
      byHead.map((r) => [r.head, r.count, r.total]),
      range,
    );
  }

  return (
    <>
      <PageHeader
        title={t("expensesReport")}
        description={t("expensesReportDesc")}
      />

      {fromStatement && (
        <div className="mb-4 rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-foreground">
          সেচ জমা খরচ হিসাব থেকে ফিল্টার প্রয়োগ করা হয়েছে — সেচ খরচ
          {(from || to) && <> ({from || "…"} → {to || "…"})</>}
        </div>
      )}


      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>{t("head")}</Label>
            <Select value={head} onValueChange={setHead}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {heads.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("method")}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileDown className="h-4 w-4 mr-1" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{t("summaryByHead")}</h3>
          <Button variant="outline" size="sm" onClick={exportSummaryPdf}>
            <FileDown className="h-4 w-4 mr-1" />{t("summaryPdf")}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("head")}</TableHead>
              <TableHead className="text-right">{t("entries")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byHead.map((r) => (
              <TableRow key={r.head}>
                <TableCell>{r.head}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{money(r.total)}</TableCell>
              </TableRow>
            ))}
            {byHead.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
            )}
            {byHead.length > 0 && (
              <TableRow className="font-semibold">
                <TableCell>{t("total")}</TableCell>
                <TableCell className="text-right">{rows.length}</TableCell>
                <TableCell className="text-right">{money(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">{t("detailLabel")} ({loading ? t("loading") : `${rows.length} ${t("entriesWord")}`})</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("head")}</TableHead>
              <TableHead>{t("payee")}</TableHead>
              <TableHead>{t("method")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>{t("note")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.expense_date)}</TableCell>
                <TableCell>{r.head}</TableCell>
                <TableCell>{r.payee ?? "—"}</TableCell>
                <TableCell>{r.method ?? "cash"}</TableCell>
                <TableCell className="text-right">{money(r.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{r.note ?? ""}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
