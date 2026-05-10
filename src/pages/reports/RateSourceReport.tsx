import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportCSV } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type SourceFilter = "ALL" | "STANDARD" | "CATEGORY" | "MANUAL";

export default function RateSourceReport() {
  const { tx } = useLang();
  const { isSuper, officeId: myOfficeId } = useAuth();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [seasonId, setSeasonId] = useState("all");
  // Non-super staff default to their assigned office; super sees all.
  const [officeId, setOfficeId] = useState<string>(isSuper ? "all" : (myOfficeId ?? "all"));
  const [categoryId, setCategoryId] = useState("all");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [farmerSearch, setFarmerSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("offices").select("id,name").order("name"),
      supabase.from("irrigation_categories" as any).select("id,name_bn,name_en").eq("is_active", true).is("deleted_at", null).order("name_bn"),
    ]).then(([s, o, c]) => {
      setSeasons(s.data ?? []);
      setOffices(o.data ?? []);
      setCategories((c.data as any) ?? []);
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("irrigation_invoices" as any)
        .select("id,invoice_no,generated_at,rate_source,applied_rate,original_standard_rate,irrigation_category_name,override_reason,payable_amount,paid_amount,is_manual_rate,manual_rate_reason,season_rate,farmers!irrigation_invoices_farmer_id_fkey(name_bn,name_en,farmer_code,mobile),seasons(name,year,type)")
        .is("deleted_at", null)
        .order("generated_at", { ascending: false })
        .limit(1000);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (categoryId !== "all") q = q.eq("irrigation_category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      let result = (data as any[]) ?? [];
      // Source filter (handle legacy NULL = STANDARD)
      if (source !== "ALL") {
        result = result.filter((r) => (r.rate_source ?? (r.is_manual_rate ? "MANUAL" : "STANDARD")) === source);
      }
      const fs = farmerSearch.trim().toLowerCase();
      if (fs) {
        result = result.filter((r) =>
          (r.farmers?.name_bn ?? "").toLowerCase().includes(fs) ||
          (r.farmers?.name_en ?? "").toLowerCase().includes(fs) ||
          (r.farmers?.farmer_code ?? "").toLowerCase().includes(fs) ||
          (r.farmers?.mobile ?? "").includes(fs) ||
          (r.invoice_no ?? "").toLowerCase().includes(fs),
        );
      }
      setRows(result);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [seasonId, officeId, categoryId, source]);

  const totals = useMemo(() => {
    const t = { STANDARD: 0, CATEGORY: 0, MANUAL: 0, payable: 0, paid: 0 };
    for (const r of rows) {
      const src = r.rate_source ?? (r.is_manual_rate ? "MANUAL" : "STANDARD");
      (t as any)[src] = ((t as any)[src] ?? 0) + Number(r.payable_amount || 0);
      t.payable += Number(r.payable_amount || 0);
      t.paid += Number(r.paid_amount || 0);
    }
    return t;
  }, [rows]);

  function buildRows() {
    return rows.map((r) => {
      const src = r.rate_source ?? (r.is_manual_rate ? "MANUAL" : "STANDARD");
      return [
        fmtDate(r.generated_at),
        r.invoice_no ?? "",
        r.farmers?.name_bn ?? r.farmers?.name_en ?? "",
        r.farmers?.farmer_code ?? "",
        `${r.seasons?.name ?? r.seasons?.type ?? ""} ${r.seasons?.year ?? ""}`.trim(),
        src,
        r.irrigation_category_name ?? "",
        r.applied_rate ?? r.season_rate ?? "",
        r.original_standard_rate ?? "",
        r.override_reason ?? r.manual_rate_reason ?? "",
        Number(r.payable_amount || 0),
        Number(r.paid_amount || 0),
      ];
    });
  }

  const head = [
    tx("Date", "তারিখ"), tx("Invoice", "ইনভয়েস"), tx("Farmer", "কৃষক"), tx("Code", "কোড"), tx("Season", "সিজন"),
    tx("Source", "উৎস"), tx("Category", "ক্যাটেগরি"), tx("Applied", "প্রযোজ্য"), tx("Standard", "মানক"),
    tx("Reason", "কারণ"), tx("Payable", "প্রদেয়"), tx("Paid", "পরিশোধিত"),
  ];

  function buildRowsWithTotals() {
    const body = buildRows();
    // Totals: applied vs standard sums + payable/paid
    let appliedSum = 0, standardSum = 0;
    for (const r of rows) {
      appliedSum += Number(r.applied_rate ?? r.season_rate ?? 0);
      standardSum += Number(r.original_standard_rate ?? r.season_rate ?? 0);
    }
    body.push([
      tx("TOTAL", "মোট"), "", "", "", "", "", "",
      appliedSum, standardSum, "",
      totals.payable, totals.paid,
    ] as any);
    return body;
  }
  async function onPdf() {
    setPdfBusy(true);
    try { await exportTablePDF(tx("Rate Source Report", "রেট উৎস রিপোর্ট"), head, buildRowsWithTotals()); }
    catch (e: any) { toast.error(e.message); } finally { setPdfBusy(false); }
  }
  function onCsv() {
    exportCSV("rate-source-report", head, buildRowsWithTotals());
  }

  return (
    <>
      <PageHeader
        title={tx("Rate Source Report", "রেট উৎস রিপোর্ট")}
        description={tx("Breakdown of irrigation invoices by Standard / Category / Manual rate source.", "Standard / Category / Manual রেট উৎস অনুযায়ী সেচ ইনভয়েস বিশ্লেষণ।")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("Standard", "মানক")}</div>
          <div className="text-2xl font-semibold">{money(totals.STANDARD)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("Category", "ক্যাটেগরি")}</div>
          <div className="text-2xl font-semibold">{money(totals.CATEGORY)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("Manual", "ম্যানুয়াল")}</div>
          <div className="text-2xl font-semibold">{money(totals.MANUAL)}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>{tx("Season", "সিজন")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isSuper && (
            <div>
              <Label>{tx("Office", "অফিস")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                  {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{tx("Category", "ক্যাটেগরি")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name_bn || c.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Source", "উৎস")}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tx("All", "সব")}</SelectItem>
                <SelectItem value="STANDARD">STANDARD</SelectItem>
                <SelectItem value="CATEGORY">CATEGORY</SelectItem>
                <SelectItem value="MANUAL">MANUAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{tx("Farmer / invoice", "কৃষক / ইনভয়েস")}</Label>
            <div className="flex gap-2">
              <Input value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} placeholder={tx("name / code / mobile / invoice", "নাম / কোড / মোবাইল / ইনভয়েস")} />
              <Button variant="outline" onClick={load}>{tx("Apply", "প্রয়োগ")}</Button>
            </div>
          </div>
          <div className="md:col-span-6 flex gap-2 justify-end">
            <Button onClick={onCsv} disabled={!rows.length} variant="secondary">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button onClick={onPdf} disabled={pdfBusy || !rows.length}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead>{tx("Source", "উৎস")}</TableHead>
              <TableHead>{tx("Category", "ক্যাটেগরি")}</TableHead>
              <TableHead className="text-right">{tx("Applied", "প্রযোজ্য")}</TableHead>
              <TableHead className="text-right">{tx("Standard", "মানক")}</TableHead>
              <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{tx("No data", "ডেটা নেই")}</TableCell></TableRow>
            ) : (
              <>
                {rows.map((r) => {
                  const src = r.rate_source ?? (r.is_manual_rate ? "MANUAL" : "STANDARD");
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{fmtDate(r.generated_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                      <TableCell className="text-xs">{r.farmers?.name_bn ?? r.farmers?.name_en} <span className="text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
                      <TableCell><Badge variant={src === "MANUAL" ? "outline" : src === "CATEGORY" ? "secondary" : "default"}>{src}</Badge></TableCell>
                      <TableCell className="text-xs">{r.irrigation_category_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.applied_rate ?? r.season_rate ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.original_standard_rate ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.payable_amount)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={7}>{tx("Total", "মোট")} ({rows.length})</TableCell>
                  <TableCell className="text-right">{money(totals.payable)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
