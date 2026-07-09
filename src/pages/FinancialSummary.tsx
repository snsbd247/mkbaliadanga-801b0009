import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";
import * as XLSX from "xlsx";
import { computeFinancialSummary, type FinancialSummary } from "@/lib/financialSummary";
import { getFiscalStartMonth, fiscalYearLabel } from "@/lib/accounting";
import { Link as RLink } from "react-router-dom";
import { Landmark, Droplets, PiggyBank, HandCoins, AlertCircle, TrendingUp, Wallet, FileDown, Printer, FileSpreadsheet } from "lucide-react";

type Office = { id: string; name: string };

export default function FinancialSummary() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [s, setS] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    document.title = bn ? "আর্থিক সারসংক্ষেপ" : "Financial Summary";
    db.from("offices").select("id,name").order("name").then(({ data }) => setOffices(data ?? []));
  }, [bn]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Apply office + created_at date range filters uniformly to every source.
      const range = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q; eq: (c: string, v: string) => Q }>(q: Q, withOffice = true) => {
        let out = q;
        if (from) out = out.gte("created_at", from);
        if (to) out = out.lte("created_at", `${to}T23:59:59`);
        if (withOffice && officeId !== "all") out = out.eq("office_id", officeId);
        return out;
      };
      const [bankAcc, bankTx, invoices, collections, officeIncomes, expenses, savings, loanPayments, loans] =
        await Promise.all([
          // bank_accounts: opening balances not date-scoped; office-scope only.
          officeId !== "all"
            ? db.from("bank_accounts").select("id,stream,opening_balance,bank_name,account_no,account_title").eq("office_id", officeId)
            : db.from("bank_accounts").select("id,stream,opening_balance,bank_name,account_no,account_title"),
          range(db.from("bank_transactions").select("bank_account_id,txn_type,amount,office_id,created_at").limit(20000) as any),
          range(db.from("irrigation_invoices").select("paid_amount,due_amount,office_id,created_at").is("deleted_at", null).neq("invoice_status", "cancelled").limit(50000) as any),
          range(db.from("irrigation_invoice_payments").select("collected_amount,office_id,created_at").limit(50000) as any),
          range(db.from("office_incomes").select("stream,amount,office_id,created_at").limit(20000) as any),
          range(db.from("expenses").select("stream,amount,office_id,created_at").is("deleted_at", null).limit(20000) as any),
          range(db.from("savings_transactions").select("type,amount,office_id,created_at").limit(50000) as any),
          range(db.from("loan_payments").select("amount,office_id,created_at").limit(50000) as any),
          range(db.from("loans").select("principal,total_due,office_id,created_at").is("deleted_at", null).limit(20000) as any),
        ]);
      setS(computeFinancialSummary({
        bankAccounts: bankAcc.data ?? [],
        bankTx: bankTx.data ?? [],
        invoices: invoices.data ?? [],
        collections: collections.data ?? [],
        officeIncomes: officeIncomes.data ?? [],
        expenses: expenses.data ?? [],
        savings: savings.data ?? [],
        loanPayments: loanPayments.data ?? [],
        loans: loans.data ?? [],
      }));
      setLoading(false);
    })();
  }, [officeId, from, to]);

  const kpis = useMemo(() => s ? [
    { key: "bankBalance", label: bn ? "ব্যাংক ব্যালেন্স" : "Bank Balance", value: s.bankBalance, icon: Landmark, to: "/reports/bank", tone: "text-blue-600" },
    { key: "irrigationCashInHand", label: bn ? "সেচ ক্যাশ ইন হ্যান্ড" : "Irrigation Cash in Hand", value: s.irrigationCashInHand, icon: Droplets, to: "/reports/irrigation-statement", tone: "text-cyan-600" },
    { key: "savingsCashInHand", label: bn ? "সেভিংস ক্যাশ ইন হ্যান্ড" : "Savings Cash in Hand", value: s.savingsCashInHand, icon: PiggyBank, to: "/reports/society-statement", tone: "text-emerald-600" },
    { key: "irrigationIncome", label: bn ? "সেচ থেকে আয়" : "Irrigation Income", value: s.irrigationIncome, icon: TrendingUp, to: "/reports/collections", tone: "text-green-600" },
    { key: "irrigationDue", label: bn ? "সেচ বকেয়া (ডিউ)" : "Irrigation Due", value: s.irrigationDue, icon: AlertCircle, to: "/reports/irrigation-due", tone: "text-amber-600" },
    { key: "loanGiven", label: bn ? "প্রদত্ত লোন" : "Loan Given", value: s.loanGiven, icon: HandCoins, to: "/loans", tone: "text-indigo-600" },
    { key: "loanDue", label: bn ? "লোন বকেয়া (ডিউ)" : "Loan Due", value: s.loanDue, icon: AlertCircle, to: "/loans", tone: "text-rose-600" },
    { key: "irrigationExpense", label: bn ? "সেচ ব্যয়" : "Irrigation Expense", value: s.irrigationExpense, icon: Wallet, to: "/reports/expenses", tone: "text-slate-600" },
  ] : [], [s, bn]);

  const exportRows = () => kpis.map((k) => ({ label: k.label, value: k.value }));

  const handleCsv = () => {
    downloadCsv(bn ? "আর্থিক-সারসংক্ষেপ" : "financial-summary", exportRows(), [
      { header: bn ? "খাত" : "Item", accessor: (r) => r.label },
      { header: bn ? "পরিমাণ" : "Amount", accessor: (r) => r.value },
    ]);
  };

  const handleExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows().map((r) => ({ [bn ? "খাত" : "Item"]: r.label, [bn ? "পরিমাণ" : "Amount"]: r.value })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    if (s) {
      const bank = XLSX.utils.json_to_sheet(s.bankRows.map((r) => ({
        Account: r.account, Opening: r.opening, Deposit: r.deposit, Withdraw: r.withdraw, Interest: r.interest, Charge: r.charge, Balance: r.closing,
      })));
      XLSX.utils.book_append_sheet(wb, bank, "Bank");
    }
    XLSX.writeFile(wb, `${bn ? "আর্থিক-সারসংক্ষেপ" : "financial-summary"}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={bn ? "আর্থিক সারসংক্ষেপ" : "Financial Summary"}
        description={bn ? "সরাসরি সোর্স ডেটা থেকে গণনাকৃত প্রকৃত হিসাব" : "Actual figures computed directly from source data"}
      />

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs">{bn ? "অফিস" : "Office"}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{bn ? "সব অফিস" : "All Offices"}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{bn ? "শুরুর তারিখ" : "From"}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{bn ? "শেষ তারিখ" : "To"}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          {(from || to || officeId !== "all") && (
            <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setOfficeId("all"); }}>
              {bn ? "রিসেট" : "Reset"}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
            <Button variant="outline" size="sm" onClick={handleCsv}><FileDown className="mr-1 h-4 w-4" />CSV</Button>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>}

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <Link key={k.key} to={k.to}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-muted p-2">
                      <k.icon className={`h-5 w-5 ${k.tone}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-lg font-bold">{money(k.value)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>{bn ? "ব্যাংক অ্যাকাউন্ট ব্যালেন্স" : "Bank Account Balances"}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{bn ? "অ্যাকাউন্ট" : "Account"}</TableHead>
                    <TableHead className="text-right">{bn ? "প্রারম্ভিক" : "Opening"}</TableHead>
                    <TableHead className="text-right">{bn ? "জমা" : "Deposit"}</TableHead>
                    <TableHead className="text-right">{bn ? "উত্তোলন" : "Withdraw"}</TableHead>
                    <TableHead className="text-right">{bn ? "সুদ" : "Interest"}</TableHead>
                    <TableHead className="text-right">{bn ? "চার্জ" : "Charge"}</TableHead>
                    <TableHead className="text-right">{bn ? "ব্যালেন্স" : "Balance"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.bankRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.account}</TableCell>
                      <TableCell className="text-right">{money(r.opening)}</TableCell>
                      <TableCell className="text-right">{money(r.deposit)}</TableCell>
                      <TableCell className="text-right">{money(r.withdraw)}</TableCell>
                      <TableCell className="text-right">{money(r.interest)}</TableCell>
                      <TableCell className="text-right">{money(r.charge)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.closing)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>{bn ? "মোট" : "Total"}</TableCell>
                    <TableCell colSpan={5} />
                    <TableCell className="text-right">{money(s.bankBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{bn ? "ক্যাশ ইন হ্যান্ড উৎস বিশ্লেষণ" : "Cash in Hand — Source Breakdown"}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{bn ? "উপাদান" : "Component"}</TableHead>
                    <TableHead className="text-right">{bn ? "পরিমাণ" : "Amount"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>{bn ? "সেচ আয় (ইনভয়েস কালেকশন + অফিস আয়)" : "Irrigation income (collections + office income)"}</TableCell><TableCell className="text-right">{money(s.irrigationIncome)}</TableCell></TableRow>
                  <TableRow><TableCell>{bn ? "− সেচ ব্যয়" : "− Irrigation expense"}</TableCell><TableCell className="text-right">{money(s.irrigationExpense)}</TableCell></TableRow>
                  <TableRow className="font-semibold"><TableCell>{bn ? "= সেচ ক্যাশ ইন হ্যান্ড" : "= Irrigation cash in hand"}</TableCell><TableCell className="text-right">{money(s.irrigationCashInHand)}</TableCell></TableRow>
                  <TableRow><TableCell>{bn ? "সেভিংস/সমিতি ক্যাশ ইন হ্যান্ড" : "Savings/society cash in hand"}</TableCell><TableCell className="text-right">{money(s.savingsCashInHand)}</TableCell></TableRow>
                  <TableRow><TableCell>{bn ? "ব্যাংক ব্যালেন্স (সেচ)" : "Bank balance (irrigation)"}</TableCell><TableCell className="text-right">{money(s.bankBalanceSech)}</TableCell></TableRow>
                  <TableRow><TableCell>{bn ? "ব্যাংক ব্যালেন্স (সমিতি)" : "Bank balance (society)"}</TableCell><TableCell className="text-right">{money(s.bankBalanceSociety)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
