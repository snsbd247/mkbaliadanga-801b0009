import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";

type Acct = { id: string; code: string; type: string };
type Entry = { account_id: string; debit: number; credit: number };

const n = (v: unknown) => Number((v as number) ?? 0) || 0;
const TOL = 0.5; // amounts within ৳0.50 are treated as matching (rounding)

export default function SourceVsLedger() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    collected: number; payments: number; expenses: number; officeIncome: number;
    ledgerDebit: number; ledgerCredit: number; ledgerIncome: number; ledgerExpense: number;
  } | null>(null);

  useEffect(() => { document.title = bn ? "উৎস বনাম লেজার" : "Source vs Ledger"; }, [bn]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dr = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q, col = "created_at") => {
        let out = q;
        if (from) out = out.gte(col, from);
        if (to) out = out.lte(col, col === "entry_date" ? to : `${to}T23:59:59`);
        return out;
      };
      // Irrigation collections are dated by the linked payment's receipt date
      // (payments.created_at, kept in sync when a receipt's date is edited),
      // not this row's own created_at — which goes stale the moment a
      // receipt's date is corrected. Filtered client-side below instead of
      // through dr(), since the correct date lives behind a join.
      const [pays, collRaw, exp, oinc, accsRes, ledgerRes] = await Promise.all([
        dr(db.from("payments").select("amount,created_at").limit(50000) as any),
        db.from("irrigation_invoice_payments").select("collected_amount,created_at,payments(created_at)").limit(50000) as any,
        dr(db.from("expenses").select("amount,created_at").is("deleted_at", null).limit(20000) as any),
        dr(db.from("office_incomes").select("amount,created_at").limit(20000) as any),
        db.from("accounts").select("id,code,type"),
        dr(db.from("ledger_entries").select("account_id,debit,credit,entry_date").limit(50000) as any, "entry_date"),
      ]);
      const coll = {
        data: ((collRaw.data ?? []) as any[]).filter((r) => {
          const d = (r.payments?.created_at || r.created_at || "").slice(0, 10);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        }),
      };
      const accts = (accsRes.data as Acct[]) ?? [];
      const byId = new Map(accts.map((a) => [a.id, a]));
      const ledger = (ledgerRes.data as Entry[]) ?? [];
      let ledgerDebit = 0, ledgerCredit = 0, ledgerIncome = 0, ledgerExpense = 0;
      for (const e of ledger) {
        ledgerDebit += n(e.debit); ledgerCredit += n(e.credit);
        const t = byId.get(e.account_id)?.type;
        if (t === "income") ledgerIncome += n(e.credit) - n(e.debit);
        if (t === "expense") ledgerExpense += n(e.debit) - n(e.credit);
      }
      setData({
        payments: (pays.data ?? []).reduce((s: number, r: any) => s + n(r.amount), 0),
        collected: (coll.data ?? []).reduce((s: number, r: any) => s + n(r.collected_amount), 0),
        expenses: (exp.data ?? []).reduce((s: number, r: any) => s + n(r.amount), 0),
        officeIncome: (oinc.data ?? []).reduce((s: number, r: any) => s + n(r.amount), 0),
        ledgerDebit, ledgerCredit, ledgerIncome, ledgerExpense,
      });
      setLoading(false);
    })();
  }, [from, to]);

  const checks = useMemo(() => {
    if (!data) return [];
    const mk = (label: string, a: number, aLbl: string, b: number, bLbl: string) => ({
      label, aLbl, bLbl, a, b, diff: a - b, ok: Math.abs(a - b) <= TOL,
    });
    return [
      mk(bn ? "ট্রায়াল ব্যালেন্স (ডেবিট = ক্রেডিট)" : "Trial Balance (Debit = Credit)", data.ledgerDebit, bn ? "ডেবিট" : "Debit", data.ledgerCredit, bn ? "ক্রেডিট" : "Credit"),
      mk(bn ? "সেচ আদায় বনাম পেমেন্ট" : "Collected vs Payments", data.collected, bn ? "আদায় (কালেকশন)" : "Collected", data.payments, bn ? "পেমেন্ট" : "Payments"),
      mk(bn ? "আয়: উৎস বনাম লেজার" : "Income: Source vs Ledger", data.collected + data.officeIncome, bn ? "উৎস" : "Source", data.ledgerIncome, bn ? "লেজার" : "Ledger"),
      mk(bn ? "ব্যয়: উৎস বনাম লেজার" : "Expense: Source vs Ledger", data.expenses, bn ? "উৎস" : "Source", data.ledgerExpense, bn ? "লেজার" : "Ledger"),
    ];
  }, [data, bn]);

  const mismatchCount = checks.filter((c) => !c.ok).length;
  const range = { from, to };

  const handlePdf = () => exportTablePDF(
    bn ? "উৎস বনাম লেজার" : "Source vs Ledger",
    [bn ? "খাত" : "Item", "A", "B", bn ? "পার্থক্য" : "Diff", bn ? "অবস্থা" : "Status"],
    checks.map((c) => [`${c.label}`, `${c.aLbl}: ${money(c.a)}`, `${c.bLbl}: ${money(c.b)}`, money(c.diff), c.ok ? "OK" : "MISMATCH"]),
    range,
  );
  const handleExcel = () => exportExcel(
    bn ? "উৎস-বনাম-লেজার" : "source-vs-ledger", "Source vs Ledger",
    checks.map((c) => ({ Item: c.label, [c.aLbl]: c.a, [c.bLbl]: c.b, Diff: c.diff, Status: c.ok ? "OK" : "MISMATCH" })),
    range,
  );

  return (
    <div className="container mx-auto space-y-4 p-4">
      <PageHeader
        title={bn ? "উৎস বনাম লেজার (গরমিল রিপোর্ট)" : "Source vs Ledger (Discrepancy Report)"}
        description={bn ? "অপারেশনাল উৎস ডেটা ও ডাবল-এন্ট্রি লেজারের মধ্যে যেকোনো পার্থক্য চিহ্নিত করে।" : "Highlights any differences between operational source data and the double-entry ledger."}
      />

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1"><Label className="text-xs">{bn ? "শুরুর তারিখ" : "From"}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label className="text-xs">{bn ? "শেষ তারিখ" : "To"}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          {(from || to) && <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>{bn ? "রিসেট" : "Reset"}</Button>}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePdf}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>}

      {!loading && data && (
        <>
          <Card className={mismatchCount ? "border-destructive" : "border-primary"}>
            <CardContent className="flex items-center gap-3 p-4">
              {mismatchCount ? <AlertTriangle className="h-6 w-6 text-destructive" /> : <CheckCircle2 className="h-6 w-6 text-primary" />}
              <div>
                <p className="font-semibold">
                  {mismatchCount
                    ? (bn ? `${mismatchCount} টি গরমিল পাওয়া গেছে` : `${mismatchCount} discrepancy(ies) found`)
                    : (bn ? "সব হিসাব মিলে গেছে" : "All figures reconcile")}
                </p>
                <p className="text-xs text-muted-foreground">{bn ? "সহনশীলতা" : "Tolerance"}: ৳{TOL.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{bn ? "গরমিল বিশ্লেষণ" : "Discrepancy Breakdown"}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{bn ? "খাত" : "Item"}</TableHead>
                    <TableHead className="text-right">A</TableHead>
                    <TableHead className="text-right">B</TableHead>
                    <TableHead className="text-right">{bn ? "পার্থক্য" : "Difference"}</TableHead>
                    <TableHead className="text-right">{bn ? "অবস্থা" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((c, i) => (
                    <TableRow key={i} className={c.ok ? "" : "bg-destructive/5"}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right"><span className="text-xs text-muted-foreground">{c.aLbl}</span><br />{money(c.a)}</TableCell>
                      <TableCell className="text-right"><span className="text-xs text-muted-foreground">{c.bLbl}</span><br />{money(c.b)}</TableCell>
                      <TableCell className={`text-right font-semibold ${c.ok ? "" : "text-destructive"}`}>{money(c.diff)}</TableCell>
                      <TableCell className="text-right">
                        {c.ok
                          ? <Badge variant="secondary" className="bg-primary/10 text-primary">{bn ? "মিল" : "OK"}</Badge>
                          : <Badge variant="destructive">{bn ? "গরমিল" : "Mismatch"}</Badge>}
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
