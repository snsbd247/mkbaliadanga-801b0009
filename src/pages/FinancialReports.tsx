import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, fmtDate } from "@/lib/format";

type Account = { id: string; code: string; name: string; type: "asset"|"liability"|"income"|"expense"|"equity" };
type Entry = { id: string; entry_date: string; account_id: string; debit: number; credit: number; description: string | null };

export default function FinancialReports() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>(today);

  useEffect(() => {
    supabase.from("accounts").select("id,code,name,type").order("code")
      .then(({ data }) => setAccounts((data as Account[]) || []));
  }, []);

  useEffect(() => {
    let q = supabase.from("ledger_entries").select("id,entry_date,account_id,debit,credit,description").order("entry_date");
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    q.limit(10000).then(({ data }) => setEntries((data as Entry[]) || []));
  }, [from, to]);

  const balByAcct = useMemo(() => {
    const m = new Map<string, { debit: number; credit: number }>();
    for (const e of entries) {
      const cur = m.get(e.account_id) || { debit: 0, credit: 0 };
      cur.debit += Number(e.debit || 0);
      cur.credit += Number(e.credit || 0);
      m.set(e.account_id, cur);
    }
    return m;
  }, [entries]);

  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const trial = useMemo(() => {
    return accounts.map((a) => {
      const b = balByAcct.get(a.id) || { debit: 0, credit: 0 };
      const net = b.debit - b.credit;
      // For asset/expense show as debit; for liability/income/equity show as credit
      const isDebitNature = a.type === "asset" || a.type === "expense";
      return {
        ...a,
        debit: isDebitNature ? Math.max(net, 0) : Math.max(-net, 0) === 0 && net > 0 ? net : 0,
        credit: !isDebitNature ? Math.max(-net, 0) : Math.max(net, 0) === 0 && net < 0 ? -net : 0,
        raw: b,
      };
    });
  }, [accounts, balByAcct]);

  const trialTotals = trial.reduce(
    (a, r) => ({ debit: a.debit + r.raw.debit, credit: a.credit + r.raw.credit }),
    { debit: 0, credit: 0 },
  );

  const incomeRows = trial.filter((r) => r.type === "income");
  const expenseRows = trial.filter((r) => r.type === "expense");
  const totalIncome = incomeRows.reduce((s, r) => s + (r.raw.credit - r.raw.debit), 0);
  const totalExpense = expenseRows.reduce((s, r) => s + (r.raw.debit - r.raw.credit), 0);
  const netIncome = totalIncome - totalExpense;

  const assetRows = trial.filter((r) => r.type === "asset");
  const liabilityRows = trial.filter((r) => r.type === "liability");
  const equityRows = trial.filter((r) => r.type === "equity");
  const totalAssets = assetRows.reduce((s, r) => s + (r.raw.debit - r.raw.credit), 0);
  const totalLiabilities = liabilityRows.reduce((s, r) => s + (r.raw.credit - r.raw.debit), 0);
  const totalEquity = equityRows.reduce((s, r) => s + (r.raw.credit - r.raw.debit), 0) + netIncome;

  // Cash book: entries that hit Cash (1010)
  const cashAcct = accounts.find((a) => a.code === "1010");
  const cashEntries = useMemo(() => {
    if (!cashAcct) return [];
    return entries.filter((e) => e.account_id === cashAcct.id);
  }, [entries, cashAcct]);
  const cashTotal = cashEntries.reduce(
    (a, e) => ({ in: a.in + Number(e.debit || 0), out: a.out + Number(e.credit || 0) }),
    { in: 0, out: 0 },
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Financial Reports" description="Trial Balance, Income Statement, Balance Sheet, Cash Book" />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trial">
        <TabsList>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="pnl">Income Statement</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash">Cash Book</TabsTrigger>
        </TabsList>

        <TabsContent value="trial">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {trial.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                    <TableCell className="text-right">{r.raw.debit ? money(r.raw.debit) : ""}</TableCell>
                    <TableCell className="text-right">{r.raw.credit ? money(r.raw.credit) : ""}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell className="text-right">{money(trialTotals.debit)}</TableCell>
                  <TableCell className="text-right">{money(trialTotals.credit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.abs(trialTotals.debit - trialTotals.credit) < 0.01 ? "✅ Balanced" : "⚠ Out of balance"}
            </p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pnl">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Income</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>Total Income</TableCell><TableCell className="text-right">{money(totalIncome)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Expense</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {expenseRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{money(r.raw.debit - r.raw.credit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>Total Expense</TableCell><TableCell className="text-right">{money(totalExpense)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardContent className="pt-6 flex justify-between text-lg font-semibold">
              <span>Net {netIncome >= 0 ? "Profit" : "Loss"}</span>
              <span className={netIncome >= 0 ? "text-primary" : "text-destructive"}>{money(Math.abs(netIncome))}</span>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bs">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {assetRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.debit - r.raw.credit)}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>Total Assets</TableCell><TableCell className="text-right">{money(totalAssets)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Liabilities + Equity</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {liabilityRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell></TableRow>
                  ))}
                  <TableRow><TableCell>Retained Earnings (Net Income)</TableCell><TableCell className="text-right">{money(netIncome)}</TableCell></TableRow>
                  {equityRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>Total Liab. + Equity</TableCell><TableCell className="text-right">{money(totalLiabilities + totalEquity)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? "✅ Balanced" : "⚠ Out of balance"}
          </p>
        </TabsContent>

        <TabsContent value="cash">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Description</TableHead>
                <TableHead className="text-right">Cash In</TableHead><TableHead className="text-right">Cash Out</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {cashEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.entry_date)}</TableCell>
                    <TableCell>{e.description || "-"}</TableCell>
                    <TableCell className="text-right">{e.debit > 0 ? money(e.debit) : ""}</TableCell>
                    <TableCell className="text-right">{e.credit > 0 ? money(e.credit) : ""}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Totals</TableCell>
                  <TableCell className="text-right">{money(cashTotal.in)}</TableCell>
                  <TableCell className="text-right">{money(cashTotal.out)}</TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell colSpan={3}>Net Cash</TableCell>
                  <TableCell className="text-right">{money(cashTotal.in - cashTotal.out)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
