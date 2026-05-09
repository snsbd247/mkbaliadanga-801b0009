import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { money, fmtDate } from "@/lib/format";
import { ExportDialog, type ExportColumn } from "@/components/exports/ExportDialog";
import { FileDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

const IrrigationReportCharts = lazy(() => import("./irrigation/IrrigationReportCharts"));

type Inv = any;

export default function IrrigationReports() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState("all");
  const [officeId, setOfficeId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    document.title = t("irr_pageTitle" as any);
    Promise.all([
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("offices").select("id,name").order("name"),
    ]).then(([s, o]) => { setSeasons(s.data ?? []); setOffices(o.data ?? []); });
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("irrigation_invoices" as any)
      .select("*, farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn,farmer_code,mobile), lands(dag_no,land_size,mouza), seasons(name,year,type)")
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled")
      .limit(2000);
    if (seasonId !== "all") q = q.eq("season_id", seasonId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    if (fromDate) q = q.gte("generated_at", fromDate);
    if (toDate) q = q.lte("generated_at", `${toDate}T23:59:59`);
    q.then(({ data }) => { setRows((data as any) ?? []); setLoading(false); });
  }, [seasonId, officeId, fromDate, toDate]);

  const totals = useMemo(() => {
    const t = { count: rows.length, payable: 0, paid: 0, due: 0, manual: 0 };
    for (const r of rows) {
      t.payable += Number(r.payable_amount || 0);
      t.paid += Number(r.paid_amount || 0);
      t.due += Number(r.due_amount || 0);
      if (r.is_manual_rate) t.manual += 1;
    }
    return t;
  }, [rows]);

  const bySeason = useMemo(() => {
    const m = new Map<string, { name: string; payable: number; paid: number; due: number; count: number }>();
    for (const r of rows) {
      const key = r.season_id;
      const name = `${r.seasons?.name ?? r.seasons?.type ?? "—"} ${r.seasons?.year ?? ""}`.trim();
      const cur = m.get(key) ?? { name, payable: 0, paid: 0, due: 0, count: 0 };
      cur.payable += Number(r.payable_amount || 0);
      cur.paid += Number(r.paid_amount || 0);
      cur.due += Number(r.due_amount || 0);
      cur.count += 1;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.payable - a.payable);
  }, [rows]);

  const byLandType = useMemo(() => {
    const m = new Map<string, { name: string; payable: number; paid: number; due: number; count: number }>();
    for (const r of rows) {
      const name = r.land_type_name || t("irr_unknown" as any);
      const cur = m.get(name) ?? { name, payable: 0, paid: 0, due: 0, count: 0 };
      cur.payable += Number(r.payable_amount || 0);
      cur.paid += Number(r.paid_amount || 0);
      cur.due += Number(r.due_amount || 0);
      cur.count += 1;
      m.set(name, cur);
    }
    return [...m.values()].sort((a, b) => b.payable - a.payable);
  }, [rows]);

  const collectionPct = totals.payable > 0 ? Math.round((totals.paid / totals.payable) * 1000) / 10 : 0;

  return (
    <>
      <PageHeader title={t("irr_pageTitle" as any)} description={t("irr_pageDesc" as any)} />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>{t("irr_colSeason" as any)}</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all" as any)}</SelectItem>
                  {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isSuper && (
              <div>
                <Label>{t("office" as any)}</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all" as any)}</SelectItem>
                    {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("startDate" as any)}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("endDate" as any)}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setExportOpen(true)} disabled={!rows.length}>
              <FileDown className="h-4 w-4 mr-1" /> {t("exp_export" as any)}
            </Button>
            {(fromDate || toDate || seasonId !== "all" || officeId !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setSeasonId("all"); setOfficeId("all"); setFromDate(""); setToDate(""); }}>
                {t("filterReset" as any)}
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Stat label={t("irr_totalInvoices" as any)} value={totals.count.toLocaleString()} />
            <Stat label={t("irr_totalPayable" as any)} value={money(totals.payable)} />
            <Stat label={t("irr_paid" as any)} value={money(totals.paid)} hint={t("irr_collectionPct" as any).replace("{pct}", String(collectionPct))} />
            <Stat label={t("irr_due" as any)} value={money(totals.due)} hint={totals.manual ? t("irr_manualRateCount" as any).replace("{n}", String(totals.manual)) : undefined} tone="destructive" />
          </div>

          <p className="text-sm text-muted-foreground">{loading ? t("irr_loading" as any) : t("irr_invoiceCount" as any).replace("{n}", String(rows.length))}</p>
        </CardContent>
      </Card>

      <Suspense fallback={<div className="mt-4 text-sm text-muted-foreground">{t("irr_loading" as any)}</div>}>
        <IrrigationReportCharts rows={rows} />
      </Suspense>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">{t("irr_colSeason" as any)}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("irr_colSeason" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_colInvoice" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendPayable" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendPaid" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendDue" as any)}</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySeason.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right">{money(r.payable)}</TableCell>
                  <TableCell className="text-right text-success">{money(r.paid)}</TableCell>
                  <TableCell className="text-right text-destructive">{money(r.due)}</TableCell>
                  <TableCell className="text-right">{r.payable > 0 ? `${Math.round((r.paid / r.payable) * 100)}%` : "—"}</TableCell>
                </TableRow>
              ))}
              {!bySeason.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("irr_chartNoData" as any)}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">{t("landTypeName" as any)}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("landTypeName" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_colInvoice" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendPayable" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendPaid" as any)}</TableHead>
                <TableHead className="text-right">{t("irr_chartLegendDue" as any)}</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLandType.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right">{money(r.payable)}</TableCell>
                  <TableCell className="text-right text-success">{money(r.paid)}</TableCell>
                  <TableCell className="text-right text-destructive">{money(r.due)}</TableCell>
                  <TableCell className="text-right">{r.payable > 0 ? `${Math.round((r.paid / r.payable) * 100)}%` : "—"}</TableCell>
                </TableRow>
              ))}
              {!byLandType.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("irr_chartNoData" as any)}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        reportName="irrigation-report"
        rows={rows}
        range={{ from: fromDate || null, to: toDate || null }}
        columns={[
          { key: "date", label: t("irr_colDate" as any), accessor: (r: any) => fmtDate(r.entry_date) },
          { key: "season", label: t("irr_colSeason" as any), accessor: (r: any) => r.seasons?.name ?? "" },
          { key: "farmer_code", label: t("irr_colFarmerCode" as any), accessor: (r: any) => r.farmers?.farmer_code ?? "" },
          { key: "farmer_name", label: t("irr_colFarmerName" as any), accessor: (r: any) => r.farmers?.name_bn || r.farmers?.name_en || "" },
          { key: "mobile", label: t("irr_colMobile" as any), accessor: (r: any) => r.farmers?.mobile ?? "" },
          { key: "dag_no", label: t("irr_colDagNo" as any), accessor: (r: any) => r.lands?.dag_no ?? "" },
          { key: "mouza", label: t("irr_colMouza" as any), accessor: (r: any) => r.lands?.mouza ?? "" },
          { key: "land_size", label: t("irr_colLandSize" as any), accessor: (r: any) => r.lands?.land_size ?? "" },
          { key: "rate", label: t("irr_colRate" as any), accessor: (r: any) => r.rate ?? "" },
          { key: "total", label: t("irr_colTotal" as any), accessor: (r: any) => r.total ?? 0 },
          { key: "paid_amount", label: t("irr_colPaid" as any), accessor: (r: any) => r.paid_amount ?? 0 },
          { key: "due_amount", label: t("irr_colDue" as any), accessor: (r: any) => r.due_amount ?? 0, defaultSelected: true },
          { key: "status", label: t("irr_colStatus" as any), accessor: (r: any) => r.status ?? "" },
        ]}
      />
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "destructive" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
