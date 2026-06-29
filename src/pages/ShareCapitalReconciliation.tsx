import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

interface FarmerRow {
  farmer_id: string;
  farmer_code: string;
  name: string;
  savings_total: number;
  ledger_total: number;
  diff: number;
}

const PAGE_SIZE = 1000;

async function fetchAllChunked<T = any>(
  build: (from: number, to: number) => any
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  // hard cap to prevent runaway
  for (let i = 0; i < 200; i++) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

export default function ShareCapitalReconciliation() {
  const { isAdmin, rolesLoaded } = useAuth();
  const { t } = useLang();
  const today = new Date();
  const yearAgo = new Date(today.getTime() - 365 * 86400_000);
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [hideMatched, setHideMatched] = useState(true);

  useEffect(() => {
    document.title = t("shareCapitalReconciliation");
    (async () => {
      const { data } = await db.from("accounts").select("id").eq("code", "3020").maybeSingle();
      setAccountId((data as any)?.id ?? null);
    })();
  }, [t]);

  async function run() {
    if (!accountId) { toast.error(t("shareAccountNotFound")); return; }
    setLoading(true);
    setProgress("Loading savings…");
    try {
      const txns = await fetchAllChunked<any>((f, to_) =>
        supabase
          .from("savings_transactions")
          .select("farmer_id, amount, txn_date")
          .eq("type", "share_collection")
          .eq("status", "approved")
          .is("deleted_at", null)
          .gte("txn_date", from)
          .lte("txn_date", to)
          .range(f, to_)
      );
      const savingsMap = new Map<string, number>();
      txns.forEach((t: any) => {
        savingsMap.set(t.farmer_id, (savingsMap.get(t.farmer_id) ?? 0) + Number(t.amount ?? 0));
      });

      setProgress("Loading ledger…");
      const ledger = await fetchAllChunked<any>((f, to_) =>
        supabase
          .from("ledger_entries")
          .select("credit, debit, reference_id")
          .eq("account_id", accountId)
          .gte("entry_date", from)
          .lte("entry_date", to)
          .range(f, to_)
      );

      const refIds = Array.from(new Set(ledger.map((l: any) => l.reference_id).filter(Boolean)));
      const refToFarmer = new Map<string, string>();
      for (let i = 0; i < refIds.length; i += 200) {
        const slice = refIds.slice(i, i + 200);
        const { data: refs } = await supabase
          .from("savings_transactions")
          .select("id, farmer_id")
          .in("id", slice);
        (refs ?? []).forEach((r: any) => refToFarmer.set(r.id, r.farmer_id));
      }
      const ledgerMap = new Map<string, number>();
      ledger.forEach((l: any) => {
        const fid = refToFarmer.get(l.reference_id);
        if (!fid) return;
        const amt = Number(l.credit ?? 0) - Number(l.debit ?? 0);
        ledgerMap.set(fid, (ledgerMap.get(fid) ?? 0) + amt);
      });

      setProgress("Resolving farmers…");
      const allFarmerIds = Array.from(new Set([...savingsMap.keys(), ...ledgerMap.keys()]));
      if (!allFarmerIds.length) { setRows([]); return; }
      const farmers: any[] = [];
      for (let i = 0; i < allFarmerIds.length; i += 200) {
        const slice = allFarmerIds.slice(i, i + 200);
        const { data: fs } = await supabase
          .from("farmers")
          .select("id, farmer_code, name_en, name_bn")
          .in("id", slice);
        farmers.push(...(fs ?? []));
      }
      const fmap = new Map<string, any>(farmers.map((f) => [f.id, f]));

      const result: FarmerRow[] = allFarmerIds.map((fid) => {
        const f = fmap.get(fid);
        const s = savingsMap.get(fid) ?? 0;
        const l = ledgerMap.get(fid) ?? 0;
        return {
          farmer_id: fid,
          farmer_code: f?.farmer_code ?? "—",
          name: f?.name_bn ? `${f?.name_en ?? ""} (${f.name_bn})` : (f?.name_en ?? "—"),
          savings_total: s,
          ledger_total: l,
          diff: Number((s - l).toFixed(2)),
        };
      }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

      setRows(result);
      const mismatches = result.filter((r) => Math.abs(r.diff) > 0.01).length;
      toast.success(t("farmersChecked").replace("{n}", String(result.length)).replace("{m}", String(mismatches)));
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  const visible = useMemo(
    () => (hideMatched ? rows.filter((r) => Math.abs(r.diff) > 0.01) : rows),
    [rows, hideMatched]
  );

  const totals = useMemo(() => {
    const s = rows.reduce((a, r) => a + r.savings_total, 0);
    const l = rows.reduce((a, r) => a + r.ledger_total, 0);
    return { savings: s, ledger: l, diff: s - l, mismatches: rows.filter((r) => Math.abs(r.diff) > 0.01).length };
  }, [rows]);

  function exportCsv() {
    if (!visible.length) { toast.error(t("nothingToExport")); return; }
    const headers = [t("farmerCode"), t("farmerName"), t("totalSavingsRecon"), t("totalLedger"), t("difference"), t("status")];
    const lines = [headers.join(",")];
    for (const r of visible) {
      const status = Math.abs(r.diff) < 0.01 ? t("matched") : r.diff > 0 ? t("missingInLedger") : t("extraInLedger");
      const cells = [r.farmer_code, `"${r.name.replace(/"/g, '""')}"`, r.savings_total, r.ledger_total, r.diff, status];
      lines.push(cells.join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `share-capital-reconciliation-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title={t("shareCapitalReconciliation")}
        description={t("shareCapitalReconciliationDesc")}
        actions={
          <div className="flex gap-2">
            <Button onClick={run} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("run")}
            </Button>
            <Button onClick={exportCsv} variant="outline" size="sm" disabled={!visible.length}>
              <Download className="h-4 w-4" /> {t("csv")}
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="text-xs flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hideMatched} onChange={(e) => setHideMatched(e.target.checked)} />
              {t("showMismatchesOnly")}
            </label>
          </div>
          {progress && <div className="flex items-end text-xs text-muted-foreground">{progress}</div>}
        </div>
        {!accountId && (
          <Alert className="mt-3" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t("shareAccountNotFound")}</AlertDescription>
          </Alert>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div><div className="text-xs text-muted-foreground">{t("totalSavingsRecon")}</div><div className="font-mono font-semibold">{money(totals.savings)}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("totalLedger")}</div><div className="font-mono font-semibold">{money(totals.ledger)}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("difference")}</div><div className={`font-mono font-semibold ${Math.abs(totals.diff) < 0.01 ? "text-success" : "text-destructive"}`}>{money(totals.diff)}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("mismatches")}</div><div className="font-semibold">{totals.mismatches} {totals.mismatches === 0 ? <CheckCircle2 className="h-4 w-4 inline text-success" /> : <AlertTriangle className="h-4 w-4 inline text-destructive" />}</div></div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("farmerCode")}</TableHead>
              <TableHead>{t("farmerName")}</TableHead>
              <TableHead className="text-right">{t("totalSavingsRecon")}</TableHead>
              <TableHead className="text-right">{t("totalLedger")}</TableHead>
              <TableHead className="text-right">{t("difference")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />{t("loading")}</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{rows.length === 0 ? t("clickRunToStart") : t("allMatched")}</TableCell></TableRow>
            ) : visible.map((r) => {
              const matched = Math.abs(r.diff) < 0.01;
              return (
                <TableRow key={r.farmer_id} className={!matched ? "bg-destructive/5" : ""}>
                  <TableCell className="font-mono text-xs">{r.farmer_code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.savings_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.ledger_total)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${matched ? "text-muted-foreground" : "text-destructive"}`}>{money(r.diff)}</TableCell>
                  <TableCell>
                    {matched ? <Badge variant="secondary">{t("matched")}</Badge>
                      : r.diff > 0 ? <Badge variant="destructive">{t("missingInLedger")}</Badge>
                      : <Badge variant="destructive">{t("extraInLedger")}</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
