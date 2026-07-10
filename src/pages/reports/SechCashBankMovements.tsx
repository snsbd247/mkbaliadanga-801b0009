import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, RefreshCw, Droplets, FileSpreadsheet, Printer, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";
import { isSechStream } from "@/lib/cashStreamGuard";

const sb = db as any;
const num = (v: unknown) => Number((v as number) ?? 0) || 0;

export default function SechCashBankMovements() {
  const { officeId } = useAuth();
  const { lang, tx } = useLang();
  const bn = lang === "bn";

  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [openingCash, setOpeningCash] = useState(0);
  const [audit, setAudit] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [auOffice, setAuOffice] = useState("__all__");
  const [auUser, setAuUser] = useState("__all__");
  const [auAction, setAuAction] = useState("__all__");

  useEffect(() => { document.title = tx("Sech Cash & Bank Movements", "সেচ নগদ ও ব্যাংক মুভমেন্ট"); }, [lang]);
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [from, to]);

  async function load() {
    setLoading(true);
    try {
      const fyLabel = `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
      const [accRes, colRes, expRes, openRes] = await Promise.all([
        sb.from("bank_accounts").select("*").order("bank_name"),
        sb.from("irrigation_invoice_payments").select("collected_amount,amount,paid_at").gte("paid_at", from).lte("paid_at", to + "T23:59:59"),
        sb.from("expenses").select("amount,stream,expense_date,head").eq("stream", "irrigation").gte("expense_date", from).lte("expense_date", to),
        sb.from("opening_balances").select("office_id,fiscal_year,irrigation_cash").eq("fiscal_year", fyLabel),
      ]);
      const sechAccs = (accRes.data ?? []).filter((a: any) => isSechStream(a.stream));
      setAccounts(sechAccs);
      setCollections(colRes.data ?? []);
      setExpenses(expRes.data ?? []);
      const openRows = (openRes.data ?? []).filter((r: any) => !officeId || (r.office_id ?? null) === officeId || r.office_id == null);
      setOpeningCash(openRows.reduce((s: number, r: any) => s + num(r.irrigation_cash), 0));

      const sechIds = sechAccs.map((a: any) => a.id);
      if (sechIds.length) {
        const { data: trx } = await sb.from("bank_transactions")
          .select("*, account:bank_accounts!bank_transactions_bank_account_id_fkey(bank_name,account_no,stream)")
          .in("bank_account_id", sechIds).order("txn_date", { ascending: false }).limit(1000);
        setAllTxns(trx ?? []);
      } else setAllTxns([]);

      const [audRes, jRes] = await Promise.all([
        sb.from("system_audit_logs").select("*").eq("module", "bank_transaction").order("created_at", { ascending: false }).limit(200),
        sb.from("journal_entries").select("id,entry_date,reference,description,journal_entry_lines(debit,credit,description,account:accounts(code,name,name_bn))").like("reference", "BANK-CASH-%").is("deleted_at", null).order("entry_date", { ascending: false }).limit(300),
      ]);
      setAudit(audRes.data ?? []);
      setJournals(jRes.data ?? []);
    } finally { setLoading(false); }
  }

  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;

  const rangeTxns = useMemo(() => allTxns.filter(t => inRange(t.txn_date)), [allTxns, from, to]);

  // Bank closing balance (sech): opening_balance + all-time txns (not range-limited).
  const bankBalance = useMemo(() => {
    const openings = accounts.reduce((s, a) => s + num(a.opening_balance), 0);
    const moved = allTxns.reduce((s, t) => {
      const sign = ["deposit", "transfer_in", "interest"].includes(t.txn_type) ? 1 : -1;
      return s + sign * num(t.amount);
    }, 0);
    return openings + moved;
  }, [accounts, allTxns]);

  const totals = useMemo(() => {
    const income = collections.reduce((s, c) => s + num(c.collected_amount ?? c.amount), 0);
    const expense = expenses.reduce((s, e) => s + num(e.amount), 0);
    const deposits = rangeTxns.filter(t => t.txn_type === "deposit").reduce((s, t) => s + num(t.amount), 0);
    const withdrawals = rangeTxns.filter(t => t.txn_type === "withdraw").reduce((s, t) => s + num(t.amount), 0);
    // Cash in hand (sech) = opening + income − expense − net moved to bank.
    const cashInHand = openingCash + income - expense - (deposits - withdrawals);
    return { income, expense, deposits, withdrawals, cashInHand };
  }, [collections, expenses, rangeTxns, openingCash]);

  async function exportPdf() {
    const head = [bn ? "তারিখ" : "Date", bn ? "ব্যাংক" : "Bank", bn ? "ধরন" : "Type", bn ? "পরিমাণ" : "Amount", bn ? "নোট" : "Note"];
    const rows = rangeTxns.map(t => [
      fmtDate(t.txn_date),
      `${t.account?.bank_name ?? ""} ${t.account?.account_no ?? ""}`.trim(),
      t.txn_type === "deposit" ? (bn ? "জমা" : "Deposit") : t.txn_type === "withdraw" ? (bn ? "উত্তোলন" : "Withdraw") : t.txn_type,
      money(num(t.amount)),
      t.note ?? "",
    ]);
    rows.push(["", "", bn ? "মোট জমা" : "Total Deposit", money(totals.deposits), ""]);
    rows.push(["", "", bn ? "মোট উত্তোলন" : "Total Withdraw", money(totals.withdrawals), ""]);
    rows.push(["", "", bn ? "ক্যাশ ইন হ্যান্ড (সেচ)" : "Cash in Hand (Sech)", money(totals.cashInHand), ""]);
    rows.push(["", "", bn ? "ব্যাংক ব্যালেন্স (সেচ)" : "Bank Balance (Sech)", money(bankBalance), ""]);
    await exportTablePDF(
      bn ? "সেচ নগদ ও ব্যাংক মুভমেন্ট" : "Sech Cash & Bank Movements",
      head, rows, { from, to }, { landscape: true },
    );
  }

  const typeLabel = (t: string) =>
    t === "deposit" ? (bn ? "জমা" : "Deposit") : t === "withdraw" ? (bn ? "উত্তোলন" : "Withdraw") : t;

  return (
    <>
      <PageHeader
        title={bn ? "সেচ নগদ ও ব্যাংক মুভমেন্ট" : "Sech Cash & Bank Movements"}
        description={bn ? "সেচ নগদ, ব্যাংক জমা/উত্তোলন ও জার্নাল — তারিখ রেঞ্জ অনুযায়ী।" : "Sech cash-in-hand, bank deposits/withdrawals and journals by date range."}
        actions={<Button size="sm" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>}
      />

      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div><Label>{bn ? "শুরু" : "From"}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>{bn ? "শেষ" : "To"}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />{bn ? "রিফ্রেশ" : "Refresh"}</Button>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "প্রারম্ভিক নগদ" : "Opening Cash"}</div><div className="text-lg font-semibold">{money(openingCash)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "সেচ আয়" : "Sech Income"}</div><div className="text-lg font-semibold">{money(totals.income)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "সেচ খরচ" : "Sech Expense"}</div><div className="text-lg font-semibold">{money(totals.expense)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "ব্যাংকে জমা" : "Deposited to Bank"}</div><div className="text-lg font-semibold text-emerald-600">{money(totals.deposits)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "ব্যাংক থেকে উত্তোলন" : "Withdrawn"}</div><div className="text-lg font-semibold text-amber-600">{money(totals.withdrawals)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{bn ? "ক্যাশ ইন হ্যান্ড (সেচ)" : "Cash in Hand (Sech)"}</div><div className="text-lg font-semibold">{money(totals.cashInHand)}</div></Card>
      </div>
      <Card className="p-3 mb-4 inline-block"><div className="text-xs text-muted-foreground">{bn ? "সেচ ব্যাংক ব্যালেন্স (সর্বমোট)" : "Sech Bank Balance (total)"}</div><div className="text-lg font-semibold">{money(bankBalance)}</div></Card>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">{bn ? "জমা/উত্তোলন" : "Movements"}</TabsTrigger>
          <TabsTrigger value="journal">{bn ? "জার্নাল এন্ট্রি" : "Journal Entries"}</TabsTrigger>
          <TabsTrigger value="audit">{bn ? "অডিট ট্রেইল" : "Audit Trail"}</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card className="p-0 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{bn ? "তারিখ" : "Date"}</TableHead>
                <TableHead>{bn ? "ব্যাংক" : "Bank"}</TableHead>
                <TableHead>{bn ? "ধরন" : "Type"}</TableHead>
                <TableHead className="text-right">{bn ? "পরিমাণ" : "Amount"}</TableHead>
                <TableHead>{bn ? "নোট" : "Note"}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rangeTxns.filter(t => t.txn_type === "deposit" || t.txn_type === "withdraw").map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{fmtDate(t.txn_date)}</TableCell>
                    <TableCell>{t.account?.bank_name} — {t.account?.account_no}</TableCell>
                    <TableCell><Badge variant={t.txn_type === "deposit" ? "default" : "secondary"}>{typeLabel(t.txn_type)}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{money(num(t.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">{t.note}</TableCell>
                  </TableRow>
                ))}
                {rangeTxns.filter(t => t.txn_type === "deposit" || t.txn_type === "withdraw").length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{bn ? "কোন লেনদেন নেই" : "No movements"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card className="p-0 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{bn ? "তারিখ" : "Date"}</TableHead>
                <TableHead>{bn ? "বিবরণ" : "Description"}</TableHead>
                <TableHead>{bn ? "হিসাব (ডেবিট / ক্রেডিট)" : "Accounts (Dr / Cr)"}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {journals.map(j => (
                  <TableRow key={j.id}>
                    <TableCell>{fmtDate(j.entry_date)}</TableCell>
                    <TableCell>{j.description}</TableCell>
                    <TableCell className="text-xs">
                      {(j.journal_entry_lines ?? []).map((l: any, i: number) => (
                        <div key={i}>
                          {(bn ? l.account?.name_bn : l.account?.name) ?? l.account?.code}: {l.debit > 0 ? `Dr ${money(num(l.debit))}` : `Cr ${money(num(l.credit))}`}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
                {journals.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{bn ? "কোন জার্নাল নেই" : "No journal entries"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-0 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{bn ? "সময়" : "Time"}</TableHead>
                <TableHead>{bn ? "অ্যাকশন" : "Action"}</TableHead>
                <TableHead>{bn ? "বিবরণ" : "Details"}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {audit.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(a.created_at)} {new Date(a.created_at).toLocaleTimeString()}</TableCell>
                    <TableCell><Badge variant="outline">{a.action_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">{typeof a.new_data === "string" ? a.new_data : JSON.stringify(a.new_data)}</TableCell>
                  </TableRow>
                ))}
                {audit.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">{bn ? "কোন অডিট রেকর্ড নেই" : "No audit records"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
