import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
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
  savings_total: number; // sum of approved share_collection savings_transactions
  ledger_total: number;  // sum of credits to share-capital account (3020) for this farmer
  diff: number;
}

export default function ShareCapitalReconciliation() {
  const { isAdmin, rolesLoaded } = useAuth();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 365 * 86400_000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [hideMatched, setHideMatched] = useState(true);

  useEffect(() => {
    document.title = "Share Capital Reconciliation";
    (async () => {
      const { data } = await supabase.from("accounts").select("id").eq("code", "3020").maybeSingle();
      setAccountId((data as any)?.id ?? null);
    })();
  }, []);

  async function run() {
    if (!accountId) { toast.error("Share Capital account (code 3020) not found"); return; }
    setLoading(true);
    try {
      // 1) Sum of approved share_collection savings transactions per farmer
      const { data: txns, error: e1 } = await supabase
        .from("savings_transactions")
        .select("farmer_id, amount, txn_date")
        .eq("type", "share_collection")
        .eq("status", "approved")
        .is("deleted_at", null)
        .gte("txn_date", from)
        .lte("txn_date", to);
      if (e1) throw e1;

      const savingsMap = new Map<string, number>();
      (txns ?? []).forEach((t: any) => {
        savingsMap.set(t.farmer_id, (savingsMap.get(t.farmer_id) ?? 0) + Number(t.amount ?? 0));
      });

      // 2) Sum of ledger entries posted to Share Capital account, grouped by reference_id (savings txn id) → farmer
      const { data: ledger, error: e2 } = await supabase
        .from("ledger_entries")
        .select("credit, debit, reference_id, reference_type, entry_date")
        .eq("account_id", accountId)
        .gte("entry_date", from)
        .lte("entry_date", to)
        .limit(50000);
      if (e2) throw e2;

      // Map reference_id → farmer_id via savings_transactions
      const refIds = Array.from(new Set((ledger ?? []).map((l: any) => l.reference_id).filter(Boolean)));
      const refToFarmer = new Map<string, string>();
      if (refIds.length) {
        // Chunk to avoid URL limits
        for (let i = 0; i < refIds.length; i += 200) {
          const slice = refIds.slice(i, i + 200);
          const { data: refs } = await supabase
            .from("savings_transactions")
            .select("id, farmer_id")
            .in("id", slice);
          (refs ?? []).forEach((r: any) => refToFarmer.set(r.id, r.farmer_id));
        }
      }
      const ledgerMap = new Map<string, number>();
      (ledger ?? []).forEach((l: any) => {
        const fid = refToFarmer.get(l.reference_id);
        if (!fid) return;
        const amt = Number(l.credit ?? 0) - Number(l.debit ?? 0);
        ledgerMap.set(fid, (ledgerMap.get(fid) ?? 0) + amt);
      });

      // 3) Resolve farmer info
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
      toast.success(`${result.length} farmers checked · ${mismatches} mismatches`);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setLoading(false);
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
    if (!visible.length) { toast.error("Nothing to export"); return; }
    const headers = ["Farmer Code", "Farmer", "Savings Total", "Ledger Total", "Difference", "Status"];
    const lines = [headers.join(",")];
    for (const r of visible) {
      const status = Math.abs(r.diff) < 0.01 ? "Matched" : r.diff > 0 ? "Missing in Ledger" : "Extra in Ledger";
      const cells = [r.farmer_code, `"${r.name.replace(/"/g, '""')}"`, r.savings_total, r.ledger_total, r.diff, status];
      lines.push(cells.join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `share-capital-reconciliation-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Share Capital Reconciliation"
        description="Compare savings_transactions (share_collection, approved) against ledger postings to account 3020. Highlights any mismatches per farmer."
        actions={
          <div className="flex gap-2">
            <Button onClick={run} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Run
            </Button>
            <Button onClick={exportCsv} variant="outline" size="sm" disabled={!visible.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="text-xs flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hideMatched} onChange={(e) => setHideMatched(e.target.checked)} />
              Show mismatches only
            </label>
          </div>
        </div>
        {!accountId && (
          <Alert className="mt-3" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Share Capital account (code 3020) not found in chart of accounts.</AlertDescription>
          </Alert>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Total Savings</div><div className="font-mono font-semibold">{money(totals.savings)}</div></div>
            <div><div className="text-xs text-muted-foreground">Total Ledger</div><div className="font-mono font-semibold">{money(totals.ledger)}</div></div>
            <div><div className="text-xs text-muted-foreground">Difference</div><div className={`font-mono font-semibold ${Math.abs(totals.diff) < 0.01 ? "text-success" : "text-destructive"}`}>{money(totals.diff)}</div></div>
            <div><div className="text-xs text-muted-foreground">Mismatches</div><div className="font-semibold">{totals.mismatches} {totals.mismatches === 0 ? <CheckCircle2 className="h-4 w-4 inline text-success" /> : <AlertTriangle className="h-4 w-4 inline text-destructive" />}</div></div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farmer Code</TableHead>
              <TableHead>Farmer</TableHead>
              <TableHead className="text-right">Savings Total</TableHead>
              <TableHead className="text-right">Ledger Total</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{rows.length === 0 ? "Click Run to start" : "All matched 🎉"}</TableCell></TableRow>
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
                    {matched ? <Badge variant="secondary">Matched</Badge>
                      : r.diff > 0 ? <Badge variant="destructive">Missing in Ledger</Badge>
                      : <Badge variant="destructive">Extra in Ledger</Badge>}
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
