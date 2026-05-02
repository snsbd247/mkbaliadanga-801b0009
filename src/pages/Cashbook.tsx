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
import { useBranding } from "@/lib/branding";

const RECEIPT_KINDS = [
  "irrigation", "bigha_rent", "pond", "crop_sale", "scrap",
  "loan_taken", "donation", "savings_deposit", "share", "other",
] as const;
type Kind = typeof RECEIPT_KINDS[number];

const KIND_LABEL: Record<Kind, string> = {
  irrigation: "Irrigation",
  bigha_rent: "Bigha Rent",
  pond: "Pond Income",
  crop_sale: "Crop Sale",
  scrap: "Scrap",
  loan_taken: "Loan Taken",
  donation: "Donation",
  savings_deposit: "Savings Deposit",
  share: "Share",
  other: "Other",
};

const ALL = "__all__";

export default function Cashbook() {
  const { t } = useLang();
  const { user, isAdmin } = useAuth();
  const brand = useBranding();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
      date(supabase.from("expenses").select("*").order("expense_date", { ascending: false }), "expense_date"),
      date(supabase.from("savings_transactions").select("amount,type,status,txn_date").eq("status", "approved"), "txn_date"),
      date(supabase.from("loans").select("principal,total_payable,status,issued_on,loan_payments(amount)"), "issued_on"),
      date(supabase.from("loan_payments").select("amount,paid_on"), "paid_on"),
      date(supabase.from("irrigation_charges").select("total,paid_amount,due_amount,entry_date"), "entry_date"),
    ]);
    setReceipts(rec.data ?? []); setExpenses(exp.data ?? []);
    setSavings(sv.data ?? []); setLoans(ln.data ?? []); setLoanPayments(lp.data ?? []); setIrrigation(ir.data ?? []);
  }

  async function saveReceipt() {
    if (r.amount <= 0) return toast.error("Amount must be > 0");
    if (!r.kind) return toast.error("Pick a kind");
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
    if (e.amount <= 0 || !e.head) return toast.error("Head & amount required");
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

  // Cash book entries (combined, sorted asc for running balance)
  const cashbookEntries = useMemo(() => {
    const rows: any[] = [
      ...receipts.map(x => ({ date: x.receipt_date, kind: "income", label: KIND_LABEL[x.kind as Kind] ?? x.kind, ref: x.receipt_no, amount: Number(x.amount), note: x.note })),
      ...expenses.map(x => ({ date: x.expense_date, kind: "expense", label: x.head, ref: x.payee ?? "", amount: Number(x.amount), note: x.note })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = Number(openingCash || 0);
    const out = rows.map(row => {
      bal += row.kind === "income" ? row.amount : -row.amount;
      return { ...row, balance: bal };
    });
    return out;
  }, [receipts, expenses, openingCash]);

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

    const irrCharged = irrigation.reduce((s, x) => s + Number(x.total || 0), 0);
    const irrCollected = irrigation.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
    const irrDue = irrigation.reduce((s, x) => s + Number(x.due_amount || 0), 0);

    return {
      income, expense, cashBalance: Number(openingCash || 0) + income - expense,
      savBal, loanIssued, loanCollected, loanDue,
      irrCharged, irrCollected, irrDue,
    };
  }, [receipts, expenses, savings, loans, loanPayments, irrigation, openingCash]);

  function rangeLabel() {
    if (!from && !to) return "All time";
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
                      <SelectContent>{RECEIPT_KINDS.map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
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
                  <div><Label>{t("head")}</Label><Input value={e.head} onChange={ev => setE({ ...e, head: ev.target.value })} placeholder="e.g. Salary, Diesel, Repair" /></div>
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
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>{t("openingCash")}</Label><Input type="number" value={openingCash || ""} onChange={e => setOpeningCash(+e.target.value)} /></div>
          <div className="self-end text-sm text-muted-foreground">
            <div>{t("openingBalance")}: <span className="font-semibold">{money(openingCash)}</span></div>
            <div>{t("income")}: <span className="font-semibold text-success">{money(totals.income)}</span> · {t("expense")}: <span className="font-semibold text-destructive">{money(totals.expense)}</span></div>
            <div>{t("closing")}: <span className={`font-bold ${totals.cashBalance < 0 ? "due-text" : "text-success"}`}>{money(totals.cashBalance)}</span></div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
          <Button size="sm" variant="outline" onClick={() => exportAuditReportPDF({
            brand: { company_name: brand.company_name, address: brand.address ?? "" },
            range: rangeLabel(),
            summary: [
              { label: "Opening Cash", value: Number(openingCash || 0) },
              { label: "Total Income (Receipts)", value: totals.income },
              { label: "Total Expense", value: totals.expense },
              { label: "Closing Cash", value: totals.cashBalance },
              { label: "Savings Balance", value: totals.savBal },
              { label: "Loan Issued", value: totals.loanIssued },
              { label: "Loan Collected", value: totals.loanCollected },
              { label: "Loan Outstanding Due", value: totals.loanDue },
              { label: "Irrigation Charged", value: totals.irrCharged },
              { label: "Irrigation Collected", value: totals.irrCollected },
              { label: "Irrigation Outstanding Due", value: totals.irrDue },
            ],
          })}><FileDown className="h-4 w-4 mr-1" />Audit Report PDF</Button>
        </div>
      </Card>

      <Tabs defaultValue="cashbook">
        <TabsList>
          <TabsTrigger value="cashbook">{t("cashbook")}</TabsTrigger>
          <TabsTrigger value="receipts">{t("receipts")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")}</TabsTrigger>
          <TabsTrigger value="audit">{t("auditReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cashbook">
          <ExportBar
            onPdf={() => exportTablePDF("Cash Book",
              ["Date", "Kind", "Description", "Ref", "Income", "Expense", "Balance"],
              cashbookEntries.map(r => [fmtDate(r.date), r.kind, r.label, r.ref, r.kind === "income" ? r.amount : "", r.kind === "expense" ? r.amount : "", r.balance]),
              { from, to })}
            onXlsx={() => exportExcel("cash-book", "Cashbook",
              cashbookEntries.map(r => ({ Date: r.date, Kind: r.kind, Description: r.label, Ref: r.ref, Income: r.kind === "income" ? r.amount : "", Expense: r.kind === "expense" ? r.amount : "", Balance: r.balance })),
              { from, to })}
          />
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead className="text-right">{t("income")}</TableHead>
              <TableHead className="text-right">{t("expense")}</TableHead>
              <TableHead className="text-right">{t("runningBalance")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 font-medium">
                <TableCell>{from || "—"}</TableCell>
                <TableCell><Badge variant="outline">opening</Badge></TableCell>
                <TableCell colSpan={2}>Opening Cash Balance</TableCell>
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
                <TableCell colSpan={4} className="text-right">Closing</TableCell>
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
            onPdf={() => exportTablePDF("Receipts", ["Receipt #", "Date", "Kind", "Farmer", "Amount", "Method"], receipts.map(x => [x.receipt_no, fmtDate(x.receipt_date), KIND_LABEL[x.kind as Kind] ?? x.kind, x.farmers?.name_en ?? "—", x.amount, x.method]), { from, to })}
            onXlsx={() => exportExcel("receipts", "Receipts", receipts.map(x => ({ "Receipt #": x.receipt_no, Date: x.receipt_date, Kind: KIND_LABEL[x.kind as Kind] ?? x.kind, Farmer: x.farmers?.name_en ?? "", Amount: x.amount, Method: x.method, Note: x.note })), { from, to })}
          />
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("receiptNo")}</TableHead><TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead><TableHead>{t("farmerName")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("method")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {receipts.map(x => (
                <TableRow key={x.id}>
                  <TableCell className="font-mono text-xs">{x.receipt_no}</TableCell>
                  <TableCell>{fmtDate(x.receipt_date)}</TableCell>
                  <TableCell><Badge variant="outline">{KIND_LABEL[x.kind as Kind] ?? x.kind}</Badge></TableCell>
                  <TableCell>{x.farmers?.name_en ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{money(x.amount)}</TableCell>
                  <TableCell>{x.method}</TableCell>
                </TableRow>
              ))}
              {receipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
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
            <Button size="sm" variant="outline" onClick={() => exportTablePDF("Audit Report",
              ["Section", "Amount"],
              [
                ["Total Income", totals.income],
                ["Total Expense", totals.expense],
                ["Cash Balance", totals.cashBalance],
                ["Savings Balance", totals.savBal],
                ["Loan Issued", totals.loanIssued],
                ["Loan Collected", totals.loanCollected],
                ["Loan Outstanding (Due)", totals.loanDue],
                ["Irrigation Charged", totals.irrCharged],
                ["Irrigation Collected", totals.irrCollected],
                ["Irrigation Outstanding (Due)", totals.irrDue],
              ],
              { from, to })}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
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
                <Row label={t("income") + " (Total Receipts)"} value={totals.income} positive />
                <Row label={t("expense") + " (Total)"} value={totals.expense} negative />
                <Row label={t("cashbook") + " " + t("balance")} value={totals.cashBalance} bold />
              </Section>

              <Section title={t("savings")}>
                <Row label={t("savings") + " " + t("balance")} value={totals.savBal} bold />
              </Section>

              <Section title={t("loans")}>
                <Row label="Issued (Principal)" value={totals.loanIssued} />
                <Row label="Collected" value={totals.loanCollected} positive />
                <Row label="Outstanding (Due)" value={totals.loanDue} bold negative={totals.loanDue > 0} />
              </Section>

              <Section title={t("irrigation")}>
                <Row label="Charged" value={totals.irrCharged} />
                <Row label="Collected" value={totals.irrCollected} positive />
                <Row label="Outstanding (Due)" value={totals.irrDue} bold negative={totals.irrDue > 0} />
              </Section>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-12 pt-12 print:pt-20">
              {["Prepared By", "Checked By", "Approved By"].map(s =>
                <div key={s} className="text-center">
                  <div className="border-t mt-8 pt-2 text-xs text-muted-foreground">{s}</div>
                </div>)}
            </div>
            {!isAdmin && <p className="mt-4 text-xs text-muted-foreground italic">Only Committee/Admins can edit underlying data.</p>}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ExportBar({ onPdf, onXlsx }: { onPdf: () => void; onXlsx: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex justify-end gap-2 mb-3">
      <Button size="sm" variant="outline" onClick={onPdf}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
      <Button size="sm" variant="outline" onClick={onXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("exportExcel")}</Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold border-b pb-1 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
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
