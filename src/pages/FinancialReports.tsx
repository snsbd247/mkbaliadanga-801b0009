import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { getFiscalStartMonth, listFiscalYears, monthRange, quarterRange } from "@/lib/accounting";
import { useLang } from "@/i18n/LanguageProvider";

type Account = { id: string; code: string; name: string; type: "asset"|"liability"|"income"|"expense"|"equity" };
type Entry = { id: string; entry_date: string; account_id: string; debit: number; credit: number; description: string | null };

export default function FinancialReports() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [fyStartMonth, setFyStartMonth] = useState<number>(7);

  useEffect(() => {
    (async () => {
      const [{ data }, m] = await Promise.all([
        db.from("accounts").select("id,code,name,type").order("code"),
        getFiscalStartMonth(),
      ]);
      setAccounts((data as Account[]) || []);
      setFyStartMonth(m);
      // default to current fiscal year
      const fys = listFiscalYears(m, 1);
      if (fys[0]) { setFrom(fys[0].range.from); setTo(fys[0].range.to); }
    })();
  }, []);

  useEffect(() => {
    let q = db.from("ledger_entries").select("id,entry_date,account_id,debit,credit,description").order("entry_date");
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    q.limit(10000).then(({ data }) => setEntries((data as Entry[]) || []));
  }, [from, to]);

  const fyOptions = useMemo(() => listFiscalYears(fyStartMonth, 6), [fyStartMonth]);
  const range = { from, to };

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
      <PageHeader title={t("financialReports")} description={t("financialReportsDesc")} />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{t("fiscalYear")}</Label>
            <Select onValueChange={(v) => {
              const fy = fyOptions.find((f) => String(f.startYear) === v);
              if (fy) { setFrom(fy.range.from); setTo(fy.range.to); }
            }}>
              <SelectTrigger><SelectValue placeholder={t("selectFY")} /></SelectTrigger>
              <SelectContent>
                {fyOptions.map((f) => <SelectItem key={f.startYear} value={String(f.startYear)}>{t("fyPrefix")} {f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("quickPeriod")}</Label>
            <Select onValueChange={(v) => {
              const now = new Date();
              if (v === "this-month") { const r = monthRange(now.getFullYear(), now.getMonth() + 1); setFrom(r.from); setTo(r.to); }
              else if (v === "last-month") { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); const r = monthRange(d.getFullYear(), d.getMonth() + 1); setFrom(r.from); setTo(r.to); }
              else if (v.startsWith("q")) { const r = quarterRange(now.getFullYear(), Number(v.slice(1))); setFrom(r.from); setTo(r.to); }
              else if (v === "ytd") { setFrom(`${now.getFullYear()}-01-01`); setTo(new Date().toISOString().slice(0, 10)); }
              else if (v === "all") { setFrom(""); setTo(""); }
            }}>
              <SelectTrigger><SelectValue placeholder={t("selectPeriod")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">{t("thisMonth")}</SelectItem>
                <SelectItem value="last-month">{t("lastMonth")}</SelectItem>
                <SelectItem value="q1">{t("q1")}</SelectItem>
                <SelectItem value="q2">{t("q2")}</SelectItem>
                <SelectItem value="q3">{t("q3")}</SelectItem>
                <SelectItem value="q4">{t("q4")}</SelectItem>
                <SelectItem value="ytd">{t("yearToDate")}</SelectItem>
                <SelectItem value="all">{t("allTime")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("periodLabel")}: {from || t("openLower")} → {to || t("today")}</p>

      <Tabs defaultValue="trial">
        <TabsList>
          <TabsTrigger value="trial">{t("trialBalance")}</TabsTrigger>
          <TabsTrigger value="pnl">{t("incomeStatement")}</TabsTrigger>
          <TabsTrigger value="bs">{t("balanceSheet")}</TabsTrigger>
          <TabsTrigger value="cash">{t("cashBookTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="trial">
          <Card><CardContent className="pt-6">
            <div className="mb-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF(
                "Trial Balance",
                ["Code", "Account", "Type", "Debit", "Credit"],
                [
                  ...trial.map((r) => [r.code, r.name, r.type, r.raw.debit ? money(r.raw.debit) : "", r.raw.credit ? money(r.raw.credit) : ""]),
                  ["", "Totals", "", money(trialTotals.debit), money(trialTotals.credit)],
                ],
                range,
              )}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportExcel(
                "Trial Balance", "Trial Balance",
                trial.map((r) => ({ Code: r.code, Account: r.name, Type: r.type, Debit: r.raw.debit, Credit: r.raw.credit })),
                range,
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("code")}</TableHead><TableHead>{t("account")}</TableHead><TableHead>{t("typeLabel")}</TableHead>
                <TableHead className="text-right">{t("debitWord")}</TableHead><TableHead className="text-right">{t("creditWord")}</TableHead>
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
                  <TableCell colSpan={3}>{t("totals")}</TableCell>
                  <TableCell className="text-right">{money(trialTotals.debit)}</TableCell>
                  <TableCell className="text-right">{money(trialTotals.credit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-2 text-xs font-medium">
              {Math.abs(trialTotals.debit - trialTotals.credit) < 0.01
                ? <span className="text-primary">✅ {t("balanced")}</span>
                : <span className="text-destructive">⚠ {t("imbalance")}: {money(Math.abs(trialTotals.debit - trialTotals.credit))}</span>}
            </p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pnl">
          <div className="mb-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportTablePDF(
              "Income Statement",
              ["Section", "Account", "Amount"],
              [
                ...incomeRows.map((r) => ["Income", r.name, money(r.raw.credit - r.raw.debit)]),
                ["", "Total Income", money(totalIncome)],
                ...expenseRows.map((r) => ["Expense", r.name, money(r.raw.debit - r.raw.credit)]),
                ["", "Total Expense", money(totalExpense)],
                ["", `Net ${netIncome >= 0 ? "Profit" : "Loss"}`, money(Math.abs(netIncome))],
              ],
              range,
            )}>
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportExcel(
              "Income Statement", "P&L",
              [
                ...incomeRows.map((r) => ({ Section: "Income", Account: r.name, Amount: r.raw.credit - r.raw.debit })),
                { Section: "", Account: "Total Income", Amount: totalIncome },
                ...expenseRows.map((r) => ({ Section: "Expense", Account: r.name, Amount: r.raw.debit - r.raw.credit })),
                { Section: "", Account: "Total Expense", Amount: totalExpense },
                { Section: "", Account: `Net ${netIncome >= 0 ? "Profit" : "Loss"}`, Amount: netIncome },
              ],
              range,
            )}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("income")}</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {incomeRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>{t("total")} {t("income")}</TableCell><TableCell className="text-right">{money(totalIncome)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("expense")}</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {expenseRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{money(r.raw.debit - r.raw.credit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>{t("total")} {t("expense")}</TableCell><TableCell className="text-right">{money(totalExpense)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardContent className="pt-6 flex justify-between text-lg font-semibold">
              <span>{netIncome >= 0 ? t("netProfit") : t("netLoss")}</span>
              <span className={netIncome >= 0 ? "text-primary" : "text-destructive"}>{money(Math.abs(netIncome))}</span>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bs">
          <div className="mb-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportTablePDF(
              "Balance Sheet",
              ["Section", "Account", "Amount"],
              [
                ...assetRows.map((r) => ["Asset", r.name, money(r.raw.debit - r.raw.credit)]),
                ["", "Total Assets", money(totalAssets)],
                ...liabilityRows.map((r) => ["Liability", r.name, money(r.raw.credit - r.raw.debit)]),
                ["Equity", "Retained Earnings", money(netIncome)],
                ...equityRows.map((r) => ["Equity", r.name, money(r.raw.credit - r.raw.debit)]),
                ["", "Total Liab. + Equity", money(totalLiabilities + totalEquity)],
              ],
              range,
            )}>
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportExcel(
              "Balance Sheet", "Balance Sheet",
              [
                ...assetRows.map((r) => ({ Section: "Asset", Account: r.name, Amount: r.raw.debit - r.raw.credit })),
                { Section: "", Account: "Total Assets", Amount: totalAssets },
                ...liabilityRows.map((r) => ({ Section: "Liability", Account: r.name, Amount: r.raw.credit - r.raw.debit })),
                { Section: "Equity", Account: "Retained Earnings", Amount: netIncome },
                ...equityRows.map((r) => ({ Section: "Equity", Account: r.name, Amount: r.raw.credit - r.raw.debit })),
                { Section: "", Account: "Total Liab. + Equity", Amount: totalLiabilities + totalEquity },
              ],
              range,
            )}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("assets")}</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {assetRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.debit - r.raw.credit)}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>{t("totalAssets")}</TableCell><TableCell className="text-right">{money(totalAssets)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">{t("liabilitiesEquity")}</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  {liabilityRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell></TableRow>
                  ))}
                  <TableRow><TableCell>{t("retainedEarningsNet")}</TableCell><TableCell className="text-right">{money(netIncome)}</TableCell></TableRow>
                  {equityRows.map((r) => (
                    <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.raw.credit - r.raw.debit)}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>{t("totalLiabEquity")}</TableCell><TableCell className="text-right">{money(totalLiabilities + totalEquity)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? `✅ ${t("balanced")}` : `⚠ ${t("outOfBalance")}`}
          </p>
        </TabsContent>

        <TabsContent value="cash">
          <Card><CardContent className="pt-6">
            <div className="mb-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF(
                "Cash Book",
                ["Date", "Description", "Cash In", "Cash Out"],
                [
                  ...cashEntries.map((e) => [fmtDate(e.entry_date), e.description || "-", e.debit > 0 ? money(e.debit) : "", e.credit > 0 ? money(e.credit) : ""]),
                  ["", "Totals", money(cashTotal.in), money(cashTotal.out)],
                  ["", "Net Cash", money(cashTotal.in - cashTotal.out), ""],
                ],
                range,
              )}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportExcel(
                "Cash Book", "Cash Book",
                cashEntries.map((e) => ({ Date: e.entry_date, Description: e.description, "Cash In": Number(e.debit) || 0, "Cash Out": Number(e.credit) || 0 })),
                range,
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("date")}</TableHead><TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{t("cashIn")}</TableHead><TableHead className="text-right">{t("cashOut")}</TableHead>
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
                  <TableCell colSpan={2}>{t("totals")}</TableCell>
                  <TableCell className="text-right">{money(cashTotal.in)}</TableCell>
                  <TableCell className="text-right">{money(cashTotal.out)}</TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell colSpan={3}>{t("netCash")}</TableCell>
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
