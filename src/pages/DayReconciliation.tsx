// i18n-ignore-file — admin/utility reconciliation screen
import { useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { money } from "@/lib/format";
import { bankCashTransferRef, bankExternalRef } from "@/lib/accountingPosting";

interface Row {
  kind: string;
  label: string;
  amount: number;
  reference: string;
  posted: boolean;
}

export default function DayReconciliation() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const [{ data: banks }, { data: incs }, { data: exps }, { data: jes }] = await Promise.all([
        db.from("bank_transactions").select("*").eq("txn_date", date).limit(5000),
        db.from("office_incomes").select("*").eq("received_on", date).limit(5000),
        db.from("expenses").select("*").eq("expense_date", date).is("deleted_at", null).limit(5000),
        db.from("journal_entries").select("reference,posted").eq("entry_date", date).limit(20000),
      ]);
      const postedRefs = new Set(
        ((jes ?? []) as any[]).filter((j) => j.posted && j.reference).map((j) => j.reference),
      );
      const out: Row[] = [];
      for (const b of (banks ?? []) as any[]) {
        const isMovement = b.txn_type === "deposit" || b.txn_type === "withdraw";
        const ref = isMovement ? bankCashTransferRef(b.id) : bankExternalRef(b.id);
        // Either cash-source (BANK-CASH) or external (BANK-EXT) ref may back a movement.
        const posted = postedRefs.has(bankCashTransferRef(b.id)) || postedRefs.has(bankExternalRef(b.id));
        out.push({
          kind: "ব্যাংক",
          label: `${b.txn_type}${b.note ? ` — ${b.note}` : ""}`,
          amount: Number(b.amount) || 0,
          reference: ref,
          posted,
        });
      }
      for (const r of (incs ?? []) as any[]) {
        out.push({
          kind: "আয়",
          label: r.head || r.receipt_no || "অফিস আয়",
          amount: Number(r.amount) || 0,
          reference: `INCOME-${r.id}`,
          posted: postedRefs.has(`INCOME-${r.id}`),
        });
      }
      for (const r of (exps ?? []) as any[]) {
        if (r.is_bank_deposit) continue;
        out.push({
          kind: "ব্যয়",
          label: r.head || r.voucher_no || "খরচ",
          amount: Number(r.amount) || 0,
          reference: `EXPENSE-${r.id}`,
          posted: postedRefs.has(`EXPENSE-${r.id}`),
        });
      }
      setRows(out);
    } finally {
      setLoading(false);
    }
  };

  const unposted = (rows ?? []).filter((r) => !r.posted);
  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);
  const postedTotal = (rows ?? []).filter((r) => r.posted).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="দিন-ভিত্তিক রিকনসিলিয়েশন" description="ব্যাংক, আয়/ব্যয় ও লেজার পোস্টিং মিলিয়ে দেখুন" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">তারিখ নির্বাচন</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>তারিখ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            মিলিয়ে দেখুন
          </Button>
        </CardContent>
      </Card>

      {rows && (
        <>
          {unposted.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {unposted.length} টি এন্ট্রি এখনও লেজারে পোস্ট হয়নি — ডে-ক্লোজ চালান।
              </AlertDescription>
            </Alert>
          ) : rows.length > 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>সব এন্ট্রি লেজারে পোস্ট হয়েছে — মিল আছে।</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardContent className="pt-4">
              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                <span>মোট: <b>{money(total)}</b></span>
                <span>পোস্টেড: <b>{money(postedTotal)}</b></span>
                <span>বাকি: <b>{money(total - postedTotal)}</b></span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ধরন</TableHead>
                    <TableHead>বিবরণ</TableHead>
                    <TableHead className="text-right">পরিমাণ</TableHead>
                    <TableHead>রেফারেন্স</TableHead>
                    <TableHead className="text-center">লেজার</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">কোনো এন্ট্রি নেই</TableCell></TableRow>
                  )}
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right">{money(r.amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                      <TableCell className="text-center">
                        {r.posted
                          ? <Badge className="bg-green-600 hover:bg-green-600">পোস্টেড</Badge>
                          : <Badge variant="destructive">বাকি</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
