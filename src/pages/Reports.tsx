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
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel, exportAuditReportPDF } from "@/lib/exports";
import { useBranding } from "@/lib/branding";

const ALL = "__all__";

export default function Reports() {
  const { t } = useLang();
  const brand = useBranding();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState(ALL);
  const [officeId, setOfficeId] = useState(ALL);
  const [farmerId, setFarmerId] = useState(ALL);
  const [granularity, setGranularity] = useState<"daily" | "monthly">("monthly");

  const [irr, setIrr] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    document.title = `${t("reports")} — ${t("appName")}`;
    Promise.all([
      supabase.from("seasons").select("*"),
      supabase.from("offices").select("id,name"),
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
    ]).then(([s, o, f]) => {
      setSeasons(s.data ?? []); setOffices(o.data ?? []); setFarmers(f.data ?? []);
    });
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, seasonId, officeId, farmerId]);

  function applyCommon<T extends { gte: any; lte: any; eq: any }>(q: T, dateCol: string): T {
    if (from) q = q.gte(dateCol, from);
    if (to) q = q.lte(dateCol, to);
    if (officeId !== ALL) q = q.eq("office_id", officeId);
    if (farmerId !== ALL) q = q.eq("farmer_id", farmerId);
    return q;
  }

  async function load() {
    let irrQ: any = supabase.from("irrigation_charges")
      .select("entry_date,office_id,base_charge,canal_charge,maintenance_charge,other_charge,total,paid_amount,due_amount,farmer_id,farmers(name_en,farmer_code),seasons(name,year,type),lands(dag_no,mouza,land_size),season_id")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });
    irrQ = applyCommon(irrQ, "entry_date");
    if (seasonId !== ALL) irrQ = irrQ.eq("season_id", seasonId);
    setIrr((await irrQ).data ?? []);

    let lnQ: any = supabase.from("loans").select("issued_on,office_id,principal,interest_rate,total_payable,status,farmer_id,farmers(name_en,farmer_code),loan_payments(amount,paid_on)").is("deleted_at", null).order("issued_on", { ascending: false });
    lnQ = applyCommon(lnQ, "issued_on");
    setLoans((await lnQ).data ?? []);

    let lpQ: any = supabase.from("loan_payments").select("paid_on,amount,office_id,loan_id,loans(farmer_id)").order("paid_on", { ascending: false });
    if (from) lpQ = lpQ.gte("paid_on", from);
    if (to) lpQ = lpQ.lte("paid_on", to);
    if (officeId !== ALL) lpQ = lpQ.eq("office_id", officeId);
    setLoanPayments((await lpQ).data ?? []);

    let svQ: any = supabase.from("savings_transactions").select("txn_date,type,amount,status,office_id,farmer_id,farmers(name_en,farmer_code)").is("deleted_at", null).order("txn_date", { ascending: false });
    svQ = applyCommon(svQ, "txn_date");
    setSavings((await svQ).data ?? []);

    let pQ: any = supabase.from("payments").select("created_at,amount,kind,status,method,office_id,farmer_id,farmers(name_en,farmer_code),payment_allocations(kind,amount)").is("deleted_at", null).order("created_at", { ascending: false });
    if (from) pQ = pQ.gte("created_at", from);
    if (to) pQ = pQ.lte("created_at", to);
    if (officeId !== ALL) pQ = pQ.eq("office_id", officeId);
    if (farmerId !== ALL) pQ = pQ.eq("farmer_id", farmerId);
    setPayments((await pQ).data ?? []);
  }

  // --- Monthly financial summary ---
  type Mrow = {
    period: string;
    deposits: number; withdrawals: number;
    loanIssued: number; loanCollected: number;
    irrCharged: number; irrCollected: number;
    irrDue: number; loanDue: number;
    total: number;
  };

  const periodKey = (d?: string | null) =>
    !d ? "" : (granularity === "daily" ? d.slice(0, 10) : d.slice(0, 7));

  const monthly: Mrow[] = useMemo(() => {
    const m = new Map<string, Mrow>();
    const get = (k: string) => {
      if (!m.has(k)) m.set(k, { period: k, deposits: 0, withdrawals: 0, loanIssued: 0, loanCollected: 0, irrCharged: 0, irrCollected: 0, irrDue: 0, loanDue: 0, total: 0 });
      return m.get(k)!;
    };
    for (const r of savings) {
      if (r.status !== "approved") continue;
      const k = periodKey(r.txn_date);
      const g = get(k);
      if (r.type === "deposit") g.deposits += Number(r.amount); else g.withdrawals += Number(r.amount);
    }
    for (const r of loans) {
      const k = periodKey(r.issued_on);
      const g = get(k);
      g.loanIssued += Number(r.principal || 0);
      const paid = (r.loan_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const due = Number(r.total_payable || 0) - paid;
      if (r.status === "approved" && due > 0) g.loanDue += due;
    }
    for (const r of loanPayments) {
      const k = periodKey(r.paid_on);
      get(k).loanCollected += Number(r.amount || 0);
    }
    for (const r of irr) {
      const k = periodKey(r.entry_date);
      const g = get(k);
      g.irrCharged += Number(r.total || 0);
      g.irrCollected += Number(r.paid_amount || 0);
      g.irrDue += Number(r.due_amount || 0);
    }
    for (const g of m.values()) g.total = g.deposits - g.withdrawals + g.loanCollected + g.irrCollected;
    return Array.from(m.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [savings, loans, loanPayments, irr, granularity]);

  // --- Reconciliation ---
  const recon = useMemo(() => {
    const irrCollected = irr.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const loanCollected = loanPayments.reduce((s, r) => s + Number(r.amount || 0), 0);
    const savDeposits = savings.filter(s => s.status === "approved" && s.type === "deposit").reduce((s, r) => s + Number(r.amount), 0);
    const savWithdraws = savings.filter(s => s.status === "approved" && s.type === "withdraw").reduce((s, r) => s + Number(r.amount), 0);

    const paymentsApproved = payments.filter(p => p.status === "approved");
    const totalPayments = paymentsApproved.reduce((s, p) => s + Number(p.amount), 0);

    // sum allocations by kind from payments
    let allocLoan = 0, allocIrr = 0, allocSav = 0;
    for (const p of paymentsApproved) {
      const list = p.payment_allocations ?? [];
      if (list.length === 0) {
        if (p.kind === "loan") allocLoan += Number(p.amount);
        else if (p.kind === "irrigation") allocIrr += Number(p.amount);
        else if (p.kind === "savings") allocSav += Number(p.amount);
      } else {
        for (const a of list) {
          if (a.kind === "loan") allocLoan += Number(a.amount);
          else if (a.kind === "irrigation") allocIrr += Number(a.amount);
          else if (a.kind === "savings") allocSav += Number(a.amount);
        }
      }
    }

    return [
      { metric: "Irrigation collected (ledger)", expected: irrCollected, actual: allocIrr, diff: allocIrr - irrCollected },
      { metric: "Loan collected (ledger)", expected: loanCollected, actual: allocLoan, diff: allocLoan - loanCollected },
      { metric: "Savings deposits", expected: savDeposits, actual: allocSav, diff: allocSav - savDeposits },
      { metric: "Savings withdrawals", expected: savWithdraws, actual: 0, diff: 0 },
      { metric: "Total payment entries", expected: totalPayments, actual: allocLoan + allocIrr + allocSav, diff: (allocLoan + allocIrr + allocSav) - totalPayments },
    ];
  }, [irr, loanPayments, savings, payments]);

  // --- Irrigation Arrears (per charge with due > 0, aged) ---
  // Age is computed as the difference (in whole days) between today and entry_date,
  // using UTC date-only arithmetic so the bucket does not flip with the user's
  // timezone or daylight-saving transitions.
  const arrears = useMemo(() => {
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return irr
      .filter((r: any) => Number(r.due_amount || 0) > 0)
      .map((r: any) => {
        // entry_date is a postgres DATE serialized as 'YYYY-MM-DD'
        const ds = String(r.entry_date || "").slice(0, 10);
        const [y, m, d] = ds.split("-").map(Number);
        const entryUTC = Number.isFinite(y) ? Date.UTC(y, (m || 1) - 1, d || 1) : NaN;
        const days = Number.isFinite(entryUTC) ? Math.max(0, Math.round((todayUTC - entryUTC) / 86400000)) : 0;
        const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
        return {
          date: r.entry_date,
          code: r.farmers?.farmer_code ?? "—",
          name: r.farmers?.name_en ?? "—",
          season: r.seasons ? `${r.seasons.name} ${r.seasons.year}` : "—",
          dag: r.lands?.dag_no ?? "—",
          total: Number(r.total || 0),
          paid: Number(r.paid_amount || 0),
          due: Number(r.due_amount || 0),
          office_id: r.office_id,
          days, bucket,
        };
      })
      .sort((a, b) => b.due - a.due);
  }, [irr]);

  // --- Savings Balance per Farmer ---
  const balances = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code: string; deposit: number; withdraw: number; balance: number }>();
    for (const r of savings) {
      if (r.status !== "approved") continue;
      const id = r.farmer_id;
      const cur = m.get(id) ?? { id, name: r.farmers?.name_en ?? "—", code: r.farmers?.farmer_code ?? "—", deposit: 0, withdraw: 0, balance: 0 };
      if (r.type === "deposit") cur.deposit += Number(r.amount); else cur.withdraw += Number(r.amount);
      cur.balance = cur.deposit - cur.withdraw;
      m.set(id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.balance - a.balance);
  }, [savings]);

  // --- Audit aggregations: by Office and by Season ---
  const byOffice = useMemo(() => {
    const m = new Map<string, { office: string; income: number; expense: number; loanIssued: number; loanCollected: number; irrCharged: number; irrCollected: number; irrDue: number; savBal: number }>();
    const officeName = (id: string | null) => offices.find(o => o.id === id)?.name ?? "—";
    const get = (id: string) => {
      const k = id ?? "none";
      if (!m.has(k)) m.set(k, { office: officeName(id), income: 0, expense: 0, loanIssued: 0, loanCollected: 0, irrCharged: 0, irrCollected: 0, irrDue: 0, savBal: 0 });
      return m.get(k)!;
    };
    for (const p of payments) if (p.status === "approved") get(p.office_id).income += Number(p.amount);
    for (const l of loans) get(l.office_id).loanIssued += Number(l.principal || 0);
    for (const lp of loanPayments) get(lp.office_id).loanCollected += Number(lp.amount || 0);
    for (const i of irr) {
      const g = get(i.office_id);
      g.irrCharged += Number(i.total || 0);
      g.irrCollected += Number(i.paid_amount || 0);
      g.irrDue += Number(i.due_amount || 0);
    }
    for (const s of savings) if (s.status === "approved") {
      const g = get(s.office_id);
      g.savBal += s.type === "deposit" ? Number(s.amount) : -Number(s.amount);
    }
    return Array.from(m.values()).sort((a, b) => b.income - a.income);
  }, [payments, loans, loanPayments, irr, savings, offices]);

  const bySeason = useMemo(() => {
    const m = new Map<string, { season: string; charged: number; collected: number; due: number }>();
    for (const i of irr) {
      const s = i.seasons ? `${i.seasons.name} ${i.seasons.year}` : "—";
      const g = m.get(s) ?? { season: s, charged: 0, collected: 0, due: 0 };
      g.charged += Number(i.total || 0);
      g.collected += Number(i.paid_amount || 0);
      g.due += Number(i.due_amount || 0);
      m.set(s, g);
    }
    return Array.from(m.values()).sort((a, b) => b.charged - a.charged);
  }, [irr]);

  const auditSummary = useMemo(() => {
    const income = payments.filter(p => p.status === "approved").reduce((s, p) => s + Number(p.amount), 0);
    const loanIssued = loans.reduce((s, l) => s + Number(l.principal || 0), 0);
    const loanCollected = loanPayments.reduce((s, lp) => s + Number(lp.amount || 0), 0);
    const loanDue = loans.filter(l => l.status === "approved").reduce((s, l) => {
      const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
      return s + Math.max(0, Number(l.total_payable || 0) - paid);
    }, 0);
    const irrCharged = irr.reduce((s, x) => s + Number(x.total || 0), 0);
    const irrCollected = irr.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
    const irrDue = irr.reduce((s, x) => s + Number(x.due_amount || 0), 0);
    const savDep = savings.filter(s => s.status === "approved" && s.type === "deposit").reduce((a, x) => a + Number(x.amount), 0);
    const savWd = savings.filter(s => s.status === "approved" && s.type === "withdraw").reduce((a, x) => a + Number(x.amount), 0);
    return [
      { label: "Total Income (Approved Payments)", value: income },
      { label: "Loan Issued (Principal)", value: loanIssued },
      { label: "Loan Collected", value: loanCollected },
      { label: "Loan Outstanding Due", value: loanDue },
      { label: "Irrigation Charged", value: irrCharged },
      { label: "Irrigation Collected", value: irrCollected },
      { label: "Irrigation Outstanding Due", value: irrDue },
      { label: "Savings Deposits", value: savDep },
      { label: "Savings Withdrawals", value: savWd },
      { label: "Net Savings Balance", value: savDep - savWd },
    ];
  }, [payments, loans, loanPayments, irr, savings]);

  function filterTitleSuffix() {
    const parts: string[] = [];
    if (from || to) parts.push(`${from || "…"}→${to || "…"}`);
    if (officeId !== ALL) parts.push(offices.find(o => o.id === officeId)?.name ?? "");
    if (farmerId !== ALL) parts.push(farmers.find(f => f.id === farmerId)?.name_en ?? "");
    return parts.length ? ` (${parts.join(" · ")})` : "";
  }

  return (
    <>
      <PageHeader title={t("reports")} description={t("reportsFilterDesc")} />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>{t("office")}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("farmerName")}</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("season")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("all")}</SelectItem>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("rpGranularity" as any)}</Label>
            <Select value={granularity} onValueChange={(v: any) => setGranularity(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("rpDaily" as any)}</SelectItem>
                <SelectItem value="monthly">{t("rpMonthly" as any)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">{granularity === "daily" ? t("rpDaily" as any) : t("rpMonthly" as any)} {t("rpFinancial" as any)}</TabsTrigger>
          <TabsTrigger value="recon">{t("rpReconciliation" as any)}</TabsTrigger>
          <TabsTrigger value="irrigation">{t("irrigationReport")}</TabsTrigger>
          <TabsTrigger value="arrears">{t("rpIrrArrears" as any)}</TabsTrigger>
          <TabsTrigger value="loan">{t("loanReport")}</TabsTrigger>
          <TabsTrigger value="savings">{t("savingsReport")}</TabsTrigger>
          <TabsTrigger value="balances">{t("rpSavBalances" as any)}</TabsTrigger>
          <TabsTrigger value="payments">{t("rpPayments" as any)}</TabsTrigger>
          <TabsTrigger value="audit">{t("rpAuditTab" as any)}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <ExportBar
            onPdf={() => exportTablePDF(`${granularity === "daily" ? "Daily" : "Monthly"} Financial${filterTitleSuffix()}`,
              [granularity === "daily" ? "Date" : "Month", "Deposits", "Withdrawals", "Loan Issued", "Loan Collected", "Irr Charged", "Irr Collected", "Loan Due", "Irr Due", "Net Total"],
              monthly.map(m => [m.period, m.deposits, m.withdrawals, m.loanIssued, m.loanCollected, m.irrCharged, m.irrCollected, m.loanDue, m.irrDue, m.total]),
              { from, to })}
            onXlsx={() => exportExcel(`${granularity}-financial`, granularity === "daily" ? "Daily" : "Monthly", monthly.map(m => ({
              [granularity === "daily" ? "Date" : "Month"]: m.period, Deposits: m.deposits, Withdrawals: m.withdrawals,
              "Loan Issued": m.loanIssued, "Loan Collected": m.loanCollected,
              "Irrigation Charged": m.irrCharged, "Irrigation Collected": m.irrCollected,
              "Loan Due": m.loanDue, "Irrigation Due": m.irrDue, "Net Total": m.total,
            })), { from, to })}
          />
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{granularity === "daily" ? t("date") : t("rpMonth" as any)}</TableHead>
                <TableHead className="text-right">{t("rpDeposits" as any)}</TableHead>
                <TableHead className="text-right">{t("rpWithdrawals" as any)}</TableHead>
                <TableHead className="text-right">{t("rpLoanIssued" as any)}</TableHead>
                <TableHead className="text-right">{t("rpLoanCollected" as any)}</TableHead>
                <TableHead className="text-right">{t("rpIrrCharged" as any)}</TableHead>
                <TableHead className="text-right">{t("rpIrrCollected" as any)}</TableHead>
                <TableHead className="text-right">{t("rpLoanDue" as any)}</TableHead>
                <TableHead className="text-right">{t("rpIrrDue" as any)}</TableHead>
                <TableHead className="text-right">{t("rpNetTotal" as any)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {monthly.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.period}</TableCell>
                    <TableCell className="text-right text-success">{money(m.deposits)}</TableCell>
                    <TableCell className="text-right">{money(m.withdrawals)}</TableCell>
                    <TableCell className="text-right">{money(m.loanIssued)}</TableCell>
                    <TableCell className="text-right text-success">{money(m.loanCollected)}</TableCell>
                    <TableCell className="text-right">{money(m.irrCharged)}</TableCell>
                    <TableCell className="text-right text-success">{money(m.irrCollected)}</TableCell>
                    <TableCell className={`text-right ${m.loanDue > 0 ? "due-text" : ""}`}>{money(m.loanDue)}</TableCell>
                    <TableCell className={`text-right ${m.irrDue > 0 ? "due-text" : ""}`}>{money(m.irrDue)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(m.total)}</TableCell>
                  </TableRow>
                ))}
                {monthly.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">{t("rpNoData" as any)}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="recon">
          <ExportBar
            onPdf={() => exportTablePDF(`Reconciliation${filterTitleSuffix()}`, ["Metric", "Ledger", "Allocations", "Diff"], recon.map(r => [r.metric, r.expected, r.actual, r.diff]))}
            onXlsx={() => exportExcel("reconciliation", "Recon", recon.map(r => ({ Metric: r.metric, Ledger: r.expected, Allocations: r.actual, Diff: r.diff })))}
          />
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Ledger</TableHead><TableHead className="text-right">Payment allocations</TableHead><TableHead className="text-right">Diff</TableHead></TableRow></TableHeader>
              <TableBody>{recon.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.metric}</TableCell>
                  <TableCell className="text-right">{money(r.expected)}</TableCell>
                  <TableCell className="text-right">{money(r.actual)}</TableCell>
                  <TableCell className={`text-right ${Math.abs(r.diff) > 0.01 ? "due-text" : "text-success"}`}>{money(r.diff)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">Compares each module's recorded balances against allocations recorded against payments. Non-zero differences may indicate manual ledger entries (without a payment) or pending receipts.</p>
        </TabsContent>

        <TabsContent value="irrigation">
          <ExportBar
            onPdf={() => exportTablePDF(`Irrigation Detail${filterTitleSuffix()}`, ["Date", "Farmer", "Season", "Dag", "Base", "Canal", "Maint.", "Other", "Total", "Paid", "Due"], irr.map(r => [fmtDate(r.entry_date), `${r.farmers?.farmer_code} ${r.farmers?.name_en}`, r.seasons?.name, r.lands?.dag_no, r.base_charge, r.canal_charge, r.maintenance_charge, r.other_charge, r.total, r.paid_amount, r.due_amount]))}
            onXlsx={() => exportExcel("irrigation-detail", "Irrigation", irr.map(r => ({ Date: r.entry_date, Farmer: r.farmers?.name_en, Code: r.farmers?.farmer_code, Season: r.seasons?.name, Dag: r.lands?.dag_no, Mouza: r.lands?.mouza, Size: r.lands?.land_size, Base: r.base_charge, Canal: r.canal_charge, Maintenance: r.maintenance_charge, Other: r.other_charge, Total: r.total, Paid: r.paid_amount, Due: r.due_amount })))}
          />
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead>
              <TableHead className="text-right">Base</TableHead><TableHead className="text-right">Canal</TableHead><TableHead className="text-right">Maint.</TableHead><TableHead className="text-right">Other</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead><TableHead className="text-right">{t("paidAmount")}</TableHead><TableHead className="text-right">{t("dueAmount")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{irr.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{fmtDate(r.entry_date)}</TableCell>
                <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
                <TableCell>{r.seasons?.name}</TableCell>
                <TableCell>{r.lands?.dag_no}</TableCell>
                <TableCell className="text-right">{money(r.base_charge)}</TableCell>
                <TableCell className="text-right">{money(r.canal_charge)}</TableCell>
                <TableCell className="text-right">{money(r.maintenance_charge)}</TableCell>
                <TableCell className="text-right">{money(r.other_charge)}</TableCell>
                <TableCell className="text-right font-medium">{money(r.total)}</TableCell>
                <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                <TableCell className={`text-right ${r.due_amount > 0 ? "due-text" : ""}`}>{money(r.due_amount)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="loan">
          <ExportBar
            onPdf={() => exportTablePDF(`Loan Report${filterTitleSuffix()}`, ["Date", "Farmer", "Principal", "Rate", "Payable", "Status"], loans.map(r => [fmtDate(r.issued_on), r.farmers?.name_en, r.principal, r.interest_rate, r.total_payable, r.status]))}
            onXlsx={() => exportExcel("loan-report", "Loans", loans.map(r => ({ Date: r.issued_on, Farmer: r.farmers?.name_en, Principal: r.principal, Rate: r.interest_rate, Payable: r.total_payable, Status: r.status })))}
          />
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("principal")}</TableHead><TableHead>{t("interestRate")}</TableHead><TableHead>{t("totalPayable")}</TableHead><TableHead>{t("dueAmount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{loans.map((r, i) => {
              const paid = (r.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
              const due = Number(r.total_payable) - paid;
              return <TableRow key={i}><TableCell>{fmtDate(r.issued_on)}</TableCell><TableCell>{r.farmers?.name_en}</TableCell><TableCell>{money(r.principal)}</TableCell><TableCell>{r.interest_rate}%</TableCell><TableCell>{money(r.total_payable)}</TableCell><TableCell className={due > 0 && r.status === "approved" ? "due-text" : ""}>{money(due)}</TableCell><TableCell>{r.status}</TableCell></TableRow>;
            })}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="savings">
          <ExportBar
            onPdf={() => exportTablePDF(`Savings Report${filterTitleSuffix()}`, ["Date", "Farmer", "Type", "Amount", "Status"], savings.map(r => [fmtDate(r.txn_date), r.farmers?.name_en, r.type, r.amount, r.status]))}
            onXlsx={() => exportExcel("savings-report", "Savings", savings.map(r => ({ Date: r.txn_date, Farmer: r.farmers?.name_en, Type: r.type, Amount: r.amount, Status: r.status })))}
          />
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{savings.map((r, i) => <TableRow key={i}><TableCell>{fmtDate(r.txn_date)}</TableCell><TableCell>{r.farmers?.name_en}</TableCell><TableCell>{r.type}</TableCell><TableCell>{money(r.amount)}</TableCell><TableCell>{r.status}</TableCell></TableRow>)}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="arrears">
          <ExportBar
            onPdf={() => exportTablePDF(`Irrigation Arrears${filterTitleSuffix()}`,
              ["Date", "Code", "Farmer", "Season", "Dag", "Total", "Paid", "Due", "Age", "Bucket"],
              arrears.map(r => [fmtDate(r.date), r.code, r.name, r.season, r.dag, r.total, r.paid, r.due, `${r.days}d`, r.bucket]))}
            onXlsx={() => exportExcel("irrigation-arrears", "Arrears",
              arrears.map(r => ({ Date: r.date, Code: r.code, Farmer: r.name, Season: r.season, Dag: r.dag, Total: r.total, Paid: r.paid, Due: r.due, AgeDays: r.days, Bucket: r.bucket })))}
          />
          <p className="text-xs text-muted-foreground mb-2">
            Filters above (date range, office, farmer, season) apply to this report. Aging buckets are computed in UTC from <span className="font-mono">entry_date</span>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            {(["0-30", "31-60", "61-90", "90+"] as const).map(b => {
              const sum = arrears.filter(r => r.bucket === b).reduce((a, r) => a + r.due, 0);
              return (
                <Card key={b} className="p-3"><div className="text-xs uppercase text-muted-foreground">{b} days</div><div className="text-lg font-bold">{money(sum)}</div></Card>
              );
            })}
            <Card className="p-3 bg-destructive/5"><div className="text-xs uppercase text-destructive">Total Arrears</div><div className="text-lg font-bold text-destructive">{money(arrears.reduce((a, r) => a + r.due, 0))}</div></Card>
          </div>
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead><TableHead>Code</TableHead><TableHead>{t("farmerName")}</TableHead>
              <TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead className="text-right">{t("paidAmount")}</TableHead>
              <TableHead className="text-right">{t("dueAmount")}</TableHead>
              <TableHead>Age</TableHead><TableHead>Bucket</TableHead>
            </TableRow></TableHeader>
            <TableBody>{arrears.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.season}</TableCell>
                <TableCell>{r.dag}</TableCell>
                <TableCell className="text-right">{money(r.total)}</TableCell>
                <TableCell className="text-right text-success">{money(r.paid)}</TableCell>
                <TableCell className="text-right due-text font-semibold">{money(r.due)}</TableCell>
                <TableCell>{r.days}d</TableCell>
                <TableCell>{r.bucket}</TableCell>
              </TableRow>
            ))}
            {arrears.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">No arrears</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="balances">
          <ExportBar
            onPdf={() => exportTablePDF(`Savings Balances${filterTitleSuffix()}`,
              ["Code", "Farmer", "Total Deposit", "Total Withdraw", "Balance"],
              balances.map(r => [r.code, r.name, r.deposit, r.withdraw, r.balance]))}
            onXlsx={() => exportExcel("savings-balances", "Balances",
              balances.map(r => ({ Code: r.code, Farmer: r.name, Deposit: r.deposit, Withdraw: r.withdraw, Balance: r.balance })))}
          />
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>{t("farmerName")}</TableHead>
              <TableHead className="text-right">Total Deposit</TableHead>
              <TableHead className="text-right">Total Withdraw</TableHead>
              <TableHead className="text-right">{t("balance")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{balances.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right text-success">{money(r.deposit)}</TableCell>
                <TableCell className="text-right">{money(r.withdraw)}</TableCell>
                <TableCell className="text-right font-semibold text-primary">{money(r.balance)}</TableCell>
              </TableRow>
            ))}
            {balances.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="payments">
          <ExportBar
            onPdf={() => exportTablePDF(`Payments${filterTitleSuffix()}`, ["Date", "Farmer", "Kind", "Amount", "Method", "Status"], payments.map(r => [fmtDate(r.created_at), r.farmers?.name_en, r.kind, r.amount, r.method, r.status]))}
            onXlsx={() => exportExcel("payments", "Payments", payments.map(r => ({ Date: r.created_at, Farmer: r.farmers?.name_en, Kind: r.kind, Amount: r.amount, Method: r.method, Status: r.status })))}
          />
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>Kind</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("method")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{payments.map((r, i) => <TableRow key={i}><TableCell>{fmtDate(r.created_at)}</TableCell><TableCell>{r.farmers?.name_en}</TableCell><TableCell>{r.kind}</TableCell><TableCell>{money(r.amount)}</TableCell><TableCell>{r.method}</TableCell><TableCell>{r.status}</TableCell></TableRow>)}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="audit">
          <div className="flex justify-end gap-2 mb-3">
            <Button size="sm" onClick={() => exportAuditReportPDF({
              brand: { company_name: brand.company_name, address: brand.address ?? "" },
              range: filterTitleSuffix() || "All time",
              summary: auditSummary,
              byOffice,
              bySeason,
            })}><FileDown className="h-4 w-4 mr-1" />Audit Report PDF</Button>
            <Button size="sm" variant="outline" onClick={() => exportExcel("audit-by-office", "By Office",
              byOffice.map(o => ({ Office: o.office, Income: o.income, Expense: o.expense, "Loan Issued": o.loanIssued, "Loan Collected": o.loanCollected, "Irrigation Charged": o.irrCharged, "Irrigation Collected": o.irrCollected, "Irrigation Due": o.irrDue, "Savings Balance": o.savBal })))}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Office Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportExcel("audit-by-season", "By Season",
              bySeason.map(s => ({ Season: s.season, Charged: s.charged, Collected: s.collected, Due: s.due })))}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Season Excel
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">Summary {filterTitleSuffix()}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {auditSummary.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5">{s.label}</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{money(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">By Season — Irrigation</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Season</TableHead><TableHead className="text-right">Charged</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Due</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bySeason.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.season}</TableCell>
                      <TableCell className="text-right">{money(s.charged)}</TableCell>
                      <TableCell className="text-right text-success">{money(s.collected)}</TableCell>
                      <TableCell className={`text-right ${s.due > 0 ? "due-text font-semibold" : ""}`}>{money(s.due)}</TableCell>
                    </TableRow>
                  ))}
                  {bySeason.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>

          <Card className="overflow-x-auto mt-4">
            <div className="p-3 font-semibold text-sm uppercase text-muted-foreground border-b">By Office</div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Office</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Loan Issued</TableHead>
                <TableHead className="text-right">Loan Collected</TableHead>
                <TableHead className="text-right">Irr Charged</TableHead>
                <TableHead className="text-right">Irr Collected</TableHead>
                <TableHead className="text-right">Irr Due</TableHead>
                <TableHead className="text-right">Savings Balance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byOffice.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{o.office}</TableCell>
                    <TableCell className="text-right text-success">{money(o.income)}</TableCell>
                    <TableCell className="text-right">{money(o.loanIssued)}</TableCell>
                    <TableCell className="text-right text-success">{money(o.loanCollected)}</TableCell>
                    <TableCell className="text-right">{money(o.irrCharged)}</TableCell>
                    <TableCell className="text-right text-success">{money(o.irrCollected)}</TableCell>
                    <TableCell className={`text-right ${o.irrDue > 0 ? "due-text font-semibold" : ""}`}>{money(o.irrDue)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{money(o.savBal)}</TableCell>
                  </TableRow>
                ))}
                {byOffice.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No data</TableCell></TableRow>}
              </TableBody>
            </Table>
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
