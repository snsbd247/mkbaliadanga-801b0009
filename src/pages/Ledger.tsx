import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { getFiscalStartMonth, listFiscalYears, reportFilename } from "@/lib/accounting";

type Account = { id: string; code: string; name: string; type: string };
type Office = { id: string; name: string };
type Entry = {
  id: string; entry_date: string; account_id: string;
  debit: number; credit: number; description: string | null;
  reference_type: string | null; office_id: string | null;
  account_code?: string; account_name?: string; office_name?: string;
};

const REF_TYPES = ["all", "savings", "loan", "loan_payment", "irrigation", "expense", "journal"];

export default function Ledger() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [accountId, setAccountId] = useState<string>("all");
  const [officeId, setOfficeId] = useState<string>("all");
  const [refType, setRefType] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [fyStartMonth, setFyStartMonth] = useState<number>(7);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: o }, m] = await Promise.all([
        supabase.from("accounts").select("id,code,name,type").order("code"),
        supabase.from("offices").select("id,name").order("name"),
        getFiscalStartMonth(),
      ]);
      setAccounts((a as Account[]) || []);
      setOffices((o as Office[]) || []);
      setFyStartMonth(m);
    })();
  }, []);

  const fyOptions = useMemo(() => listFiscalYears(fyStartMonth, 6), [fyStartMonth]);

  useEffect(() => {
    let q = supabase.from("ledger_entries_view").select("*").order("entry_date").order("created_at").limit(5000);
    if (accountId !== "all") q = q.eq("account_id", accountId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    if (refType !== "all") q = q.eq("reference_type", refType);
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    q.then(({ data }) => setEntries((data as Entry[]) || []));
  }, [accountId, officeId, refType, from, to]);

  const showRunning = accountId !== "all";
  const withRunning = useMemo(() => {
    if (!showRunning) return entries.map((e) => ({ ...e, balance: 0 }));
    let bal = 0;
    return entries.map((e) => {
      bal += Number(e.debit || 0) - Number(e.credit || 0);
      return { ...e, balance: bal };
    });
  }, [entries, showRunning]);

  const totals = useMemo(() => entries.reduce(
    (a, e) => ({ debit: a.debit + Number(e.debit || 0), credit: a.credit + Number(e.credit || 0) }),
    { debit: 0, credit: 0 },
  ), [entries]);

  const reportName = accountId !== "all"
    ? `ledger-${accounts.find((a) => a.id === accountId)?.code ?? ""}`
    : "ledger";

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Ledger" description="Filter ledger entries by account, office, date and reference" />
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference</Label>
            <Select value={refType} onValueChange={setRefType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REF_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fiscal year</Label>
            <Select onValueChange={(v) => {
              const fy = fyOptions.find((f) => String(f.startYear) === v);
              if (fy) { setFrom(fy.range.from); setTo(fy.range.to); }
            }}>
              <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
              <SelectContent>
                {fyOptions.map((f) => <SelectItem key={f.startYear} value={String(f.startYear)}>FY {f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{entries.length} entries</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF(
                "Ledger",
                ["Date", "Account", "Office", "Description", "Ref", "Debit", "Credit", ...(showRunning ? ["Balance"] : [])],
                withRunning.map((e) => [
                  fmtDate(e.entry_date),
                  `${e.account_code ?? ""} ${e.account_name ?? ""}`.trim(),
                  e.office_name || "-",
                  e.description || "-",
                  e.reference_type || "-",
                  e.debit > 0 ? money(e.debit) : "",
                  e.credit > 0 ? money(e.credit) : "",
                  ...(showRunning ? [money(e.balance)] : []),
                ]),
              )}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportExcel(
                reportFilename(reportName, { from, to }), "Ledger",
                withRunning.map((e) => ({
                  Date: e.entry_date, Account: `${e.account_code ?? ""} ${e.account_name ?? ""}`.trim(),
                  Office: e.office_name, Description: e.description, Reference: e.reference_type,
                  Debit: Number(e.debit) || 0, Credit: Number(e.credit) || 0,
                  ...(showRunning ? { Balance: e.balance } : {}),
                })),
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                {showRunning && <TableHead className="text-right">Balance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {withRunning.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.entry_date)}</TableCell>
                  <TableCell className="text-xs">{e.account_code} — {e.account_name}</TableCell>
                  <TableCell className="text-xs">{e.office_name || "-"}</TableCell>
                  <TableCell>{e.description || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.reference_type || "-"}</TableCell>
                  <TableCell className="text-right">{e.debit > 0 ? money(e.debit) : ""}</TableCell>
                  <TableCell className="text-right">{e.credit > 0 ? money(e.credit) : ""}</TableCell>
                  {showRunning && <TableCell className="text-right font-medium">{money(e.balance)}</TableCell>}
                </TableRow>
              ))}
              {!entries.length && (
                <TableRow><TableCell colSpan={showRunning ? 8 : 7} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {entries.length > 0 && (
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div>Total Debit: <span className="font-semibold">{money(totals.debit)}</span></div>
              <div>Total Credit: <span className="font-semibold">{money(totals.credit)}</span></div>
              <div className={Math.abs(totals.debit - totals.credit) < 0.01 ? "text-primary" : "text-destructive"}>
                {Math.abs(totals.debit - totals.credit) < 0.01 ? "✅ Balanced" : `Diff: ${money(Math.abs(totals.debit - totals.credit))}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
