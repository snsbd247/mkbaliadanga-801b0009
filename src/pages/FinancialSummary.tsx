import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { computeFinancialSummary, type FinancialSummary } from "@/lib/financialSummary";
import { Landmark, Droplets, PiggyBank, HandCoins, AlertCircle, TrendingUp, Wallet } from "lucide-react";

export default function FinancialSummary() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [s, setS] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = bn ? "আর্থিক সারসংক্ষেপ" : "Financial Summary";
    (async () => {
      setLoading(true);
      const [bankAcc, bankTx, invoices, collections, officeIncomes, expenses, savings, loanPayments, loans] =
        await Promise.all([
          db.from("bank_accounts").select("id,stream,opening_balance,bank_name,account_no,account_title"),
          db.from("bank_transactions").select("bank_account_id,txn_type,amount").limit(20000),
          db.from("irrigation_invoices").select("paid_amount,due_amount").is("deleted_at", null).neq("invoice_status", "cancelled").limit(50000),
          db.from("irrigation_invoice_payments").select("collected_amount").limit(50000),
          db.from("office_incomes").select("stream,amount").limit(20000),
          db.from("expenses").select("stream,amount").is("deleted_at", null).limit(20000),
          db.from("savings_transactions").select("type,amount").limit(50000),
          db.from("loan_payments").select("amount").limit(50000),
          db.from("loans").select("principal,total_due").is("deleted_at", null).limit(20000),
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
  }, [bn]);

  const kpis = s ? [
    { label: bn ? "ব্যাংক ব্যালেন্স" : "Bank Balance", value: s.bankBalance, icon: Landmark, to: "/reports/bank", tone: "text-blue-600" },
    { label: bn ? "সেচ ক্যাশ ইন হ্যান্ড" : "Irrigation Cash in Hand", value: s.irrigationCashInHand, icon: Droplets, to: "/reports/irrigation-statement", tone: "text-cyan-600" },
    { label: bn ? "সেভিংস ক্যাশ ইন হ্যান্ড" : "Savings Cash in Hand", value: s.savingsCashInHand, icon: PiggyBank, to: "/reports/society-statement", tone: "text-emerald-600" },
    { label: bn ? "সেচ থেকে আয়" : "Irrigation Income", value: s.irrigationIncome, icon: TrendingUp, to: "/reports/collections", tone: "text-green-600" },
    { label: bn ? "সেচ বকেয়া (ডিউ)" : "Irrigation Due", value: s.irrigationDue, icon: AlertCircle, to: "/reports/irrigation-due", tone: "text-amber-600" },
    { label: bn ? "প্রদত্ত লোন" : "Loan Given", value: s.loanGiven, icon: HandCoins, to: "/loans", tone: "text-indigo-600" },
    { label: bn ? "লোন বকেয়া (ডিউ)" : "Loan Due", value: s.loanDue, icon: AlertCircle, to: "/loans", tone: "text-rose-600" },
    { label: bn ? "সেচ ব্যয়" : "Irrigation Expense", value: s.irrigationExpense, icon: Wallet, to: "/reports/expenses", tone: "text-slate-600" },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={bn ? "আর্থিক সারসংক্ষেপ" : "Financial Summary"}
        subtitle={bn ? "সরাসরি সোর্স ডেটা থেকে গণনাকৃত প্রকৃত হিসাব" : "Actual figures computed directly from source data"}
      />

      {loading && <p className="text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>}

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <Link key={k.label} to={k.to}>
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
        </>
      )}
    </div>
  );
}
