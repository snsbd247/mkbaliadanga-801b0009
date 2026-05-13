import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useTrialBalance, useProfitAndLoss, useBalanceSheet, useCashbook } from "@/hooks/useReportsApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ApiReports() {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [asOf, setAsOf] = useState(today);

  const tb = useTrialBalance({ from, to });
  const pl = useProfitAndLoss({ from, to });
  const bs = useBalanceSheet({ as_of: asOf });
  const cb = useCashbook({ from, to });

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle>Financial Reports</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div><Label>As of (Balance Sheet)</Label><Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tb">
          <TabsList>
            <TabsTrigger value="tb">Trial Balance</TabsTrigger>
            <TabsTrigger value="pl">P &amp; L</TabsTrigger>
            <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cb">Cashbook</TabsTrigger>
          </TabsList>

          <TabsContent value="tb">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tb.data?.rows?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell>
                      <TableCell className="capitalize">{r.type}</TableCell>
                      <TableCell className="text-right">{fmt(r.debit)}</TableCell>
                      <TableCell className="text-right">{fmt(r.credit)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pl">
            <Card><CardContent className="pt-6 space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Income</p><p className="text-2xl font-bold">{fmt(pl.data?.income)}</p></div>
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Expense</p><p className="text-2xl font-bold">{fmt(pl.data?.expense)}</p></div>
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Profit</p><p className="text-2xl font-bold text-primary">{fmt(pl.data?.profit)}</p></div>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="bs">
            <Card><CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Assets</p><p className="text-2xl font-bold">{fmt(bs.data?.assets)}</p></div>
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Liabilities</p><p className="text-2xl font-bold">{fmt(bs.data?.liabilities)}</p></div>
                <div className="rounded border p-4"><p className="text-xs text-muted-foreground">Equity</p><p className="text-2xl font-bold">{fmt(bs.data?.equity)}</p></div>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="cb">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Memo</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cb.data?.rows?.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.entry_date}</TableCell>
                      <TableCell>{r.code} — {r.name}</TableCell>
                      <TableCell>{r.memo || "-"}</TableCell>
                      <TableCell className="text-right">{fmt(r.debit)}</TableCell>
                      <TableCell className="text-right">{fmt(r.credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </ApiShell>
  );
}
