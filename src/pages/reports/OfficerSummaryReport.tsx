import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Loader2, Trophy, Medal } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Source = "irrigation" | "loan" | "savings";

type Row = {
  date: string;
  source: Source;
  amount: number;
  user_id: string | null;
};

type ProfileLite = { id: string; full_name: string | null; email: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export default function OfficerSummaryReport() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<ProfileLite[]>([]);

  useEffect(() => {
    supabase.rpc("list_collector_users").then(({ data }) => setUsers((data as ProfileLite[]) ?? []));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const out: Row[] = [];

      const [irrRes, lpRes, svRes] = await Promise.all([
        db.from("irrigation_invoice_payments")
          .select("created_at,collected_amount,created_by")
          .gt("collected_amount", 0)
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59`)
          .limit(5000),
        db.from("loan_payments")
          .select("paid_on,amount,collected_by")
          .gte("paid_on", from).lte("paid_on", to)
          .limit(5000),
        db.from("savings_transactions")
          .select("txn_date,amount,type,status,created_by")
          .is("deleted_at", null).eq("type", "deposit").eq("status", "approved")
          .gte("txn_date", from).lte("txn_date", to)
          .limit(5000),
      ]);

      for (const r of irrRes.data ?? []) out.push({
        date: (r.created_at || "").slice(0, 10),
        source: "irrigation", amount: Number(r.collected_amount || 0),
        user_id: r.created_by,
      });
      for (const r of lpRes.data ?? []) out.push({
        date: r.paid_on, source: "loan", amount: Number(r.amount || 0),
        user_id: r.collected_by,
      });
      for (const r of svRes.data ?? []) out.push({
        date: r.txn_date, source: "savings", amount: Number(r.amount || 0),
        user_id: r.created_by,
      });

      setRows(out);
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  function nameFor(id: string | null): string {
    if (!id) return "System";
    const u = users.find(x => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  }

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  const byUser = useMemo(() => {
    const m = new Map<string, { id: string | null; name: string; total: number; irrigation: number; loan: number; savings: number; count: number }>();
    for (const r of rows) {
      const key = r.user_id ?? "system";
      const cur = m.get(key) ?? { id: r.user_id, name: nameFor(r.user_id), total: 0, irrigation: 0, loan: 0, savings: 0, count: 0 };
      cur.total += r.amount;
      cur[r.source] += r.amount;
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, users]);

  const chartData = useMemo(
    () => byUser.slice(0, 10).map(u => ({
      name: u.name.length > 14 ? u.name.slice(0, 12) + "…" : u.name,
      Irrigation: u.irrigation, Loan: u.loan, Savings: u.savings,
    })),
    [byUser],
  );

  async function onPdf() {
    setPdfBusy(true);
    try {
      const head = ["Rank", "Officer", "Receipts", "Irrigation", "Loan", "Savings", "Total", "% Share"];
      const body = byUser.map((u, i) => [
        String(i + 1), u.name, String(u.count),
        money(u.irrigation), money(u.loan), money(u.savings), money(u.total),
        total > 0 ? `${((u.total / total) * 100).toFixed(1)}%` : "—",
      ]);
      body.push(["", "Total", String(rows.length), "", "", "", money(total), "100%"]);
      await exportTablePDF(`Collection Officer Summary`, head, body, { from, to });
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally { setPdfBusy(false); }
  }

  function onExcel() {
    const data = byUser.map((u, i) => ({
      Rank: i + 1, Officer: u.name, Receipts: u.count,
      Irrigation: u.irrigation, Loan: u.loan, Savings: u.savings,
      Total: u.total, "% Share": total > 0 ? Number(((u.total / total) * 100).toFixed(1)) : 0,
    }));
    exportExcel(`officer-summary-${from}-to-${to}`, "Officer Summary", data, { from, to });
  }

  return (
    <>
      <PageHeader
        title="Collection Officer Summary"
        description="Date range, type-wise breakdown and top performer ranking."
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <Button onClick={onPdf} disabled={pdfBusy || !byUser.length} variant="secondary">
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button onClick={onExcel} disabled={!byUser.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Collection</div>
          <div className="text-2xl font-bold mt-1">{money(total)}</div>
          <div className="text-xs text-muted-foreground mt-1">{rows.length} receipts • {byUser.length} officers</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Period</div>
          <div className="text-sm font-medium mt-1">{fmtDate(from)} → {fmtDate(to)}</div>
        </Card>
        {byUser[0] && (
          <Card className="p-4 md:col-span-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trophy className="h-4 w-4 text-amber-500" /> Top Performer
            </div>
            <div className="text-lg font-bold mt-1">{byUser[0].name}</div>
            <div className="text-sm">
              {money(byUser[0].total)} • {total > 0 ? ((byUser[0].total / total) * 100).toFixed(1) : 0}% of total
            </div>
          </Card>
        )}
      </div>

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold mb-2">Top 10 Officers — Type Breakdown</div>
        <div className="h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No data"}
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Legend />
                <Bar dataKey="Irrigation" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Loan" stackId="a" fill="hsl(var(--chart-2, 199 89% 48%))" />
                <Bar dataKey="Savings" stackId="a" fill="hsl(var(--chart-3, 142 71% 45%))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Officer</TableHead>
              <TableHead className="text-right">Receipts</TableHead>
              <TableHead className="text-right">Irrigation</TableHead>
              <TableHead className="text-right">Loan</TableHead>
              <TableHead className="text-right">Savings</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right w-24">% Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : byUser.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {byUser.map((u, i) => {
                  const share = total > 0 ? (u.total / total) * 100 : 0;
                  const medal = i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "";
                  return (
                    <TableRow key={u.id ?? "system"}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {i < 3 ? <Medal className={`h-4 w-4 ${medal}`} /> : null}
                          <span className="font-mono">{i + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-right">{u.count}</TableCell>
                      <TableCell className="text-right">{u.irrigation ? money(u.irrigation) : "—"}</TableCell>
                      <TableCell className="text-right">{u.loan ? money(u.loan) : "—"}</TableCell>
                      <TableCell className="text-right">{u.savings ? money(u.savings) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{money(u.total)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{share.toFixed(1)}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{rows.length}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-right">{money(total)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
