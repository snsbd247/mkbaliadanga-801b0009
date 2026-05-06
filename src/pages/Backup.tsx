import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { Download, Database, FileSpreadsheet } from "lucide-react";
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
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

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
    </>
  );
}
