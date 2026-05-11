import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

type Source = "savings" | "loans";
type Bucket = "daily" | "monthly";

type Row = { date: string; amount: number; count: number };

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

function bucketKey(d: string, b: Bucket): string {
  return b === "monthly" ? d.slice(0, 7) : d;
}

export default function SavingsLoanReport() {
  const { t } = useLang();
  const [source, setSource] = useState<Source>("savings");
  const [bucket, setBucket] = useState<Bucket>("daily");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    setLoading(true);
    try {
      let q;
      if (source === "savings") {
        q = supabase
          .from("savings_transactions")
          .select("amount,txn_date,status,deleted_at")
          .gte("txn_date", from).lte("txn_date", to)
          .eq("status", "approved").is("deleted_at", null);
      } else {
        q = supabase
          .from("loan_payments")
          .select("amount,paid_on,status")
          .gte("paid_on", from).lte("paid_on", to)
          .eq("status", "approved");
      }
      const { data, error } = await q;
      if (error) throw error;
      const dateField = source === "savings" ? "txn_date" : "paid_on";
      const map = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        const k = bucketKey(r[dateField] as string, bucket);
        const cur = map.get(k) ?? { date: k, amount: 0, count: 0 };
        cur.amount += Number(r.amount) || 0;
        cur.count += 1;
        map.set(k, cur);
      });
      setRows(Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [source, bucket, from, to]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const totalCount = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  const title = `${source === "savings" ? "Savings" : "Loan"} ${bucket === "monthly" ? "Monthly" : "Daily"} Report`;
  const cols = [
    { key: "date", label: bucket === "monthly" ? "Month" : "Date" },
    { key: "count", label: "Transactions" },
    { key: "amount", label: "Amount" },
  ];

  async function onPdf() {
    setPdfBusy(true);
    try {
      const head = cols.map((c) => c.label);
      const body = rows.map((r) => [
        bucket === "monthly" ? r.date : fmtDate(r.date),
        String(r.count),
        money(r.amount),
      ]);
      body.push(["Total", String(totalCount), money(total)]);
      await exportTablePDF(title, head, body, { from, to });
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally {
      setPdfBusy(false);
    }
  }

  function onExcel() {
    try {
      const data = rows.map((r) => ({
        [bucket === "monthly" ? "Month" : "Date"]: r.date,
        Transactions: r.count,
        Amount: r.amount,
      }));
      data.push({
        [bucket === "monthly" ? "Month" : "Date"]: "Total",
        Transactions: totalCount,
        Amount: total,
      } as any);
      exportExcel(`${source}-${bucket}`, title.slice(0, 28), data, { from, to });
    } catch (e: any) {
      toast.error(e.message ?? "Excel export failed");
    }
  }

  return (
    <>
      <PageHeader
        title={t("savingsLoanReport")}
        description={`${t("p5_daily" as any)} / ${t("p5_monthly" as any)} — PDF / Excel`}
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>{t("dues_source" as any)}</Label>
            <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
              <TabsList className="w-full">
                <TabsTrigger value="savings" className="flex-1">{t("savings")}</TabsTrigger>
                <TabsTrigger value="loans" className="flex-1">{t("loans")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label>{t("dues_bucket" as any)}</Label>
            <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
              <TabsList className="w-full">
                <TabsTrigger value="daily" className="flex-1">{t("p5_daily" as any)}</TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1">{t("p5_monthly" as any)}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label>{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={onPdf} disabled={pdfBusy || !rows.length} variant="secondary">
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button onClick={onExcel} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
            ) : (
              <>
                {rows.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell>{bucket === "monthly" ? r.date : fmtDate(r.date)}</TableCell>
                    <TableCell>{r.count}</TableCell>
                    <TableCell>{money(r.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell>{t("total")}</TableCell>
                  <TableCell>{totalCount}</TableCell>
                  <TableCell>{money(total)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
