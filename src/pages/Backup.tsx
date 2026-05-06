import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLang } from "@/i18n/LanguageProvider";
import { Download, Database, FileSpreadsheet, Upload, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const TABLES: { name: string; label: string }[] = [
  { name: "farmers", label: "Farmers" },
  { name: "lands", label: "Lands" },
  { name: "land_relations", label: "Land Relations" },
  { name: "seasons", label: "Seasons" },
  { name: "savings_transactions", label: "Savings" },
  { name: "savings_yearly_opening", label: "Savings Opening" },
  { name: "loans", label: "Loans" },
  { name: "loan_payments", label: "Loan Payments" },
  { name: "irrigation_charges", label: "Irrigation Charges" },
  { name: "payments", label: "Payments" },
  { name: "payment_allocations", label: "Payment Allocations" },
  { name: "receipts", label: "Receipts" },
  { name: "expenses", label: "Expenses" },
  { name: "shares", label: "Shares" },
  { name: "offices", label: "Offices" },
];

async function fetchAll(table: string) {
  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await (supabase as any).from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default function Backup() {
  const { t } = useLang();
  const { isSuper } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [restoreReport, setRestoreReport] = useState<{ table: string; inserted: number; updated: number; failed: number; skipped: number; errors: string[] }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- restore ----
  const TABLE_NAMES = new Set(TABLES.map(t => t.name));

  function inferTableFromSheet(sheetName: string): string | null {
    const norm = sheetName.toLowerCase().trim();
    for (const t of TABLES) {
      if (t.name === norm) return t.name;
      if (t.label.toLowerCase() === norm) return t.name;
      if (t.label.toLowerCase().slice(0, 31) === norm) return t.name;
    }
    return null;
  }

  async function importRows(table: string, rows: any[], dry: boolean) {
    const summary = { table, inserted: 0, updated: 0, failed: 0, skipped: 0, errors: [] as string[] };
    if (!rows.length) return summary;
    // Strip placeholder/empty marker rows
    const clean = rows.filter(r => !(Object.keys(r).length === 1 && "note" in r));
    if (!clean.length) { summary.skipped = rows.length; return summary; }
    if (dry) {
      summary.inserted = clean.filter(r => !r.id).length;
      summary.updated = clean.filter(r => r.id).length;
      return summary;
    }
    const CHUNK = 200;
    for (let i = 0; i < clean.length; i += CHUNK) {
      const slice = clean.slice(i, i + CHUNK);
      const { error, data } = await (supabase as any).from(table).upsert(slice, { onConflict: "id" }).select("id");
      if (error) {
        summary.failed += slice.length;
        summary.errors.push(error.message);
      } else {
        const n = data?.length ?? slice.length;
        summary.updated += n;
      }
    }
    return summary;
  }

  async function runRestore() {
    if (!restoreFile) return toast.error(t("p5d_invalidFile"));
    setBusy("__restore__");
    setRestoreReport(null);
    try {
      const buf = await restoreFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const summaries: any[] = [];
      for (const sheetName of wb.SheetNames) {
        const tableName = inferTableFromSheet(sheetName);
        if (!tableName) {
          summaries.push({ table: sheetName, inserted: 0, updated: 0, failed: 0, skipped: 0, errors: ["Unknown sheet, skipped"] });
          continue;
        }
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
        // eslint-disable-next-line no-await-in-loop
        const s = await importRows(tableName, rows, dryRun);
        summaries.push(s);
      }
      setRestoreReport(summaries);
      toast.success(dryRun ? t("p5d_restoreSummary") : t("p5d_restoreDone"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadOne(name: string, label: string) {
    setBusy(name);
    try {
      const rows = await fetchAll(name);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
      XLSX.writeFile(wb, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("rowsCount").replace("{label}", label).replace("{n}", String(rows.length)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCsv(name: string, label: string) {
    setBusy(name);
    try {
      const rows = await fetchAll(name);
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("rowsCount").replace("{label}", label).replace("{n}", String(rows.length)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("__all__");
    setProgress(0);
    try {
      const wb = XLSX.utils.book_new();
      let i = 0;
      for (const t of TABLES) {
        try {
          const rows = await fetchAll(t.name);
          const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "empty" }]);
          XLSX.utils.book_append_sheet(wb, ws, t.label.slice(0, 31));
        } catch (e: any) {
          // skip restricted tables silently
          console.warn("skip", t.name, e.message);
        }
        i++;
        setProgress(Math.round((i / TABLES.length) * 100));
      }
      XLSX.writeFile(wb, `cooperative-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("fullBackupDownloaded"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  return (
    <>
      <PageHeader title={t("backupTitle")} description={t("backupDesc")} />

      <Card className="p-5 mb-5 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Database className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{t("fullWorkbookBackup")}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t("fullWorkbookDesc")}</p>
            {busy === "__all__" && (
              <div className="mb-2 h-2 w-full rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <Button onClick={downloadAll} disabled={!!busy}>
              <Download className="h-4 w-4 mr-2" />
              {busy === "__all__" ? `${t("backingUp")} ${progress}%` : t("downloadFullBackup")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">{t("perTableExports")}</h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {TABLES.map(tb => (
            <div key={tb.name} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="text-sm font-medium">{tb.label}</div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => downloadOne(tb.name, tb.label)} title="Excel">
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => downloadCsv(tb.name, tb.label)} title="CSV">
                  CSV
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {isSuper && (
        <Card className="p-5 mt-5 border-amber-500/40">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
              <Upload className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold">{t("p5d_restoreBackup")}</h3>
                <p className="text-sm text-muted-foreground">{t("p5d_restoreDesc")}</p>
              </div>
              <div className="rounded-md border border-amber-500/40 bg-amber-50/40 p-2 text-xs text-amber-800 flex gap-2 items-center">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("p5d_warningRestore")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                  <Upload className="h-4 w-4 mr-1" />{t("p5d_chooseFile")}
                </Button>
                {restoreFile && <span className="text-xs text-muted-foreground">{restoreFile.name}</span>}
                <label className="flex items-center gap-2 text-sm ml-auto">
                  <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} id="dry" />
                  <Label htmlFor="dry" className="text-sm cursor-pointer">{t("p5d_dryRun")}</Label>
                </label>
                <Button onClick={runRestore} disabled={!restoreFile || !!busy}>
                  {busy === "__restore__" ? t("p5d_restoreInProgress") : t("p5d_restoreNow")}
                </Button>
              </div>
              {restoreReport && (
                <div className="rounded-md border bg-muted/30 p-3 max-h-80 overflow-auto">
                  <div className="text-sm font-medium mb-2">{t("p5d_restoreSummary")}</div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("p5d_table")}</TableHead>
                      <TableHead className="text-right">{t("p5d_inserted")}</TableHead>
                      <TableHead className="text-right">{t("p5d_updated")}</TableHead>
                      <TableHead className="text-right">{t("p5d_failed")}</TableHead>
                      <TableHead className="text-right">{t("p5d_skipped")}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {restoreReport.map(r => (
                        <TableRow key={r.table}>
                          <TableCell className="font-mono text-xs">{r.table}</TableCell>
                          <TableCell className="text-right">{r.inserted}</TableCell>
                          <TableCell className="text-right">{r.updated}</TableCell>
                          <TableCell className="text-right text-destructive">{r.failed}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{r.skipped}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {restoreReport.flatMap(r => r.errors).length > 0 && (
                    <ul className="mt-2 text-xs text-destructive list-disc pl-5 space-y-0.5">
                      {restoreReport.flatMap(r => r.errors.map((e, i) => <li key={`${r.table}-${i}`}>{r.table}: {e}</li>))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

