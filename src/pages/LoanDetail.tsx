import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ArrowLeft, Printer, Receipt, AlertTriangle, Calendar, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";
import { useLang } from "@/i18n/LanguageProvider";
import { moneyL, fmtDateL } from "@/lib/format";

type Inst = {
  id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_on: string | null;
  penalty_amount: number;
  status: string;
};

type Pay = { id: string; amount: number; paid_on: string; note: string | null; status: string };

function deriveStatus(
  i: Inst,
  today: Date,
  tx: (en: string, bn: string) => string,
): { key: "paid" | "partial" | "overdue" | "pending"; label: string; variant: any } {
  const due = Number(i.amount || 0);
  const paid = Number(i.paid_amount || 0);
  if (i.status === "paid" || (due > 0 && paid >= due)) return { key: "paid", label: tx("Paid", "পরিশোধিত"), variant: "default" };
  if (paid > 0 && paid < due) {
    const od = new Date(i.due_date) < today;
    return { key: od ? "overdue" : "partial", label: od ? tx("Overdue (partial)", "মেয়াদোত্তীর্ণ (আংশিক)") : tx("Partial", "আংশিক"), variant: od ? "destructive" : "secondary" };
  }
  if (new Date(i.due_date) < today) return { key: "overdue", label: tx("Overdue", "মেয়াদোত্তীর্ণ"), variant: "destructive" };
  return { key: "pending", label: tx("Pending", "অপেক্ষমাণ"), variant: "outline" };
}

export default function LoanDetail() {
  const { loanId } = useParams<{ loanId: string }>();
  const nav = useNavigate();
  const { tx, lang } = useLang();
  const money = (n: any) => moneyL(n, lang);
  const fmtDate = (d: any) => (d ? fmtDateL(d, lang) : "-");
  const [loan, setLoan] = useState<any>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [installments, setInstallments] = useState<Inst[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      setLoading(true);
      const { data: l } = await supabase.from("loans").select("*").eq("id", loanId).maybeSingle();
      if (!l) { setLoading(false); return; }
      setLoan(l);
      const [{ data: f }, { data: p }, { data: ins }, { data: pays }] = await Promise.all([
        supabase.from("farmers").select("id,name_en,name_bn,farmer_code,mobile,village").eq("id", l.farmer_id).maybeSingle(),
        l.plan_id ? supabase.from("loan_plans").select("*").eq("id", l.plan_id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("loan_installments").select("*").eq("loan_id", loanId).order("installment_no"),
        supabase.from("loan_payments").select("*").eq("loan_id", loanId).order("paid_on", { ascending: false }),
      ]);
      setFarmer(f);
      setPlan(p);
      setInstallments((ins ?? []) as Inst[]);
      setPayments((pays ?? []) as Pay[]);
      setLoading(false);
    })();
  }, [loanId]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPayable = Number(loan?.total_payable || 0);
    const remaining = Math.max(0, totalPayable - totalPaid);
    const counters = { total: installments.length, paid: 0, pending: 0, overdue: 0, partial: 0 };
    let lastDue: string | null = null;
    let nextOverdue: Inst | null = null;
    for (const i of installments) {
      const s = deriveStatus(i, today, tx).key;
      counters[s] = (counters as any)[s] + 1;
      if (!lastDue || new Date(i.due_date) > new Date(lastDue)) lastDue = i.due_date;
      if (s === "overdue" && !nextOverdue) nextOverdue = i;
    }
    const lastPay = payments[0]?.paid_on ?? null;
    return { totalPaid, totalPayable, remaining, counters, lastDue, lastPay, nextOverdue };
  }, [installments, payments, loan, today, tx]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</div>;
  if (!loan) return <div className="p-6">{tx("Loan not found.", "ঋণ খুঁজে পাওয়া যায়নি।")} <Link className="underline" to="/loans">{tx("Back", "ফিরে যান")}</Link></div>;

  function exportInstallmentsCsv() {
    downloadCsv(`loan_${loan.id}_installments.csv`, installments, [
      { header: tx("Installment #", "কিস্তি নং"), accessor: r => r.installment_no },
      { header: tx("Due Date", "নির্ধারিত তারিখ"), accessor: r => fmtDate(r.due_date) },
      { header: tx("Amount", "পরিমাণ"), accessor: r => Number(r.amount || 0) },
      { header: tx("Paid", "পরিশোধিত"), accessor: r => Number(r.paid_amount || 0) },
      { header: tx("Remaining", "বাকি"), accessor: r => Math.max(0, Number(r.amount || 0) - Number(r.paid_amount || 0)) },
      { header: tx("Paid On", "পরিশোধ তারিখ"), accessor: r => fmtDate(r.paid_on) },
      { header: tx("Penalty", "জরিমানা"), accessor: r => Number(r.penalty_amount || 0) },
      { header: tx("Status", "স্ট্যাটাস"), accessor: r => deriveStatus(r as Inst, today, tx).label },
    ]);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto print:p-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> {tx("Back", "ফিরে যান")}</Button>
          <h1 className="text-xl md:text-2xl font-bold">{tx("Loan Details", "ঋণ বিবরণ")}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportInstallmentsCsv}><FileSpreadsheet className="h-4 w-4 mr-1" />{tx("Export", "এক্সপোর্ট")}</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}</Button>
          <Button size="sm" onClick={() => nav(`/payments?farmer=${loan.farmer_id}&loan=${loan.id}`)}>
            <Receipt className="h-4 w-4 mr-1" />{tx("Receive Installment", "কিস্তি গ্রহণ")}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{tx("Loan Summary", "ঋণ সারাংশ")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label={tx("Loan #", "ঋণ নং")} value={loan.id?.slice(0, 8).toUpperCase()} />
            <Field label={tx("Farmer", "কৃষক")} value={
              <Link className="underline text-primary" to={`/farmers/${loan.farmer_id}`}>
                {(lang === "bn" ? (farmer?.name_bn || farmer?.name_en) : (farmer?.name_en || farmer?.name_bn)) || "-"}
              </Link> as any
            } />
            <Field label={tx("Account #", "হিসাব নং")} value={farmer?.farmer_code || "-"} />
            <Field label={tx("Loan Plan", "ঋণ প্ল্যান")} value={(lang === "bn" ? (plan?.name_bn || plan?.name) : (plan?.name || plan?.name_bn)) || "—"} />
            <Field label={tx("Principal", "মূল টাকা")} value={money(loan.principal)} />
            <Field label={tx("Interest", "সুদ")} value={loan.interest_enabled ? `${loan.interest_rate}%` : tx("None", "নেই")} />
            <Field label={tx("Total Payable", "মোট পরিশোধ্য")} value={<span className="font-bold">{money(summary.totalPayable)}</span> as any} />
            <Field label={tx("Total Paid", "মোট পরিশোধিত")} value={money(summary.totalPaid)} />
            <Field label={tx("Remaining", "বাকি")} value={<span className="font-bold text-destructive">{money(summary.remaining)}</span> as any} />
            <Field label={tx("Status", "স্ট্যাটাস")} value={<Badge>{loan.status}</Badge> as any} />
            <Field label={tx("Issued On", "ঋণ প্রদান তারিখ")} value={fmtDate(loan.issued_on)} />
            <Field label={tx("Last Paid On", "শেষ পরিশোধ তারিখ")} value={fmtDate(summary.lastPay)} />
          </div>
        </CardContent>
      </Card>

      {/* Counters */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{tx("Installment Summary", "কিস্তি সারাংশ")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Counter label={tx("Total Installments", "মোট কিস্তি")} value={summary.counters.total} />
            <Counter label={tx("Paid", "পরিশোধিত")} value={summary.counters.paid} tone="success" />
            <Counter label={tx("Pending", "অপেক্ষমাণ")} value={summary.counters.pending} />
            <Counter label={tx("Overdue", "মেয়াদোত্তীর্ণ")} value={summary.counters.overdue} tone="danger" />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {summary.lastDue && (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted">
                <Calendar className="h-4 w-4" />
                <span>{tx("Last installment date:", "শেষ কিস্তির তারিখ:")}</span>
                <span className="font-semibold">{fmtDate(summary.lastDue)}</span>
              </div>
            )}
            {summary.nextOverdue && (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{tx("Penalty will apply", "জরিমানা কার্যকর হবে")} — {tx("Installment", "কিস্তি")} #{summary.nextOverdue.installment_no} ({fmtDate(summary.nextOverdue.due_date)})</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Installments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{tx("Installment List", "কিস্তির তালিকা")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {installments.length === 0 ? (
            <div className="text-sm text-muted-foreground">{tx("No installment schedule.", "কোনো কিস্তি সিডিউল নেই।")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Installment #", "কিস্তি নং")}</TableHead>
                  <TableHead>{tx("Due Date", "নির্ধারিত তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Amount", "পরিমাণ")}</TableHead>
                  <TableHead className="text-right">{tx("Paid", "পরিশোধিত")}</TableHead>
                  <TableHead className="text-right">{tx("Remaining", "বাকি")}</TableHead>
                  <TableHead>{tx("Paid On", "পরিশোধ তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Penalty", "জরিমানা")}</TableHead>
                  <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                  <TableHead className="text-right">{tx("Action", "কার্যক্রম")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map(i => {
                  const st = deriveStatus(i, today, tx);
                  const remaining = Math.max(0, Number(i.amount || 0) - Number(i.paid_amount || 0));
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.installment_no}</TableCell>
                      <TableCell>{fmtDate(i.due_date)}</TableCell>
                      <TableCell className="text-right">{money(i.amount)}</TableCell>
                      <TableCell className="text-right">{money(i.paid_amount)}</TableCell>
                      <TableCell className="text-right">{money(remaining)}</TableCell>
                      <TableCell>{fmtDate(i.paid_on)}</TableCell>
                      <TableCell className="text-right">{money(i.penalty_amount)}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        {st.key !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => nav(`/payments?farmer=${loan.farmer_id}&loan=${loan.id}&amount=${remaining.toFixed(2)}`)}>
                            {tx("Receive", "গ্রহণ")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payments timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{tx("Payment History", "পরিশোধের ইতিহাস")}</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-sm text-muted-foreground">{tx("No payments yet.", "কোনো পরিশোধ নেই।")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Date", "তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Amount", "পরিমাণ")}</TableHead>
                  <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                  <TableHead>{tx("Note", "মন্তব্য")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.paid_on)}</TableCell>
                    <TableCell className="text-right">{money(p.amount)}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? "-"}</div>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
