import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { exportTablePDF, exportExcel, exportAuditReportPDF } from "@/lib/exports";
import { exportTableDoc } from "@/lib/wordExports";
import { useBranding } from "@/lib/branding";
import { downloadBnReceiptPdf } from "@/lib/bnReceipts";
import { nextMonthlyReceiptNo } from "@/lib/monthlyReceiptNo";
import { autoReceiptNo } from "@/lib/receiptNo";

const RECEIPT_KINDS = [
  "irrigation", "bigha_rent", "pond", "crop_sale", "scrap",
  "loan_taken", "donation", "savings_deposit", "share", "other",
] as const;
type Kind = typeof RECEIPT_KINDS[number];

function getKindLabel(t: (k: any) => string, k: Kind): string {
  const map: Record<Kind, string> = {
    irrigation: t("kindIrrigation"),
    bigha_rent: t("kindBighaRent"),
    pond: t("kindPond"),
    crop_sale: t("kindCropSale"),
    scrap: t("kindScrap"),
    loan_taken: t("kindLoanTaken"),
    donation: t("kindDonation"),
    savings_deposit: t("savingsDeposit"),
    share: t("kindShare"),
    other: t("kindOther"),
  };
  return map[k] ?? k;
}

const ALL = "__all__";

export default function Cashbook() {
  const { t, tx } = useLang();
  const { user, isAdmin, isCommittee, isSuper, officeId } = useAuth();
  const brand = useBranding();
  const today = new Date();
  const [submitYear, setSubmitYear] = useState<number>(today.getFullYear());
  const [submitMonth, setSubmitMonth] = useState<number>(today.getMonth() + 1);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stream, setStream] = useState<"all" | "irrigation" | "savings_loan_share">("all");
  const [openingCash, setOpeningCash] = useState<number>(() => Number(localStorage.getItem("cb_open") ?? 0));
  useEffect(() => { localStorage.setItem("cb_open", String(openingCash || 0)); }, [openingCash]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  // Audit data
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [irrigation, setIrrigation] = useState<any[]>([]);

  const [openR, setOpenR] = useState(false);
  const [openE, setOpenE] = useState(false);
  const [r, setR] = useState({
    kind: "irrigation" as Kind, farmer_id: "", amount: 0, method: "cash",
    note: "", receipt_date: new Date().toISOString().slice(0, 10),
  });
  const [e, setE] = useState({
    head: "", payee: "", amount: 0, method: "cash", note: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  // Office income (no farmer) — printed on irrigation-style A5 landscape receipt with irrigation serial.
  const [openOI, setOpenOI] = useState(false);
  const [oi, setOI] = useState({
    kind: "scrap" as Kind, remark: "", amount: 0,
    receipt_date: new Date().toISOString().slice(0, 10),
  });
  const OFFICE_INCOME_KINDS: Kind[] = ["scrap", "loan_taken", "donation", "other"];



  useEffect(() => {
    document.title = `${t("cashbook")} — ${t("appName")}`;
    supabase.from("farmers").select("id,name_en,farmer_code,member_no").order("name_en").then(d => setFarmers(d.data ?? []));
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  async function load() {
    const date = (q: any, col: string) => {
      if (from) q = q.gte(col, from);
      if (to) q = q.lte(col, to);
      return q;
    };
    const [rec, exp, sv, ln, lp, ir] = await Promise.all([
      date(supabase.from("receipts").select("*, farmers(name_en,farmer_code,member_no)").order("receipt_date", { ascending: false }), "receipt_date"),
      date(supabase.from("expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: false }), "expense_date"),
      date(supabase.from("savings_transactions").select("amount,type,status,txn_date").is("deleted_at", null).eq("status", "approved"), "txn_date"),
      date(supabase.from("loans").select("principal,total_payable,status,issued_on,loan_payments(amount)").is("deleted_at", null), "issued_on"),
      date(supabase.from("loan_payments").select("amount,paid_on"), "paid_on"),
      date(supabase.from("irrigation_invoices").select("payable_amount,paid_amount,due_amount,generated_at").is("deleted_at", null).neq("invoice_status", "cancelled"), "generated_at"),
    ]);
    setReceipts(rec.data ?? []); setExpenses(exp.data ?? []);
    setSavings(sv.data ?? []); setLoans(ln.data ?? []); setLoanPayments(lp.data ?? []); setIrrigation(ir.data ?? []);
    const { data: subs } = await supabase.from("cashbook_submissions").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(24);
    setSubmissions(subs ?? []);
  }

  const monthLocked = submissions.some(s => s.year === submitYear && s.month === submitMonth && s.locked);

  async function submitMonthlyCashbook() {
    if (monthLocked) return toast.error(`${submitYear}-${String(submitMonth).padStart(2, "0")} ${t("alreadySubmittedLocked" as any) || "ইতিমধ্যে সাবমিট/লক করা আছে"}`);
    if (!confirm(`${submitYear}-${String(submitMonth).padStart(2, "0")} মাসের ক্যাশবুক চূড়ান্তভাবে সাবমিট করবেন? এরপর শুধু সুপার-অ্যাডমিন আনলক করতে পারবেন।`)) return;
    const mFrom = `${submitYear}-${String(submitMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(submitYear, submitMonth, 0).getDate();
    const mTo = `${submitYear}-${String(submitMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const [recM, expM] = await Promise.all([
      supabase.from("receipts").select("amount").gte("receipt_date", mFrom).lte("receipt_date", mTo),
      supabase.from("expenses").select("amount").is("deleted_at", null).gte("expense_date", mFrom).lte("expense_date", mTo),
    ]);
    const inc = (recM.data ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const exp = (expM.data ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const { error } = await supabase.from("cashbook_submissions").insert({
      year: submitYear, month: submitMonth,
      opening_cash: Number(openingCash || 0),
      total_income: inc, total_expense: exp,
      closing_cash: Number(openingCash || 0) + inc - exp,
      submitted_by: user?.id, locked: true,
    });
    if (error) return toast.error(error.message);
    toast.success(t("submitted" as any) || "সাবমিট করা হয়েছে");
    load();
  }

  async function unlockSubmission(id: string) {
    if (!isSuper) return;
    if (!confirm("আনলক করবেন?")) return;
    const { error } = await supabase.from("cashbook_submissions").update({ locked: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unlocked"); load();
  }

  async function saveReceipt() {
    if (r.amount <= 0) return toast.error(t("amountMustBePositive"));
    if (!r.kind) return toast.error(t("pickAKind"));
    const { error } = await supabase.from("receipts").insert({
      kind: r.kind, farmer_id: r.farmer_id || null,
      amount: r.amount, method: r.method, note: r.note,
      receipt_date: r.receipt_date, collected_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpenR(false);
    setR({ kind: "irrigation", farmer_id: "", amount: 0, method: "cash", note: "", receipt_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function saveExpense() {
    if (e.amount <= 0 || !e.head) return toast.error(t("headAndAmountRequired"));
    const { error } = await supabase.from("expenses").insert({
      head: e.head, payee: e.payee, amount: e.amount, method: e.method,
      note: e.note, expense_date: e.expense_date, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpenE(false);
    setE({ head: "", payee: "", amount: 0, method: "cash", note: "", expense_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  /** Print an irrigation-style A5 landscape receipt that shows ONLY a remark (other fields N/A). */
  async function printOfficeIncomeReceipt(rcpt: { receipt_no: string; receipt_date: string; amount: number; note: string }) {
    await downloadBnReceiptPdf(
      {
        kind: "irrigation",
        receipt_no: rcpt.receipt_no,
        date: rcpt.receipt_date,
        company_name: brand.company_name,
        company_name_bn: brand.company_name_bn,
        logo_url: brand.logo_url,
        farmer: { name: "N/A" },
        total_outstanding: 0,
        collected_amount: Number(rcpt.amount),
        remark: rcpt.note,
      },
      "both",
      { paper: "a5", orientation: "l", lang: "bn" },
    );
  }

  async function saveOfficeIncome(print: boolean) {
    if (oi.amount <= 0) return toast.error(t("amountMustBePositive"));
    if (!oi.remark.trim()) return toast.error(tx("Write a remark / description", "একটি রিমার্ক / বিবরণ লিখুন"));
    // Use the irrigation receipt serial (IRR-YYYY-MM-NNNN) so office income shares the irrigation sequence.
    const receipt_no = await nextMonthlyReceiptNo("IRR", officeId, `OI-${Date.now()}-${crypto.randomUUID()}`)
      .catch(() => autoReceiptNo("IRR", `${Date.now()}`));
    const { error } = await supabase.from("receipts").insert({
      kind: oi.kind, farmer_id: null,
      amount: oi.amount, method: "cash", note: oi.remark.trim(),
      receipt_date: oi.receipt_date, collected_by: user?.id,
      receipt_no,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    if (print) {
      await printOfficeIncomeReceipt({ receipt_no, receipt_date: oi.receipt_date, amount: oi.amount, note: oi.remark.trim() });
    }
    setOpenOI(false);
    setOI({ kind: "scrap", remark: "", amount: 0, receipt_date: new Date().toISOString().slice(0, 10) });
    load();
  }


  // Stream filter — Irrigation vs Savings/Loan/Share (PDF requirement: আলাদা cashbook)
  const irrKinds = new Set(["irrigation"]);
  const slsKinds = new Set(["savings_deposit", "loan_taken", "share", "donation", "hawlat", "bank", "miscellaneous"]);
  const filteredReceipts = useMemo(() => {
    if (stream === "all") return receipts;
    if (stream === "irrigation") return receipts.filter(r => irrKinds.has(r.kind));
    return receipts.filter(r => slsKinds.has(r.kind));
  }, [receipts, stream]);
  const filteredExpenses = useMemo(() => stream === "all" ? expenses : [], [expenses, stream]);

  // Cash book entries (combined, sorted asc for running balance)
  const cashbookEntries = useMemo(() => {
    const rows: any[] = [
      ...filteredReceipts.map(x => ({ date: x.receipt_date, kind: "income", label: getKindLabel(t, x.kind as Kind), ref: x.receipt_no, amount: Number(x.amount), note: x.note })),
      ...filteredExpenses.map(x => ({ date: x.expense_date, kind: "expense", label: x.head, ref: x.payee ?? "", amount: Number(x.amount), note: x.note })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = Number(openingCash || 0);
    const out = rows.map(row => {
      bal += row.kind === "income" ? row.amount : -row.amount;
      return { ...row, balance: bal };
    });
    return out;
  }, [filteredReceipts, filteredExpenses, openingCash, t]);

  const totals = useMemo(() => {
    const income = receipts.reduce((s, x) => s + Number(x.amount), 0);
    const expense = expenses.reduce((s, x) => s + Number(x.amount), 0);

    // Audit-side balances
    const savDep = savings.filter(s => s.type === "deposit").reduce((s, x) => s + Number(x.amount), 0);
    const savWd = savings.filter(s => s.type === "withdraw").reduce((s, x) => s + Number(x.amount), 0);
    const savBal = savDep - savWd;

    const loanIssued = loans.reduce((s, x) => s + Number(x.principal || 0), 0);
    const loanCollected = loanPayments.reduce((s, x) => s + Number(x.amount || 0), 0);
    const loanDue = loans.filter(l => l.status === "approved").reduce((s, l) => {
      const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
      return s + (Number(l.total_payable || 0) - paid);
    }, 0);

    const irrCharged = irrigation.reduce((s, x) => s + Number(x.payable_amount || 0), 0);
    const irrCollected = irrigation.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
    const irrDue = irrigation.reduce((s, x) => s + Number(x.due_amount || 0), 0);

    return {
      income, expense, cashBalance: Number(openingCash || 0) + income - expense,
      savBal, loanIssued, loanCollected, loanDue,
      irrCharged, irrCollected, irrDue,
    };
  }, [receipts, expenses, savings, loans, loanPayments, irrigation, openingCash]);

  function rangeLabel() {
    if (!from && !to) return t("allTimeLabel");
    return `${from || "…"} → ${to || "…"}`;
  }

  return (
    <>
      <PageHeader
        title={t("cashbook")}
        description={`${brand.company_name} • ${rangeLabel()}`}
        actions={
          <>
            <Dialog open={openR} onOpenChange={setOpenR}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("receipts")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("addNew")} — {t("receipts")}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>{t("type")}</Label>
                    <Select value={r.kind} onValueChange={(v: any) => setR({ ...r, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RECEIPT_KINDS.map(k => <SelectItem key={k} value={k}>{getKindLabel(t, k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("farmerName")} <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Select value={r.farmer_id} onValueChange={v => setR({ ...r, farmer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("amount")}</Label><Input type="number" value={r.amount || ""} onChange={ev => setR({ ...r, amount: +ev.target.value })} /></div>
                    <div><Label>{t("date")}</Label><Input type="date" value={r.receipt_date} onChange={ev => setR({ ...r, receipt_date: ev.target.value })} /></div>
                    <div><Label>{t("method")}</Label><Input value={r.method} onChange={ev => setR({ ...r, method: ev.target.value })} /></div>
                  </div>
                  <div><Label>{t("note")}</Label><Input value={r.note} onChange={ev => setR({ ...r, note: ev.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenR(false)}>{t("cancel")}</Button><Button onClick={saveReceipt}>{t("save")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openE} onOpenChange={setOpenE}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("expenses")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("addNew")} — {t("expenses")}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>{t("head")}</Label><Input value={e.head} onChange={ev => setE({ ...e, head: ev.target.value })} placeholder={t("egExpenseHeadPh")} /></div>
                  <div><Label>{t("payee")}</Label><Input value={e.payee} onChange={ev => setE({ ...e, payee: ev.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("amount")}</Label><Input type="number" value={e.amount || ""} onChange={ev => setE({ ...e, amount: +ev.target.value })} /></div>
                    <div><Label>{t("date")}</Label><Input type="date" value={e.expense_date} onChange={ev => setE({ ...e, expense_date: ev.target.value })} /></div>
                  </div>
                  <div><Label>{t("method")}</Label><Input value={e.method} onChange={ev => setE({ ...e, method: ev.target.value })} /></div>
                  <div><Label>{t("note")}</Label><Input value={e.note} onChange={ev => setE({ ...e, note: ev.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenE(false)}>{t("cancel")}</Button><Button onClick={saveExpense}>{t("save")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div>
            <Label>Stream</Label>
            <Select value={stream} onValueChange={(v: any) => setStream(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (combined)</SelectItem>
                <SelectItem value="irrigation">Irrigation only</SelectItem>
                <SelectItem value="savings_loan_share">Savings / Loan / Share</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("openingCash")}</Label><Input type="number" value={openingCash || ""} onChange={e => setOpeningCash(+e.target.value)} /></div>
          <div className="self-end text-sm text-muted-foreground">
            <div>{t("openingBalance")}: <span className="font-semibold">{money(openingCash)}</span></div>
            <div>{t("closing")}: <span className={`font-bold ${totals.cashBalance < 0 ? "due-text" : "text-success"}`}>{money(totals.cashBalance)}</span></div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
          <Button size="sm" variant="outline" onClick={() => exportAuditReportPDF({
            brand: { company_name: brand.company_name, address: brand.address ?? "" },
            range: rangeLabel(),
            summary: [
              { label: t("openingCash"), value: Number(openingCash || 0) },
              { label: t("totalIncomeReceipts"), value: totals.income },
              { label: t("totalExpenseAll"), value: totals.expense },
              { label: t("closingCash"), value: totals.cashBalance },
              { label: t("savingsBalance"), value: totals.savBal },
              { label: t("loanIssued"), value: totals.loanIssued },
              { label: t("loanCollected"), value: totals.loanCollected },
              { label: t("loanOutstandingDue"), value: totals.loanDue },
              { label: t("irrigationCharged"), value: totals.irrCharged },
              { label: t("irrigationCollected"), value: totals.irrCollected },
              { label: t("irrigationOutstandingDue"), value: totals.irrDue },
            ],
          })}><FileDown className="h-4 w-4 mr-1" />{t("auditReportPdf")}</Button>
          <Button size="sm" variant="outline" onClick={() => exportTableDoc(t("auditReport"),
            [t("description"), t("amount")],
            [
              [t("openingCash"), Number(openingCash || 0)],
              [t("totalIncomeReceipts"), totals.income],
              [t("totalExpenseAll"), totals.expense],
              [t("closingCash"), totals.cashBalance],
              [t("savingsBalance"), totals.savBal],
              [t("loanIssued"), totals.loanIssued],
              [t("loanCollected"), totals.loanCollected],
              [t("loanOutstandingDue"), totals.loanDue],
              [t("irrigationCharged"), totals.irrCharged],
              [t("irrigationCollected"), totals.irrCollected],
              [t("irrigationOutstandingDue"), totals.irrDue],
            ],
            { range: { from, to } })}><FileDown className="h-4 w-4 mr-1" />Word</Button>
        </div>
      </Card>

      {isCommittee && (
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">মাসিক ক্যাশবুক সাবমিট</Label>
              <div className="flex gap-2 mt-1">
                <Input type="number" className="h-9 w-24" value={submitYear} onChange={e => setSubmitYear(+e.target.value)} />
                <Select value={String(submitMonth)} onValueChange={(v) => setSubmitMonth(+v)}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={submitMonthlyCashbook} disabled={monthLocked}>
                  {monthLocked ? "Locked" : "Submit & Lock"}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs">সাম্প্রতিক সাবমিশনসমূহ</Label>
              <div className="mt-1 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {submissions.length === 0 && <span className="text-xs text-muted-foreground">কোনো সাবমিশন নেই</span>}
                {submissions.map(s => (
                  <Badge key={s.id} variant={s.locked ? "default" : "outline"} className="gap-2">
                    {s.year}-{String(s.month).padStart(2, "0")} · ক্লোজিং {money(s.closing_cash)}
                    {isSuper && s.locked && (
                      <button className="ml-1 underline text-[10px]" onClick={() => unlockSubmission(s.id)}>unlock</button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}


      <Tabs defaultValue="cashbook">
        <TabsList>
          <TabsTrigger value="cashbook">{t("cashbook")}</TabsTrigger>
          <TabsTrigger value="receipts">{t("receipts")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")}</TabsTrigger>
          <TabsTrigger value="audit">{t("auditReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cashbook">
          <ExportBar
            onPdf={() => exportTablePDF(t("cbCashBook" as any),
              [t("date"), t("type"), t("cbDescription" as any), t("cbRef" as any), t("income"), t("expense"), t("balance")],
              cashbookEntries.map(r => [fmtDate(r.date), r.kind, r.label, r.ref, r.kind === "income" ? r.amount : "", r.kind === "expense" ? r.amount : "", r.balance]),
              { from, to })}
            onXlsx={() => exportExcel("cash-book", t("cbCashBook" as any),
              cashbookEntries.map(r => ({ Date: r.date, Kind: r.kind, Description: r.label, Ref: r.ref, Income: r.kind === "income" ? r.amount : "", Expense: r.kind === "expense" ? r.amount : "", Balance: r.balance })),
              { from, to })}
            onDoc={() => exportTableDoc(t("cbCashBook" as any),
              [t("date"), t("type"), t("cbDescription" as any), t("cbRef" as any), t("income"), t("expense"), t("balance")],
              cashbookEntries.map(r => [fmtDate(r.date), r.kind, r.label, r.ref, r.kind === "income" ? r.amount : "", r.kind === "expense" ? r.amount : "", r.balance]),
              { range: { from, to } })}
          />
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead>{t("cbRef" as any)}</TableHead>
              <TableHead className="text-right">{t("income")}</TableHead>
              <TableHead className="text-right">{t("expense")}</TableHead>
              <TableHead className="text-right">{t("runningBalance")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 font-medium">
                <TableCell>{from || "—"}</TableCell>
                <TableCell><Badge variant="outline">{t("openingBadge")}</Badge></TableCell>
                <TableCell colSpan={2}>{t("openingCashBalance")}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right font-semibold">{money(openingCash)}</TableCell>
              </TableRow>
              {cashbookEntries.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{fmtDate(row.date)}</TableCell>
                  <TableCell><Badge variant={row.kind === "income" ? "default" : "destructive"}>{row.kind}</Badge></TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                  <TableCell className="text-right text-success">{row.kind === "income" ? money(row.amount) : "—"}</TableCell>
                  <TableCell className="text-right text-destructive">{row.kind === "expense" ? money(row.amount) : "—"}</TableCell>
                  <TableCell className={`text-right font-semibold ${row.balance < 0 ? "due-text" : ""}`}>{money(row.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/60 font-bold">
                <TableCell colSpan={4} className="text-right">{t("closing")}</TableCell>
                <TableCell className="text-right text-success">{money(totals.income)}</TableCell>
                <TableCell className="text-right text-destructive">{money(totals.expense)}</TableCell>
                <TableCell className={`text-right ${totals.cashBalance < 0 ? "due-text" : ""}`}>{money(totals.cashBalance)}</TableCell>
              </TableRow>
              {cashbookEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="receipts">
          <ExportBar
            onPdf={() => exportTablePDF(t("cbReceipts" as any), [t("receiptNo"), t("date"), t("type"), t("farmerName"), t("amount"), t("method")], filteredReceipts.map(x => [x.receipt_no, fmtDate(x.receipt_date), getKindLabel(t, x.kind as Kind), x.farmers?.name_en ?? "—", x.amount, x.method]), { from, to })}
            onXlsx={() => exportExcel("receipts", t("cbReceipts" as any), filteredReceipts.map(x => ({ "Receipt #": x.receipt_no, Date: x.receipt_date, Kind: getKindLabel(t, x.kind as Kind), Farmer: x.farmers?.name_en ?? "", Amount: x.amount, Method: x.method, Note: x.note })), { from, to })}
          />
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("receiptNo")}</TableHead><TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead><TableHead>{t("farmerName")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("method")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredReceipts.map(x => (
                <TableRow key={x.id}>
                  <TableCell className="font-mono text-xs">{x.receipt_no}</TableCell>
                  <TableCell>{fmtDate(x.receipt_date)}</TableCell>
                  <TableCell><Badge variant="outline">{getKindLabel(t, x.kind as Kind)}</Badge></TableCell>
                  <TableCell>{x.farmers?.name_en ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{money(x.amount)}</TableCell>
                  <TableCell>{x.method}</TableCell>
                </TableRow>
              ))}
              {filteredReceipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="expenses">
          <ExportBar
            onPdf={() => exportTablePDF("Expenses", ["Date", "Head", "Payee", "Amount", "Method"], expenses.map(x => [fmtDate(x.expense_date), x.head, x.payee ?? "—", x.amount, x.method]), { from, to })}
            onXlsx={() => exportExcel("expenses", "Expenses", expenses.map(x => ({ Date: x.expense_date, Head: x.head, Payee: x.payee, Amount: x.amount, Method: x.method, Note: x.note })), { from, to })}
          />
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead><TableHead>{t("head")}</TableHead>
              <TableHead>{t("payee")}</TableHead><TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>{t("method")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {expenses.map(x => (
                <TableRow key={x.id}>
                  <TableCell>{fmtDate(x.expense_date)}</TableCell>
                  <TableCell className="font-medium">{x.head}</TableCell>
                  <TableCell>{x.payee ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(x.amount)}</TableCell>
                  <TableCell>{x.method}</TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="audit">
          <div className="flex justify-end gap-2 mb-3 print:hidden">
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
            <Button size="sm" variant="outline" onClick={() => exportTablePDF(t("auditReport"),
              [t("description"), t("amount")],
              [
                [t("totalIncomeReceipts"), totals.income],
                [t("totalExpenseAll"), totals.expense],
                [t("closingCash"), totals.cashBalance],
                [t("savingsBalance"), totals.savBal],
                [t("loanIssued"), totals.loanIssued],
                [t("loanCollected"), totals.loanCollected],
                [t("loanOutstandingDue"), totals.loanDue],
                [t("irrigationCharged"), totals.irrCharged],
                [t("irrigationCollected"), totals.irrCollected],
                [t("irrigationOutstandingDue"), totals.irrDue],
              ],
              { from, to })}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
            <Button size="sm" variant="outline" onClick={() => exportTableDoc(t("auditReport"),
              [t("description"), t("amount")],
              [
                [t("totalIncomeReceipts"), totals.income],
                [t("totalExpenseAll"), totals.expense],
                [t("closingCash"), totals.cashBalance],
                [t("savingsBalance"), totals.savBal],
                [t("loanIssued"), totals.loanIssued],
                [t("loanCollected"), totals.loanCollected],
                [t("loanOutstandingDue"), totals.loanDue],
                [t("irrigationCharged"), totals.irrCharged],
                [t("irrigationCollected"), totals.irrCollected],
                [t("irrigationOutstandingDue"), totals.irrDue],
              ],
              { range: { from, to } })}><FileDown className="h-4 w-4 mr-1" />Word</Button>
          </div>
          <Card className="p-6 print:shadow-none print:border-0">
            <div className="text-center mb-6">
              {brand.logo_url && <img src={brand.logo_url} alt="" className="mx-auto h-14 w-14 rounded object-cover mb-2" />}
              <h2 className="text-xl font-bold">{brand.company_name}</h2>
              {brand.address && <p className="text-sm text-muted-foreground">{brand.address}</p>}
              <h3 className="mt-3 text-lg font-semibold">{t("auditReport")}</h3>
              <p className="text-sm text-muted-foreground">{rangeLabel()}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Section title={`${t("income")} & ${t("expense")}`}>
                <Row label={t("totalIncomeReceipts")} value={totals.income} positive />
                <Row label={t("totalExpenseAll")} value={totals.expense} negative />
                <Row label={t("closingCash")} value={totals.cashBalance} bold />
              </Section>

              <Section title={t("savings")}>
                <Row label={t("savingsBalance")} value={totals.savBal} bold />
              </Section>

              <Section title={t("loans")}>
                <Row label={t("issuedPrincipal")} value={totals.loanIssued} />
                <Row label={t("loanCollected")} value={totals.loanCollected} positive />
                <Row label={t("loanOutstandingDue")} value={totals.loanDue} bold negative={totals.loanDue > 0} />
              </Section>

              <Section title={t("irrigation")}>
                <Row label={t("irrigationCharged")} value={totals.irrCharged} />
                <Row label={t("irrigationCollected")} value={totals.irrCollected} positive />
                <Row label={t("irrigationOutstandingDue")} value={totals.irrDue} bold negative={totals.irrDue > 0} />
              </Section>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-12 pt-12 print:pt-20">
              {[t("preparedBy"), t("checkedBy"), t("approvedBy")].map(s =>
                <div key={s} className="text-center">
                  <div className="border-t mt-8 pt-2 text-xs text-muted-foreground">{s}</div>
                </div>)}
            </div>
            {!isAdmin && <p className="mt-4 text-xs text-muted-foreground italic">{t("onlyCommitteeEdit")}</p>}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ExportBar({ onPdf, onXlsx, onDoc }: { onPdf: () => void; onXlsx: () => void; onDoc?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex justify-end gap-2 mb-3">
      <Button size="sm" variant="outline" onClick={onPdf}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
      <Button size="sm" variant="outline" onClick={onXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("exportExcel")}</Button>
      {onDoc && <Button size="sm" variant="outline" onClick={onDoc}><FileDown className="h-4 w-4 mr-1" />Word</Button>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold border-b pb-1 mb-2">{title}</h4>
      <div data-table-wrap className="w-full overflow-x-auto">
        <table className="w-full text-sm">
        <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
function Row({ label, value, bold, positive, negative }: { label: string; value: number; bold?: boolean; positive?: boolean; negative?: boolean }) {
  return (
    <tr className={bold ? "border-t" : ""}>
      <td className={`py-1 ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`py-1 text-right ${bold ? "font-bold" : ""} ${positive ? "text-success" : ""} ${negative ? "due-text" : ""}`}>{money(value)}</td>
    </tr>
  );
}
