import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import {
  RefreshCw, FileDown, FileSpreadsheet, ShieldAlert, Lock, ArrowRight,
} from "lucide-react";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { getFiscalStartMonth, listFiscalYears, monthRange, quarterRange } from "@/lib/accounting";

type AccountRow = { id: string; code: string; name: string; type: "asset" | "liability" | "equity" | "income" | "expense" };
type LedgerRow = { account_id: string; debit: number; credit: number };

export default function FinanceSummary() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fyMonth, setFyMonth] = useState(7);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [sums, setSums] = useState<Record<string, { d: number; c: number }>>({});
  const [periods, setPeriods] = useState<any[]>([]);
  const [integrity, setIntegrity] = useState<{ unbalanced: number; orphan: number; missing_account: number; total_entries: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Load accounts + fiscal start once
  useEffect(() => {
    (async () => {
      const [{ data: accs }, m] = await Promise.all([
        supabase.from("accounts").select("id,code,name,type").order("code"),
        getFiscalStartMonth(),
      ]);
      setAccounts((accs as AccountRow[]) || []);
      setFyMonth(m);
      // default range = current FY
      const fy = listFiscalYears(m, 1)[0];
      setFrom(fy.range.from);
      setTo(fy.range.to);
    })();
  }, []);

  const fyOptions = useMemo(() => listFiscalYears(fyMonth, 4), [fyMonth]);

  const acctById = useMemo(() => {
    const map: Record<string, AccountRow> = {};
    accounts.forEach((a) => (map[a.id] = a));
    return map;
  }, [accounts]);

  // Fetch ledger sums for selected range
  const refresh = async () => {
    if (!from || !to) return;
    setLoading(true);
    const [led, prd, integ] = await Promise.all([
      supabase
        .from("ledger_entries")
        .select("account_id,debit,credit")
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase.from("accounting_periods").select("*").order("period_end", { ascending: false }).limit(8),
      supabase.rpc("ledger_integrity_summary"),
    ]);
    const map: Record<string, { d: number; c: number }> = {};
    ((led.data as LedgerRow[]) || []).forEach((r) => {
      const cur = map[r.account_id] || { d: 0, c: 0 };
      cur.d += Number(r.debit) || 0;
      cur.c += Number(r.credit) || 0;
      map[r.account_id] = cur;
    });
    setSums(map);
    setPeriods((prd.data as any[]) || []);
    setIntegrity((integ.data as any) || null);
    setLoading(false);
  };

  useEffect(() => { if (from && to) refresh(); /* eslint-disable-next-line */ }, [from, to]);

  // ------- Derived numbers -------
  const trial = useMemo(() => {
    let d = 0, c = 0;
    const rows = accounts.map((a) => {
      const s = sums[a.id] || { d: 0, c: 0 };
      d += s.d; c += s.c;
      return { ...a, debit: s.d, credit: s.c, diff: s.d - s.c };
    });
    return { rows, totalDebit: d, totalCredit: c, balanced: Math.abs(d - c) < 0.01 };
  }, [accounts, sums]);

  const pl = useMemo(() => {
    let income = 0, expense = 0;
    accounts.forEach((a) => {
      const s = sums[a.id] || { d: 0, c: 0 };
      if (a.type === "income") income += s.c - s.d;
      if (a.type === "expense") expense += s.d - s.c;
    });
    return { income, expense, net: income - expense };
  }, [accounts, sums]);

  const cash = useMemo(() => {
    const cashAcct = accounts.find((a) => a.code === "1010");
    if (!cashAcct) return { in: 0, out: 0, net: 0 };
    const s = sums[cashAcct.id] || { d: 0, c: 0 };
    return { in: s.d, out: s.c, net: s.d - s.c };
  }, [accounts, sums]);

  const lastPeriod = periods.find((p) => p.status === "closed");
  const isInsideClosed = useMemo(() => {
    if (!from || !to) return false;
    return periods.some(
      (p) => p.status === "closed" && from >= p.period_start && to <= p.period_end
    );
  }, [periods, from, to]);

  // ------- Presets -------
  const presetFY = (i: number) => { const fy = fyOptions[i]; if (fy) { setFrom(fy.range.from); setTo(fy.range.to); } };
  const presetMonth = (off: number) => {
    const d = new Date(); d.setMonth(d.getMonth() + off);
    const r = monthRange(d.getFullYear(), d.getMonth() + 1);
    setFrom(r.from); setTo(r.to);
  };
  const presetQuarter = () => {
    const d = new Date(); const q = Math.floor(d.getMonth() / 3) + 1;
    const r = quarterRange(d.getFullYear(), q);
    setFrom(r.from); setTo(r.to);
  };

  // ------- Exports -------
  const summaryRows = () => [
    { Section: "Trial Balance", Metric: "Total Debit", Amount: trial.totalDebit },
    { Section: "Trial Balance", Metric: "Total Credit", Amount: trial.totalCredit },
    { Section: "Trial Balance", Metric: "Balanced", Amount: trial.balanced ? "Yes" : "No" },
    { Section: "P&L", Metric: "Total Income", Amount: pl.income },
    { Section: "P&L", Metric: "Total Expense", Amount: pl.expense },
    { Section: "P&L", Metric: "Net Income", Amount: pl.net },
    { Section: "Cash Book", Metric: "Cash In", Amount: cash.in },
    { Section: "Cash Book", Metric: "Cash Out", Amount: cash.out },
    { Section: "Cash Book", Metric: "Net Cash", Amount: cash.net },
  ];

  const exportPDF = () => {
    exportTablePDF(
      "Finance Summary",
      ["Section", "Metric", "Amount"],
      summaryRows().map((r) => [r.Section, r.Metric, typeof r.Amount === "number" ? money(r.Amount) : String(r.Amount)]),
      { from, to },
    );
  };
  const exportXLSX = () => exportExcel("Finance Summary", "Summary", summaryRows(), { from, to });

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title="Finance Summary"
        description="One-page snapshot of Trial Balance, P&L, Cash Book and period status"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportXLSX}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => presetMonth(-1)}>Last Month</Button>
            <Button variant="outline" size="sm" onClick={() => presetMonth(0)}>This Month</Button>
            <Button variant="outline" size="sm" onClick={presetQuarter}>This Quarter</Button>
            {fyOptions.slice(0, 2).map((fy, i) => (
              <Button key={fy.label} variant="outline" size="sm" onClick={() => presetFY(i)}>FY {fy.label}</Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="flex items-end">
              {isInsideClosed && (
                <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Closed period (read-only)</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Trial Balance</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm"><span>Total Debit</span><span className="tabular-nums">{money(trial.totalDebit)}</span></div>
            <div className="flex justify-between text-sm"><span>Total Credit</span><span className="tabular-nums">{money(trial.totalCredit)}</span></div>
            <div className="flex justify-between text-sm pt-1 border-t">
              <span>Status</span>
              {trial.balanced
                ? <Badge variant="secondary">Balanced</Badge>
                : <Badge variant="destructive">Off by {money(Math.abs(trial.totalDebit - trial.totalCredit))}</Badge>}
            </div>
            <Link to="/financial-reports" className="text-xs text-primary inline-flex items-center gap-1 pt-1">View report <ArrowRight className="h-3 w-3" /></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Profit & Loss</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm"><span>Income</span><span className="tabular-nums text-primary">{money(pl.income)}</span></div>
            <div className="flex justify-between text-sm"><span>Expense</span><span className="tabular-nums">{money(pl.expense)}</span></div>
            <div className="flex justify-between text-sm pt-1 border-t font-semibold">
              <span>Net</span>
              <span className={`tabular-nums ${pl.net >= 0 ? "text-primary" : "text-destructive"}`}>{money(pl.net)}</span>
            </div>
            <Link to="/financial-reports" className="text-xs text-primary inline-flex items-center gap-1 pt-1">View report <ArrowRight className="h-3 w-3" /></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cash Book</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm"><span>Cash In</span><span className="tabular-nums text-primary">{money(cash.in)}</span></div>
            <div className="flex justify-between text-sm"><span>Cash Out</span><span className="tabular-nums">{money(cash.out)}</span></div>
            <div className="flex justify-between text-sm pt-1 border-t font-semibold">
              <span>Net Cash</span>
              <span className={`tabular-nums ${cash.net >= 0 ? "text-primary" : "text-destructive"}`}>{money(cash.net)}</span>
            </div>
            <Link to="/cashbook" className="text-xs text-primary inline-flex items-center gap-1 pt-1">View cashbook <ArrowRight className="h-3 w-3" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* Integrity + period status */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Ledger Integrity
            </CardTitle>
            <Link to="/ledger-integrity"><Button size="sm" variant="outline">Open</Button></Link>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Unbalanced" value={integrity?.unbalanced ?? 0} bad={(integrity?.unbalanced ?? 0) > 0} />
            <Stat label="Orphans" value={integrity?.orphan ?? 0} bad={(integrity?.orphan ?? 0) > 0} />
            <Stat label="No account" value={integrity?.missing_account ?? 0} bad={(integrity?.missing_account ?? 0) > 0} />
            <div className="col-span-3 text-xs text-muted-foreground">Total ledger entries: {integrity?.total_entries ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" /> Period Close Status
            </CardTitle>
            <Link to="/period-close"><Button size="sm" variant="outline">Manage</Button></Link>
          </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No periods recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {lastPeriod && (
                  <div className="text-sm">
                    Last closed: <span className="font-medium">{fmtDate(lastPeriod.period_start)} → {fmtDate(lastPeriod.period_end)}</span>
                    <span className="text-muted-foreground"> · Net {money(lastPeriod.net_income)}</span>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.slice(0, 5).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "closed" ? "secondary" : "outline"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${p.net_income >= 0 ? "text-primary" : "text-destructive"}`}>{money(p.net_income)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${bad ? "text-destructive" : "text-primary"}`}>{value}</div>
    </div>
  );
}
