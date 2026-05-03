import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X, Printer, Ban, FileSpreadsheet, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF, exportTablePDF, exportExcel } from "@/lib/exports";
import { useBranding } from "@/lib/branding";

export default function Savings() {
  const { t, lang } = useLang();
  const { isCommittee, user } = useAuth();
  const brand = useBranding();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ farmer_id: "", type: "deposit", amount: 0, note: "" });
  const [plans, setPlans] = useState<any[]>([]);
  const [farmerPlans, setFarmerPlans] = useState<any[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ farmer_id: "", plan_id: "", start_date: new Date().toISOString().slice(0, 10) });
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const [decision, setDecision] = useState<{ id: string; mode: "reject" | "cancel"; reason: string } | null>(null);
  

  useEffect(() => { document.title = `${t("savings")} — ${t("appName")}`; load(); }, []);
  async function load() {
    const [f, ts, pr, sp, fsp] = await Promise.all([
      supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,mobile,village").order("name_en"),
      supabase.from("savings_transactions").select("*, farmers(name_en,farmer_code,member_no,mobile,village)").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,full_name,username"),
      supabase.from("savings_plans").select("*").eq("is_active", true).order("name"),
      supabase.from("farmer_savings_plans").select("*, farmers(name_en,name_bn,farmer_code), savings_plans(name,name_bn,duration_months,installment_type,installment_amount,interest_rate,maturity_type)").order("created_at", { ascending: false }),
    ]);
    setFarmers(f.data ?? []);
    setTxns(ts.data ?? []);
    setPlans(sp.data ?? []);
    setFarmerPlans(fsp.data ?? []);
    const map: Record<string, string> = {};
    (pr.data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.username || p.id.slice(0, 6); });
    setProfiles(map);
  }
  function calcMaturity(plan: any) {
    const n = plan.installment_type === "daily" ? plan.duration_months * 30
      : plan.installment_type === "weekly" ? Math.floor(plan.duration_months * 30 / 7)
      : plan.duration_months;
    const total = Number(plan.installment_amount) * n;
    const r = Number(plan.interest_rate) / 100;
    const years = plan.duration_months / 12;
    const interest = plan.maturity_type === "compound"
      ? total * (Math.pow(1 + r, years) - 1)
      : total * r * years;
    return { total, interest, maturity: total + interest, count: n };
  }
  async function enrollPlan() {
    if (!planForm.farmer_id || !planForm.plan_id) return toast.error("Select farmer and plan");
    const plan = plans.find(p => p.id === planForm.plan_id);
    const c = calcMaturity(plan);
    const { error } = await supabase.from("farmer_savings_plans").insert({
      farmer_id: planForm.farmer_id,
      plan_id: planForm.plan_id,
      start_date: planForm.start_date,
      expected_total: c.total,
      expected_interest: c.interest,
      maturity_amount: c.maturity,
      status: "pending",
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Enrollment submitted for approval"); setPlanOpen(false); load();
  }
  async function approvePlan(id: string) {
    const target = farmerPlans.find(x => x.id === id);
    if (target?.status === "cancelled" || target?.status === "rejected") {
      toast.error(t("cannotEditCancelled" as any));
      return;
    }
    const { error } = await supabase.from("farmer_savings_plans")
      .update({ status: "active", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return toast.error(error.message);
    toast.success(t("approved" as any)); load();
  }
  async function submitDecision(id: string, mode: "reject" | "cancel", reason: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) { toast.error(t("reasonRequired" as any)); return false; }
    const target = farmerPlans.find(x => x.id === id);
    if (target?.status === "cancelled" || target?.status === "rejected") {
      toast.error(t("cannotEditCancelled" as any));
      return false;
    }
    const patch: any = mode === "reject"
      ? { status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString(), cancel_reason: trimmed }
      : { status: "cancelled", cancelled_by: user?.id, cancelled_at: new Date().toISOString(), cancel_reason: trimmed, expected_total: 0, expected_interest: 0, maturity_amount: 0 };
    let q = supabase.from("farmer_savings_plans").update(patch).eq("id", id);
    // Server-side guard: only allow rejecting from 'pending' and cancelling from 'pending'/'active'
    if (mode === "reject") q = q.eq("status", "pending");
    else q = q.in("status", ["pending", "active"]);
    const { error } = await q;
    if (error) { toast.error(error.message); return false; }
    toast.success(mode === "reject" ? t("rejected" as any) : t("cancelled" as any));
    load();
    return true;
  }
  function buildSchedule(fp: any): { no: number; due_date: string; amount: number }[] {
    const plan = fp.savings_plans;
    if (!plan) return [];
    const start = new Date(fp.start_date);
    const n = plan.installment_type === "daily" ? plan.duration_months * 30
      : plan.installment_type === "weekly" ? Math.floor(plan.duration_months * 30 / 7)
      : plan.duration_months;
    const out: { no: number; due_date: string; amount: number }[] = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(start);
      if (plan.installment_type === "daily") d.setDate(d.getDate() + i);
      else if (plan.installment_type === "weekly") d.setDate(d.getDate() + i * 7);
      else d.setMonth(d.getMonth() + i);
      out.push({ no: i, due_date: d.toISOString().slice(0, 10), amount: Number(plan.installment_amount) });
    }
    return out;
  }
  function planLabel(fp: any) {
    const p = fp.savings_plans;
    if (!p) return "—";
    return lang === "bn" && p.name_bn ? p.name_bn : p.name;
  }
  function exportPlanReport(kind: "pdf" | "xlsx") {
    const filtered = farmerPlans.filter(fp => {
      const d = fp.start_date;
      if (reportRange.from && d < reportRange.from) return false;
      if (reportRange.to && d > reportRange.to) return false;
      return true;
    });
    const head = ["Start", "Farmer", "Code", "Plan", "Installment", "Expected Total", "Interest", "Maturity", "Status"];
    const rows = filtered.map(fp => [
      fp.start_date,
      fp.farmers?.name_en ?? "",
      fp.farmers?.farmer_code ?? "",
      planLabel(fp),
      Number(fp.savings_plans?.installment_amount ?? 0),
      Number(fp.expected_total),
      Number(fp.expected_interest),
      Number(fp.maturity_amount),
      fp.status,
    ]);
    if (kind === "pdf") {
      exportTablePDF("Savings Plan Enrollments", head, rows, reportRange);
    } else {
      const objs = filtered.map(fp => ({
        Start: fp.start_date,
        Farmer: fp.farmers?.name_en ?? "",
        Code: fp.farmers?.farmer_code ?? "",
        Plan: planLabel(fp),
        Installment: Number(fp.savings_plans?.installment_amount ?? 0),
        ExpectedTotal: Number(fp.expected_total),
        Interest: Number(fp.expected_interest),
        Maturity: Number(fp.maturity_amount),
        Status: fp.status,
      }));
      exportExcel("Savings Plan Enrollments", "Enrollments", objs, reportRange);
    }
  }

  async function save() {
    if (!form.farmer_id || form.amount <= 0) return toast.error(t("pickFarmerAndAmount"));
    const status = form.type === "withdraw" ? "pending" : "approved";
    const farmer = farmers.find((x: any) => x.id === form.farmer_id);
    const { error } = await supabase.from("savings_transactions").insert({
      farmer_id: form.farmer_id, type: form.type as any, amount: form.amount, note: form.note,
      status: status as any, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    if (form.type === "deposit") {
      await supabase.from("payments").insert({ farmer_id: form.farmer_id, kind: "savings", amount: form.amount, collected_by: user?.id });
    }
    if (status === "pending") {
      await supabase.from("notifications").insert({
        kind: "withdrawal_pending",
        title: t("withdrawalRequestTitle"),
        body: t("withdrawalRequestedBody").replace("{name}", farmer?.name_en ?? "").replace("{amount}", String(form.amount)),
        link: "/savings",
      });
    }
    toast.success(t("saved")); setOpen(false); setForm({ farmer_id: "", type: "deposit", amount: 0, note: "" }); load();
  }
  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("savings_transactions").update({ status, approved_by: user?.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }

  function printReceipt(r: any) {
    exportPaymentReceiptPDF({
      brand: { company_name: brand.company_name, address: brand.address, mobile: brand.mobile },
      receipt_no: `SAV-${r.id.slice(0, 8).toUpperCase()}`,
      date: r.txn_date ?? r.created_at,
      farmer: {
        name_en: r.farmers?.name_en ?? "—",
        farmer_code: r.farmers?.farmer_code,
        member_no: r.farmers?.member_no,
        mobile: r.farmers?.mobile,
        village: r.farmers?.village,
      },
      amount: Number(r.amount),
      method: "cash",
      note: r.note ?? `Savings ${r.type} (${r.status})`,
      allocations: [{ kind: `Savings ${r.type}`, amount: Number(r.amount) }],
    });
  }

  const pending = txns.filter(x => x.status === "pending");
  const approved = txns.filter(x => x.status === "approved");
  const all = txns;

  return (
    <>
      <PageHeader title={t("savings")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addEntry")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("savings")} — {t("addEntry")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("selectFarmer")}</Label>
                <Select value={form.farmer_id} onValueChange={v => setForm({ ...form, farmer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="deposit">{t("deposit")}</SelectItem><SelectItem value="withdraw">{t("withdraw")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div><Label>{t("note")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">{t("withdrawalsRequireApproval")}</p>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("pending")} {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="history">{t("approvalHistory")}</TabsTrigger>
          <TabsTrigger value="plans">Plans {farmerPlans.length > 0 && <Badge variant="secondary" className="ml-2">{farmerPlans.length}</Badge>}</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><TxnTable rows={all} t={t} isAdmin={isCommittee} onDecide={decide} onPrint={printReceipt} profiles={profiles} /></TabsContent>
        <TabsContent value="pending"><TxnTable rows={pending} t={t} isAdmin={isCommittee} onDecide={decide} onPrint={printReceipt} profiles={profiles} /></TabsContent>
        <TabsContent value="history"><TxnTable rows={approved.filter(r => r.approved_by)} t={t} isAdmin={false} onDecide={decide} onPrint={printReceipt} profiles={profiles} historyMode /></TabsContent>
        <TabsContent value="plans">
          <Card className="p-3 mb-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Enroll farmers in defined savings plans. Plans drive maturity calculations and are managed in <a href="/savings-plans" className="underline">Savings Plans</a>.</div>
            <Dialog open={planOpen} onOpenChange={setPlanOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Enroll Farmer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Enroll in Savings Plan</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Farmer</Label>
                    <Select value={planForm.farmer_id} onValueChange={v => setPlanForm({ ...planForm, farmer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Plan</Label>
                    <Select value={planForm.plan_id} onValueChange={v => setPlanForm({ ...planForm, plan_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months}mo / {p.installment_type} ৳{p.installment_amount} @ {p.interest_rate}% ({p.maturity_type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Start Date</Label><Input type="date" value={planForm.start_date} onChange={e => setPlanForm({ ...planForm, start_date: e.target.value })} /></div>
                  {planForm.plan_id && (() => { const p = plans.find(x => x.id === planForm.plan_id); if (!p) return null; const c = calcMaturity(p); return (
                    <div className="rounded-md bg-muted p-2 text-sm space-y-1">
                      <div>Installments: <b>{c.count}</b></div>
                      <div>Total deposits: <b>{money(c.total)}</b></div>
                      <div>Expected interest: <b>{money(c.interest)}</b></div>
                      <div>Maturity amount: <b>{money(c.maturity)}</b></div>
                    </div>
                  ); })()}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setPlanOpen(false)}>{t("cancel")}</Button><Button onClick={enrollPlan}>{t("save")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>
          <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-9" value={reportRange.from} onChange={e => setReportRange({ ...reportRange, from: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-9" value={reportRange.to} onChange={e => setReportRange({ ...reportRange, to: e.target.value })} />
            </div>
            <Button variant="outline" size="sm" onClick={() => exportPlanReport("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => exportPlanReport("pdf")}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          </Card>
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Start</TableHead><TableHead>Farmer</TableHead><TableHead>Plan</TableHead>
              <TableHead>Installment</TableHead><TableHead>Expected Total</TableHead>
              <TableHead>Interest</TableHead><TableHead>Maturity</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {farmerPlans.map((fp: any) => {
                const isOpen = expandedPlan === fp.id;
                const sched = isOpen ? buildSchedule(fp) : [];
                const statusVariant = fp.status === "active" ? "default" : fp.status === "pending" ? "outline" : fp.status === "rejected" || fp.status === "cancelled" ? "destructive" : "secondary";
                return (
                  <Fragment key={fp.id}>
                    <TableRow>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpandedPlan(isOpen ? null : fp.id)}>
                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                      <TableCell>{fmtDate(fp.start_date)}</TableCell>
                      <TableCell>{(lang === "bn" && fp.farmers?.name_bn) || fp.farmers?.name_en} <span className="text-xs text-muted-foreground">({fp.farmers?.farmer_code})</span></TableCell>
                      <TableCell>{planLabel(fp)} <span className="text-xs text-muted-foreground">({fp.savings_plans?.duration_months}mo / {fp.savings_plans?.installment_type})</span></TableCell>
                      <TableCell>{money(fp.savings_plans?.installment_amount)}</TableCell>
                      <TableCell>{money(fp.expected_total)}</TableCell>
                      <TableCell>{money(fp.expected_interest)}</TableCell>
                      <TableCell className="font-semibold">{money(fp.maturity_amount)}</TableCell>
                      <TableCell><Badge variant={statusVariant as any}>{t(fp.status as any)}</Badge></TableCell>
                      <TableCell className="text-right">
                        {isCommittee && fp.status === "pending" && (<>
                          <Button size="icon" variant="ghost" onClick={() => approvePlan(fp.id)} title={t("approveAction")}><Check className="h-4 w-4 text-success" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDecision({ id: fp.id, mode: "reject", reason: "" })} title={t("rejectAction")}><X className="h-4 w-4 text-destructive" /></Button>
                        </>)}
                        {isCommittee && (fp.status === "active" || fp.status === "pending") && (
                          <Button size="icon" variant="ghost" onClick={() => setDecision({ id: fp.id, mode: "cancel", reason: "" })} title={t("cancelEnrollment" as any)}><Ban className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (() => {
                      const schedTotal = sched.reduce((a, s) => a + Number(s.amount), 0);
                      return (
                      <TableRow className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={9} className="py-2">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs mb-2">
                            <span className="font-semibold uppercase text-muted-foreground">{t("installmentsCount" as any)}: <b className="text-foreground normal-case">{sched.length}</b> ({fp.savings_plans?.installment_type})</span>
                            <span>{t("expectedTotal" as any)}: <b>{money(schedTotal)}</b></span>
                            <span>{t("interestRate")}: <b>{money(fp.expected_interest)}</b></span>
                            <span>{t("maturityTotal" as any)}: <b className="text-success">{money(schedTotal + Number(fp.expected_interest))}</b></span>
                            {Math.abs(schedTotal - Number(fp.expected_total)) > 0.5 && fp.status !== "cancelled" && (
                              <span className="text-destructive">⚠ Schedule total differs from expected total by {money(Math.abs(schedTotal - Number(fp.expected_total)))}</span>
                            )}
                            {fp.cancel_reason && <span className="text-destructive">{fp.status === "rejected" ? t("rejectionReason" as any) : t("cancellationReason" as any)}: {fp.cancel_reason}</span>}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-muted-foreground sticky top-0 bg-muted/30"><tr><th className="text-left py-1">#</th><th className="text-left">Due Date</th><th className="text-right">Amount</th></tr></thead>
                              <tbody>
                                {sched.map(s => (
                                  <tr key={s.no} className="border-t">
                                    <td className="py-1">{s.no}</td>
                                    <td>{fmtDate(s.due_date)}</td>
                                    <td className="text-right">{money(s.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })()}
                  </Fragment>
                );
              })}
              {farmerPlans.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!decision} onOpenChange={(v) => !v && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.mode === "reject" ? t("rejectAction") : t("cancelEnrollment" as any)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {decision?.mode === "cancel" && (
              <p className="text-sm text-muted-foreground">{t("cancelEnrollmentConfirm" as any)}</p>
            )}
            <div>
              <Label>{decision?.mode === "reject" ? t("rejectionReason" as any) : t("cancellationReason" as any)}</Label>
              <Input
                autoFocus
                maxLength={500}
                value={decision?.reason ?? ""}
                onChange={(e) => decision && setDecision({ ...decision, reason: e.target.value })}
                placeholder={t("reasonRequired" as any)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={(decision?.reason ?? "").trim().length < 3}
              onClick={async () => {
                if (!decision) return;
                const ok = await submitDecision(decision.id, decision.mode, decision.reason);
                if (ok) setDecision(null);
              }}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TxnTable({ rows, t, isAdmin, onDecide, onPrint, profiles, historyMode }: any) {
  return (
    <Card><Table>
      <TableHeader><TableRow>
        <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead>
        <TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead>
        <TableHead>{t("status")}</TableHead>
        <TableHead>{t("approvedBy")}</TableHead>
        <TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell>{fmtDate(r.txn_date)}</TableCell>
            <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
            <TableCell><Badge variant={r.type === "deposit" ? "default" : "secondary"}>{t(r.type as any)}</Badge></TableCell>
            <TableCell className="font-semibold">{money(r.amount)}</TableCell>
            <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "outline" : "destructive"}>{t(r.status as any)}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {r.approved_by ? (
                <>
                  <div className="font-medium text-foreground">{profiles?.[r.approved_by] ?? r.approved_by.slice(0, 6)}</div>
                  <div>{fmtDate(r.created_at)}</div>
                </>
              ) : "—"}
            </TableCell>
            <TableCell className="text-right">
              {isAdmin && r.status === "pending" && (<>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "approved")} title={t("approveAction")}><Check className="h-4 w-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "rejected")} title={t("rejectAction")}><X className="h-4 w-4 text-destructive" /></Button>
              </>)}
              {(r.status === "approved" || historyMode) && (
                <Button size="icon" variant="ghost" onClick={() => onPrint(r)} title={t("printReceipt")}><Printer className="h-4 w-4" /></Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
      </TableBody>
    </Table></Card>
  );
}
