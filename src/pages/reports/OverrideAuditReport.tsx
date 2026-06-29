import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportCSV } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

const PAGE_SIZE = 50;

export default function OverrideAuditReport() {
  const { tx } = useLang();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await db
        .from("irrigation_rate_overrides" as any)
        .select("id,created_at,original_rate,overridden_rate,override_reason,approved_by,created_by,irrigation_invoice_id,irrigation_invoices!inner(invoice_no,farmer_id,farmers!irrigation_invoices_farmer_id_fkey(name_bn,name_en,farmer_code,mobile))")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      setRows((data as any) ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const inv = r.irrigation_invoices;
      const f = inv?.farmers;
      return (
        (inv?.invoice_no ?? "").toLowerCase().includes(s) ||
        (f?.name_bn ?? "").toLowerCase().includes(s) ||
        (f?.name_en ?? "").toLowerCase().includes(s) ||
        (f?.farmer_code ?? "").toLowerCase().includes(s) ||
        (f?.mobile ?? "").includes(s) ||
        (r.override_reason ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const head = [
    tx("Date", "তারিখ"), tx("Invoice", "ইনভয়েস"), tx("Farmer", "কৃষক"), tx("Code", "কোড"),
    tx("Original", "মূল রেট"), tx("Overridden", "ওভাররাইড"), tx("Diff", "পার্থক্য"), tx("Reason", "কারণ"),
  ];

  function buildExportRows() {
    return filtered.map((r) => [
      fmtDate(r.created_at),
      r.irrigation_invoices?.invoice_no ?? "",
      r.irrigation_invoices?.farmers?.name_bn ?? r.irrigation_invoices?.farmers?.name_en ?? "",
      r.irrigation_invoices?.farmers?.farmer_code ?? "",
      Number(r.original_rate || 0),
      Number(r.overridden_rate || 0),
      Number(r.overridden_rate || 0) - Number(r.original_rate || 0),
      r.override_reason ?? "",
    ]);
  }

  async function onPdf() {
    setPdfBusy(true);
    try { await exportTablePDF(tx("Rate Override Audit", "রেট ওভাররাইড অডিট"), head, buildExportRows()); }
    catch (e: any) { toast.error(e.message); } finally { setPdfBusy(false); }
  }
  function onCsv() {
    exportCSV("rate-override-audit", head, buildExportRows());
  }

  return (
    <>
      <PageHeader
        title={tx("Override Audit", "ওভাররাইড অডিট")}
        description={tx("All manual rate overrides applied during invoice creation or recalculation.", "ইনভয়েস তৈরি বা পুনঃগণনার সময় প্রয়োগকৃত সকল ম্যানুয়াল রেট ওভাররাইড।")}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <Label>{tx("Search", "খুঁজুন")}</Label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={tx("invoice / farmer / code / reason", "ইনভয়েস / কৃষক / কোড / কারণ")} />
          </div>
          <Button onClick={onCsv} disabled={!filtered.length} variant="secondary">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={onPdf} disabled={pdfBusy || !filtered.length}>
            {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />} PDF
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead className="text-right">{tx("Original", "মূল রেট")}</TableHead>
              <TableHead className="text-right">{tx("Overridden", "ওভাররাইড")}</TableHead>
              <TableHead className="text-right">{tx("Diff", "পার্থক্য")}</TableHead>
              <TableHead>{tx("Reason", "কারণ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{tx("No overrides", "কোনো ওভাররাইড নেই")}</TableCell></TableRow>
            ) : pageRows.map((r) => {
              const diff = Number(r.overridden_rate || 0) - Number(r.original_rate || 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.irrigation_invoices?.invoice_no ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.irrigation_invoices?.farmers?.name_bn ?? r.irrigation_invoices?.farmers?.name_en} <span className="text-muted-foreground">({r.irrigation_invoices?.farmers?.farmer_code})</span></TableCell>
                  <TableCell className="text-right font-mono">{money(r.original_rate)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.overridden_rate)}</TableCell>
                  <TableCell className={`text-right font-mono ${diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-600" : ""}`}>
                    {diff > 0 ? "+" : ""}{money(diff)}
                  </TableCell>
                  <TableCell className="text-xs max-w-md truncate" title={r.override_reason ?? ""}>{r.override_reason ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between p-3 border-t">
            <div className="text-xs text-muted-foreground">
              {tx("Page", "পেজ")} {page + 1} / {totalPages} • {filtered.length} {tx("rows", "সারি")}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
