import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";
import { useLang } from "@/i18n/LanguageProvider";
import { moneyL, fmtDateL } from "@/lib/format";

export default function LoanOverdueReport() {
  const { t, lang } = useLang();
  const fmt = (d: any) => fmtDateL(d, lang);
  const money = (n: any) => moneyL(Number(n || 0), lang);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("loan_installments")
        .select("id,installment_no,amount,paid_amount,due_date,status,loan_id,loans(id,farmer_id,plan_id,office_id,total_payable,farmers(name_bn,name_en,farmer_code,mobile),loan_plans(name,name_bn))")
        .neq("status", "paid")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(2000);
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const f = r.loans?.farmers;
      return [f?.name_bn, f?.name_en, f?.farmer_code, f?.mobile].some(v => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search]);

  function exportCsv() {
    downloadCsv("loan_overdue.csv", filtered, [
      { header: t("farmer"), accessor: r => r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "" },
      { header: t("accountNo"), accessor: r => r.loans?.farmers?.farmer_code || "" },
      { header: t("plan" as any), accessor: r => r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "" },
      { header: t("installmentNo"), accessor: r => r.installment_no },
      { header: t("dueDateLabel" as any), accessor: r => fmt(r.due_date) },
      { header: t("delayDays" as any), accessor: r => differenceInDays(new Date(), new Date(r.due_date)) },
      { header: t("amount"), accessor: r => Number(r.amount || 0) },
      { header: t("remaining" as any), accessor: r => Number(r.amount || 0) - Number(r.paid_amount || 0) },
    ]);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">{t("loanOverdueReportTitle" as any)}</h1>
        <div className="flex gap-2">
          <Input className="w-64" placeholder={t("searchPlaceholderFarmer" as any)} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {loading ? t("loading") : `${filtered.length} ${t("overdueCountSuffix" as any)}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("farmer")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead>{t("plan" as any)}</TableHead>
                <TableHead>{t("installment" as any)}</TableHead>
                <TableHead>{t("dueDateLabel" as any)}</TableHead>
                <TableHead>{t("delayDays" as any)}</TableHead>
                <TableHead className="text-right">{t("remaining" as any)}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const days = differenceInDays(new Date(), new Date(r.due_date));
                const remaining = Number(r.amount || 0) - Number(r.paid_amount || 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "-"}</TableCell>
                    <TableCell>{r.loans?.farmers?.farmer_code || "-"}</TableCell>
                    <TableCell>{r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "-"}</TableCell>
                    <TableCell>#{r.installment_no}</TableCell>
                    <TableCell>{fmt(r.due_date)}</TableCell>
                    <TableCell><Badge variant="destructive">{days} {t("days" as any)}</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{money(remaining)}</TableCell>
                    <TableCell><Link className="text-primary underline text-xs" to={`/loans/${r.loan_id}`}>{t("detailsLink" as any)}</Link></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
