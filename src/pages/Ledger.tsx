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

type Account = { id: string; code: string; name: string; type: string };
type Entry = {
  id: string; entry_date: string; account_id: string;
  debit: number; credit: number; description: string | null;
  reference_type: string | null;
};

export default function Ledger() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    supabase.from("accounts").select("id,code,name,type").order("code")
      .then(({ data }) => setAccounts((data as Account[]) || []));
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let q = supabase.from("ledger_entries").select("*").eq("account_id", accountId).order("entry_date").order("created_at");
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    q.then(({ data }) => setEntries((data as Entry[]) || []));
  }, [accountId, from, to]);

  const withRunning = useMemo(() => {
    let bal = 0;
    return entries.map((e) => {
      bal += Number(e.debit || 0) - Number(e.credit || 0);
      return { ...e, balance: bal };
    });
  }, [entries]);

  const totals = useMemo(() => {
    return entries.reduce(
      (a, e) => ({ debit: a.debit + Number(e.debit || 0), credit: a.credit + Number(e.credit || 0) }),
      { debit: 0, credit: 0 },
    );
  }, [entries]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Ledger" description="Account-wise transaction history" />
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div>
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
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

      {accountId && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex justify-end gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  const acct = accounts.find((a) => a.id === accountId);
                  exportTablePDF(
                    `Ledger - ${acct?.code} ${acct?.name}`,
                    ["Date", "Description", "Ref", "Debit", "Credit", "Balance"],
                    withRunning.map((e) => [
                      fmtDate(e.entry_date), e.description || "-", e.reference_type || "-",
                      e.debit > 0 ? money(e.debit) : "", e.credit > 0 ? money(e.credit) : "", money(e.balance),
                    ]),
                  );
                }}
              >
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  const acct = accounts.find((a) => a.id === accountId);
                  exportExcel(`ledger-${acct?.code}`, "Ledger", withRunning.map((e) => ({
                    Date: e.entry_date, Description: e.description, Reference: e.reference_type,
                    Debit: Number(e.debit) || 0, Credit: Number(e.credit) || 0, Balance: e.balance,
                  })));
                }}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withRunning.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.entry_date)}</TableCell>
                    <TableCell>{e.description || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.reference_type || "-"}</TableCell>
                    <TableCell className="text-right">{e.debit > 0 ? money(e.debit) : ""}</TableCell>
                    <TableCell className="text-right">{e.credit > 0 ? money(e.credit) : ""}</TableCell>
                    <TableCell className="text-right font-medium">{money(e.balance)}</TableCell>
                  </TableRow>
                ))}
                {!entries.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {entries.length > 0 && (
              <div className="mt-3 flex justify-end gap-6 text-sm">
                <div>Total Debit: <span className="font-semibold">{money(totals.debit)}</span></div>
                <div>Total Credit: <span className="font-semibold">{money(totals.credit)}</span></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
