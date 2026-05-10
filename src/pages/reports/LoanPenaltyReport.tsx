import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";
import { useLang } from "@/i18n/LanguageProvider";
import { moneyL, fmtDateL } from "@/lib/format";

export default function LoanPenaltyReport() {
  const { t, lang } = useLang();
  const fmt = (d: any) => fmtDateL(d, lang);
  const money = (n: any) => moneyL(Number(n || 0), lang);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("loan_installment_delay_audit")
      .select("id,original_amount,modified_amount,reason,created_at,loan_id,installment_id")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(2000);
    setRows((data ?? []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const totals = useMemo(() => ({
    original: rows.reduce((s, r) => s + Number(r.original_amount || 0), 0),
    modified: rows.reduce((s, r) => s + Number(r.modified_amount || 0), 0),
  }), [rows]);

  function exportCsv() {
    downloadCsv("loan_penalty.csv", rows, [
      { header: t("date"), accessor: r => fmt(r.created_at) },
      { header: t("loan" as any), accessor: r => r.loan_id },
      { header: t("installment" as any), accessor: r => r.installment_id },
      { header: t("originalPenalty" as any), accessor: r => Number(r.original_amount || 0) },
      { header: t("modifiedPenalty" as any), accessor: r => Number(r.modified_amount || 0) },
      { header: t("reason"), accessor: r => r.reason || "" },
    ]);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">{t("loanPenaltyReportTitle" as any)}</h1>
        <div className="flex gap-2 items-center">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={load}>{t("refresh")}</Button>
          <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {loading
              ? t("loading")
              : t("countOriginalToModified" as any)
                  .replace("{count}", String(rows.length))
                  .replace("{original}", money(totals.original))
                  .replace("{modified}", money(totals.modified))}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("loan" as any)}</TableHead>
                <TableHead>{t("installment" as any)}</TableHead>
                <TableHead className="text-right">{t("originalPenalty" as any)}</TableHead>
                <TableHead className="text-right">{t("modifiedPenalty" as any)}</TableHead>
                <TableHead>{t("reason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{fmt(r.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.loan_id).slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.installment_id).slice(0, 8)}</TableCell>
                  <TableCell className="text-right">{money(r.original_amount)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.modified_amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
