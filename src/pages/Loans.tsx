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
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X, Printer, ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react";
import { TruncateText } from "@/components/ui/truncate-text";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EditButton, DeleteButton, PrintButton } from "@/components/ui/action-icon-button";
import { useBranding } from "@/lib/branding";

const DEFAULT_INTEREST = 8.0;

export default function Loans() {
  const { t } = useLang();
  const { isCommittee, isSuper, user } = useAuth();
  const brand = useBranding();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [installments, setInstallments] = useState<Record<string, any[]>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ farmer_id: "", plan_id: "", principal: 0, interest_enabled: true, interest_rate: DEFAULT_INTEREST, issued_on: new Date().toISOString().slice(0, 10), next_due_on: "", note: "" });
  const [showDeleted, setShowDeleted] = useState(false);
  const [editLoan, setEditLoan] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ principal: 0, interest_rate: 0, interest_enabled: true, issued_on: "", next_due_on: "", note: "" });

  useEffect(() => { document.title = `${t("loans")} — ${t("appName")}`; load(); }, [showDeleted]);
  async function load() {
    let lq = supabase.from("loans").select("*, farmers(name_en,farmer_code,member_no,mobile,village), loan_payments(id,amount,paid_on,collected_by), loan_plans(name,name_bn,installment_type,duration_months)").order("created_at", { ascending: false }).limit(200);
    lq = showDeleted ? lq.not("deleted_at", "is", null) : lq.is("deleted_at", null);
    const [f, l, pr, lp] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code,member_no,mobile,village").order("name_en"),
      lq,
      supabase.from("profiles").select("id,full_name,username"),
      supabase.from("loan_plans").select("*").eq("is_active", true).order("name"),
    ]);
    setFarmers(f.data ?? []);
    setLoans(l.data ?? []);
    setPlans(lp.data ?? []);
    const map: Record<string, string> = {};
    (pr.data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.username || p.id.slice(0, 6); });
    setProfiles(map);
  }
  async function loadInstallments(loanId: string) {
    const { data } = await supabase.from("loan_installments").select("*").eq("loan_id", loanId).order("installment_no");
    setInstallments(prev => ({ ...prev, [loanId]: data ?? [] }));
  }
  async function save() {
    if (!form.farmer_id || form.principal <= 0) return toast.error(t("pickFarmerAndAmount"));
    const farmer = farmers.find((x: any) => x.id === form.farmer_id);
    const { data: vchk } = await supabase.from("farmers").select("is_voter,name_en").eq("id", form.farmer_id).maybeSingle();
    if (!vchk?.is_voter) return toast.error(`${vchk?.name_en ?? "এই ফার্মার"} এর Voter / Savings A/C এনাবল নেই — ঋণ এন্ট্রি করা যাবে না।`);
    const plan = plans.find((p: any) => p.id === form.plan_id);
    const interest_rate = form.interest_enabled ? (plan?.interest_rate ?? form.interest_rate) : 0;
    const total_payable = form.principal * (1 + interest_rate / 100);
    const { error } = await supabase.from("loans").insert({
      farmer_id: form.farmer_id,
      plan_id: form.plan_id || null,
      principal: form.principal,
      interest_enabled: form.interest_enabled,
      interest_rate,
      total_payable,
      issued_on: form.issued_on, next_due_on: form.next_due_on || null, note: form.note,
      status: "pending", created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      kind: "loan_pending",
      title: t("loanApprovalNeededTitle"),
      body: t("loanRequestedBody").replace("{name}", farmer?.name_en ?? "").replace("{amount}", String(form.principal)),
      link: "/loans",
    });
    toast.success(t("saved")); setOpen(false); load();
  }
  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("loans").update({ status, approved_by: user?.id, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    const loan = loans.find(l => l.id === id);
    if (status === "approved") {
      if (loan?.plan_id) {
        const { error: gErr } = await supabase.rpc("generate_loan_installments", { _loan_id: id });
        if (gErr) toast.error(`Schedule: ${gErr.message}`);
        else toast.success(t("installmentScheduleGenerated"));
      }
    }
    // Notify originator about the decision
    if (loan?.created_by) {
      await supabase.from("notifications").insert({
        user_id: loan.created_by,
        kind: status === "approved" ? "loan_approved" : "loan_rejected",
        title: status === "approved" ? "ঋণ অনুমোদিত" : "ঋণ প্রত্যাখ্যাত",
        body: `${loan?.farmers?.name_en ?? ""} — ৳${Number(loan?.principal ?? 0).toLocaleString()}`,
        link: "/loans",
      });
    }
    toast.success(t("saved")); load();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function remove(id: string) {
    const ok = await confirm({
      title: t("pgLoanDeleteTitle" as any),
      description: t("pgLoanDeleteDesc" as any),
      destructive: true, confirmText: t("pgDelete" as any),
    });
    if (!ok) return;
    const { error } = await supabase.from("loans").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); await load();
  }
  async function restore(id: string) {
    const { error } = await supabase.from("loans").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("restored")); load();
  }
  function startEdit(l: any) {
    setEditLoan(l);
    setEditForm({
      principal: Number(l.principal),
      interest_rate: Number(l.interest_rate),
      interest_enabled: !!l.interest_enabled,
      issued_on: l.issued_on?.slice(0, 10) ?? "",
      next_due_on: l.next_due_on?.slice(0, 10) ?? "",
      note: l.note ?? "",
    });
  }
  async function saveEdit() {
    if (!editLoan) return;
    const total_payable = editForm.principal * (1 + (editForm.interest_enabled ? editForm.interest_rate : 0) / 100);
    const { error } = await supabase.from("loans").update({
      principal: editForm.principal,
      interest_rate: editForm.interest_enabled ? editForm.interest_rate : 0,
      interest_enabled: editForm.interest_enabled,
      total_payable,
      issued_on: editForm.issued_on,
      next_due_on: editForm.next_due_on || null,
      note: editForm.note,
    }).eq("id", editLoan.id);
    if (error) return toast.error(error.message);
    toast.success(t("updated")); setEditLoan(null); load();
  }

  function printLoanReceipt(loan: any, payment?: any) {
    const isIssue = !payment;
    exportPaymentReceiptPDF({
      brand: { company_name: brand.company_name, address: brand.address, mobile: brand.mobile },
      receipt_no: isIssue ? `LOAN-${loan.id.slice(0, 8).toUpperCase()}` : `LP-${payment.id.slice(0, 8).toUpperCase()}`,
      date: isIssue ? loan.issued_on : payment.paid_on,
      farmer: {
        name_en: loan.farmers?.name_en ?? "—",
        farmer_code: loan.farmers?.farmer_code,
        member_no: loan.farmers?.member_no,
        mobile: loan.farmers?.mobile,
        village: loan.farmers?.village,
      },
      amount: isIssue ? Number(loan.principal) : Number(payment.amount),
      method: "cash",
      note: isIssue
        ? `Loan disbursed — Total Payable ${money(loan.total_payable)}${loan.interest_enabled ? ` @ ${loan.interest_rate}%` : ""}`
        : `Loan repayment`,
      allocations: isIssue
        ? [{ kind: "Loan Disbursed (Principal)", amount: Number(loan.principal) }]
        : [{ kind: "Loan Repayment", amount: Number(payment.amount) }],
    });
  }

  const pending = loans.filter(l => l.status === "pending");
  const approved = loans.filter(l => l.status === "approved" || l.status === "paid");
  const rejected = loans.filter(l => l.status === "rejected");

  return (
    <>
      <PageHeader title={t("loans")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("issueLoan")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("issueLoan")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("selectFarmer")}</Label>
                <FarmerSearchSelect votersOnly value={form.farmer_id || null}
                  onChange={(id) => setForm({ ...form, farmer_id: id ?? "" })} />
              </div>
              <div><Label>Loan Plan (optional)</Label>
                <Select value={form.plan_id} onValueChange={v => {
                  const p = plans.find(x => x.id === v);
                  setForm({ ...form, plan_id: v, interest_rate: p?.interest_rate ?? form.interest_rate });
                }}>
                  <SelectTrigger><SelectValue placeholder={t("noPlanManual")} /></SelectTrigger>
                  <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months}mo / {p.installment_type} @ {p.interest_rate}%</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">When a plan is selected, an installment schedule is auto-generated upon committee approval.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("principal")}</Label><Input type="number" value={form.principal} onChange={e => setForm({ ...form, principal: +e.target.value })} /></div>
                <div><Label>{t("interestRate")}</Label><Input type="number" step="0.1" value={form.interest_rate} disabled={!form.interest_enabled || !!form.plan_id} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t("interestEnabled")}</Label>
                <Switch checked={form.interest_enabled} onCheckedChange={v => setForm({ ...form, interest_enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("issuedOn")}</Label><Input type="date" value={form.issued_on} onChange={e => setForm({ ...form, issued_on: e.target.value })} /></div>
                <div><Label>{t("nextDue")}</Label><Input type="date" value={form.next_due_on} onChange={e => setForm({ ...form, next_due_on: e.target.value })} /></div>
              </div>
              {(() => {
                const total = form.interest_enabled ? form.principal * (1 + form.interest_rate / 100) : form.principal;
                const plan = plans.find(p => p.id === form.plan_id);
                let perLabel = ""; let perAmt = 0; let count = 0;
                if (plan) {
                  const months = plan.duration_months || 1;
                  if (plan.installment_type === "monthly") { count = months; perLabel = t("perMonth" as any) || "Per month"; }
                  else if (plan.installment_type === "weekly") { count = Math.round(months * 4.345); perLabel = t("perWeek" as any) || "Per week"; }
                  else if (plan.installment_type === "daily") { count = Math.round(months * 30); perLabel = t("perDay" as any) || "Per day"; }
                  perAmt = count > 0 ? total / count : 0;
                }
                return (
                  <div className="rounded-md bg-muted p-2 text-sm space-y-1">
                    <div>{t("totalPayable")}: <span className="font-bold">{money(total)}</span></div>
                    {plan && count > 0 && (
                      <div>{perLabel}: <span className="font-bold">{money(perAmt)}</span> <span className="text-xs text-muted-foreground">× {count} {t("installments" as any) || "installments"}</span></div>
                    )}
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground">All loans require committee approval before disbursement is recorded.</p>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Card className="p-3 mb-3 flex items-center gap-3">
        <Label className="text-sm flex items-center gap-2 cursor-pointer">
          <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
          Show archived
        </Label>
        {showDeleted && <span className="text-xs text-muted-foreground">Showing soft-deleted loans only.</span>}
      </Card>

      <Tabs defaultValue="approved">
        <TabsList>
          <TabsTrigger value="approved">Active / Paid</TabsTrigger>
          <TabsTrigger value="pending">{t("pending")} {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="rejected">{t("rejected")}</TabsTrigger>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
        </TabsList>
        {[
          { v: "approved", rows: approved },
          { v: "pending", rows: pending },
          { v: "rejected", rows: rejected },
          { v: "all", rows: loans },
        ].map(({ v, rows }) => (
          <TabsContent value={v} key={v}>
            <LoanTable
              rows={rows}
              t={t}
              isCommittee={isCommittee}
              isSuper={isSuper}
              showDeleted={showDeleted}
              onDecide={decide}
              onRestore={restore}
              onDelete={remove}
              onEdit={startEdit}
              onPrint={printLoanReceipt}
              profiles={profiles}
              expanded={expanded}
              setExpanded={(id: string | null) => { setExpanded(id); if (id) loadInstallments(id); }}
              installments={installments}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!editLoan} onOpenChange={(o) => !o && setEditLoan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("pgEditLoan")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("principal")}</Label><Input type="number" value={editForm.principal} onChange={e => setEditForm({ ...editForm, principal: +e.target.value })} /></div>
              <div><Label>{t("interestRate")}</Label><Input type="number" step="0.1" value={editForm.interest_rate} disabled={!editForm.interest_enabled} onChange={e => setEditForm({ ...editForm, interest_rate: +e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{t("interestEnabled")}</Label>
              <Switch checked={editForm.interest_enabled} onCheckedChange={v => setEditForm({ ...editForm, interest_enabled: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("issuedOn")}</Label><Input type="date" value={editForm.issued_on} onChange={e => setEditForm({ ...editForm, issued_on: e.target.value })} /></div>
              <div><Label>{t("nextDue")}</Label><Input type="date" value={editForm.next_due_on} onChange={e => setEditForm({ ...editForm, next_due_on: e.target.value })} /></div>
            </div>
            <div><Label>{t("note")}</Label><Input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} /></div>
            <div className="rounded-md bg-muted p-2 text-sm">{t("totalPayable")}: <span className="font-bold">{money(editForm.interest_enabled ? editForm.principal * (1 + editForm.interest_rate / 100) : editForm.principal)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoan(null)}>{t("cancel")}</Button>
            <Button onClick={saveEdit}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}

function LoanTable({ rows, t, isCommittee, isSuper, showDeleted, onDecide, onRestore, onDelete, onEdit, onPrint, profiles, expanded, setExpanded, installments }: any) {
  return (
    <Card className="overflow-x-auto"><Table>
      <TableHeader><TableRow>
        <TableHead className="w-8"></TableHead>
        <TableHead>{t("issuedOn")}</TableHead><TableHead>{t("farmerName")}</TableHead>
        <TableHead>{t("principal")}</TableHead><TableHead>{t("interestRate")}</TableHead>
        <TableHead>{t("totalPayable")}</TableHead><TableHead>{t("dueAmount")}</TableHead>
        <TableHead>{t("status")}</TableHead>
        <TableHead>{t("pgApprovedBy")}</TableHead>
        <TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((l: any) => {
          const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
          const due = Number(l.total_payable) - paid;
          const isOpen = expanded === l.id;
          const hasPayments = (l.loan_payments ?? []).length > 0;
          const hasSchedule = !!l.plan_id;
          const canExpand = hasPayments || hasSchedule;
          const sched = installments?.[l.id] ?? [];
          return (
            <Fragment key={l.id}>
              <TableRow>
                <TableCell>
                  {canExpand && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpanded(isOpen ? null : l.id)}>
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </Button>
                  )}
                </TableCell>
                <TableCell>{fmtDate(l.issued_on)}</TableCell>
                <TableCell className="max-w-[220px]"><TruncateText>{l.farmers?.name_en}</TruncateText> <span className="text-xs text-muted-foreground">({l.farmers?.farmer_code})</span></TableCell>
                <TableCell>{money(l.principal)}</TableCell>
                <TableCell>{l.interest_enabled ? `${l.interest_rate}%` : "-"}</TableCell>
                <TableCell>{money(l.total_payable)}</TableCell>
                <TableCell className={due > 0 && l.status === "approved" ? "due-text" : ""}>{money(due)}</TableCell>
                <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "paid" ? "secondary" : l.status === "pending" ? "outline" : "destructive"}>{t(l.status as any)}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.approved_by ? (
                    <>
                      <div className="font-medium text-foreground">{profiles?.[l.approved_by] ?? l.approved_by.slice(0, 6)}</div>
                      <div>{fmtDate(l.updated_at)}</div>
                    </>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {showDeleted && isCommittee && (
                    <Button size="sm" variant="outline" onClick={() => onRestore(l.id)} title={t("restore")}>{t("restore")}</Button>
                  )}
                  {!showDeleted && isCommittee && l.status === "pending" && (<>
                    <Button size="icon" variant="ghost" onClick={() => onDecide(l.id, "approved")} title={t("approve")}><Check className="h-4 w-4 text-success" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDecide(l.id, "rejected")} title={t("reject")}><X className="h-4 w-4 text-destructive" /></Button>
                  </>)}
                  {!showDeleted && (l.status === "approved" || l.status === "paid") && (
                    <Button size="icon" variant="ghost" onClick={() => onPrint(l)} title={t("printDisbursementReceipt")}><Printer className="h-4 w-4" /></Button>
                  )}
                  {!showDeleted && isSuper && (<>
                    <EditButton onClick={() => onEdit(l)} title={t("editTip")} />
                    <DeleteButton onClick={() => onDelete(l.id)} title={t("deleteTipShort")} />
                  </>)}
                </TableCell>
              </TableRow>
              {isOpen && canExpand && (
                <TableRow className="bg-muted/30">
                  <TableCell></TableCell>
                  <TableCell colSpan={9} className="py-2 space-y-4">
                    {hasSchedule && (
                      <div>
                        <div className="text-xs font-semibold mb-2 uppercase text-muted-foreground">
                          Installment Schedule {l.loan_plans ? `— ${l.loan_plans.name} (${l.loan_plans.installment_type})` : ""}
                        </div>
                        {sched.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No installments generated yet.</div>
                        ) : (
                          <div data-table-wrap className="w-full overflow-x-auto">
                            <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground"><tr><th className="text-left py-1">#</th><th className="text-left">{t("dueCol")}</th><th className="text-right">{t("amount")}</th><th className="text-right">{t("paidCol")}</th><th className="text-right">{t("penaltyCol")}</th><th>{t("status")}</th></tr></thead>
                            <tbody>
                              {sched.map((it: any) => (
                                <tr key={it.id} className="border-t">
                                  <td className="py-1">{it.installment_no}</td>
                                  <td>{fmtDate(it.due_date)}</td>
                                  <td className="text-right">{money(it.amount)}</td>
                                  <td className="text-right">{money(it.paid_amount)}</td>
                                  <td className="text-right">{money(it.penalty_amount)}</td>
                                  <td><Badge variant={it.status === "paid" ? "secondary" : it.status === "missed" ? "destructive" : it.status === "partial" ? "default" : "outline"}>{it.status}</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                    {hasPayments && (
                      <div>
                        <div className="text-xs font-semibold mb-2 uppercase text-muted-foreground">{t("repaymentsHeader")}</div>
                        <div data-table-wrap className="w-full overflow-x-auto">
                          <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground"><tr><th className="text-left py-1">{t("date")}</th><th className="text-right">{t("amount")}</th><th className="text-left pl-3">{t("collectedByCol")}</th><th className="text-right">{t("receiptColLabel")}</th></tr></thead>
                          <tbody>
                            {(l.loan_payments ?? []).slice().sort((a: any, b: any) => (b.paid_on ?? "").localeCompare(a.paid_on ?? "")).map((p: any) => (
                              <tr key={p.id} className="border-t">
                                <td className="py-1">{fmtDate(p.paid_on)}</td>
                                <td className="py-1 text-right text-success font-semibold">{money(p.amount)}</td>
                                <td className="py-1 pl-3">{p.collected_by ? (profiles?.[p.collected_by] ?? p.collected_by.slice(0, 6)) : "—"}</td>
                                <td className="py-1 text-right">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPrint(l, p)} title={t("printPaymentReceipt")}><Printer className="h-3.5 w-3.5" /></Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
        {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
      </TableBody>
    </Table></Card>
  );
}
