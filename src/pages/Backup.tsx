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
import { Download, Database, FileSpreadsheet, Upload, AlertTriangle, ShieldCheck, FileCode2, Loader2 } from "lucide-react";
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
  const { isSuper, isDeveloper, session } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snapshotBlob, setSnapshotBlob] = useState<{ url: string; name: string } | null>(null);
  const [restoreReport, setRestoreReport] = useState<{ table: string; inserted: number; updated: number; failed: number; skipped: number; errors: string[] }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Full SQL backup (developer-only)
  const sqlFileRef = useRef<HTMLInputElement>(null);
  const [sqlRestoreFile, setSqlRestoreFile] = useState<File | null>(null);
  const [sqlConfirmOpen, setSqlConfirmOpen] = useState(false);
  const [sqlResult, setSqlResult] = useState<{ ok: boolean; message: string; durationMs?: number } | null>(null);

  // ---- Full SQL backup / restore (developer only) ----
  async function downloadFullSql() {
    if (!session?.access_token) return toast.error("Not authenticated");
    setBusy("__sql_export__");
    try {
      const url = `https://jcdonpeftfrnzblhtsqo.supabase.co/functions/v1/db-export?mode=data`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const sqlBlob = new Blob([blob], { type: "application/sql" });
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(sqlBlob);
      a.href = objUrl;
      a.download = `lovable-full-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success("SQL backup downloaded");
    } catch (e: any) {
      toast.error(`SQL backup failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  async function restoreFullSql() {
    if (!sqlRestoreFile) return toast.error("Choose a .sql file first");
    if (!session?.access_token) return toast.error("Not authenticated");
    setSqlConfirmOpen(false);
    setBusy("__sql_restore__");
    setSqlResult(null);
    try {
      const sqlText = await sqlRestoreFile.text();
      const url = `https://jcdonpeftfrnzblhtsqo.supabase.co/functions/v1/db-restore`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/sql",
        },
        body: sqlText,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.errors?.join("; ") ?? json.error ?? `HTTP ${res.status}`;
        setSqlResult({ ok: false, message: msg });
        toast.error(`Restore failed: ${msg.slice(0, 120)}`);
      } else {
        setSqlResult({ ok: true, message: "Restore completed", durationMs: json.duration_ms });
        toast.success(`Restore completed in ${(json.duration_ms / 1000).toFixed(1)}s`);
      }
    } catch (e: any) {
      setSqlResult({ ok: false, message: e.message });
      toast.error(`Restore failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }


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

  async function buildSnapshot(targetTables: string[]): Promise<{ url: string; name: string }> {
    const wb = XLSX.utils.book_new();
    for (const name of targetTables) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rows = await fetchAll(name);
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "empty" }]);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      } catch (e) {
        // skip restricted
      }
    }
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const fname = `pre-restore-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
    return { url, name: fname };
  }

  async function startRestore() {
    if (!restoreFile) return toast.error(t("p5d_invalidFile"));
    if (dryRun) {
      // Dry runs do not need a snapshot — they don't write anything.
      return runRestore(null);
    }
    setConfirmOpen(false);
    setBusy("__restore__");
    setSnapshotBlob(null);
    setRestoreReport(null);
    try {
      // 1. Parse upload to know which tables we will touch.
      const buf = await restoreFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const targets = wb.SheetNames.map(inferTableFromSheet).filter((x): x is string => !!x);
      // 2. Snapshot those tables BEFORE writing anything.
      toast.message(t("p5e_takingSnapshot"));
      const snap = await buildSnapshot(targets);
      setSnapshotBlob(snap);
      toast.success(t("p5e_snapshotReady"));
      // 3. Run the actual restore. Failure → snapshot stays available for download.
      await runRestore(wb);
    } catch (e: any) {
      toast.error(`${t("p5e_restoreFailed")}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  async function runRestore(prebuiltWb: XLSX.WorkBook | null) {
    if (!restoreFile) return;
    setRestoreReport(null);
    try {
      const wb = prebuiltWb ?? XLSX.read(await restoreFile.arrayBuffer(), { type: "array" });
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
      const anyFail = summaries.some(s => s.failed > 0);
      if (anyFail && !dryRun) toast.error(t("p5e_restoreFailed"));
      else toast.success(dryRun ? t("p5d_restoreSummary") : t("p5d_restoreDone"));
    } catch (e: any) {
      toast.error(`${t("p5e_restoreFailed")}: ${e.message}`);
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
                <Button onClick={() => (dryRun ? startRestore() : setConfirmOpen(true))} disabled={!restoreFile || !!busy}>
                  {busy === "__restore__" ? t("p5d_restoreInProgress") : t("p5d_restoreNow")}
                </Button>
              </div>
              {snapshotBlob && (
                <div className="rounded-md border bg-emerald-50/40 border-emerald-500/40 p-2 text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t("p5e_rollbackHint")}</span>
                  <a href={snapshotBlob.url} download={snapshotBlob.name} className="underline font-medium">
                    {t("p5e_downloadSnapshot")}
                  </a>
                </div>
              )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("p5e_confirmRestoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("p5e_confirmRestoreDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("p5e_no")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => startRestore()}>{t("p5e_yesRestore")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

