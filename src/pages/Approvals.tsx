import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, RefreshCw, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { logAudit } from "@/lib/audit";

type Table = "savings_transactions" | "loan_payments" | "loans" | "payments";

type DecisionTarget = {
  table: Table;
  id: string;
  status: "approved" | "rejected";
  label: string;
} | null;

type BulkDecision = {
  table: Table;
  ids: string[];
  status: "approved" | "rejected";
} | null;

export default function Approvals() {
  const { isCommittee } = useAuth();
  const { t } = useLang();

  // Filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState<string>("");

  // Data
  const [savings, setSavings] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection
  const [selSavings, setSelSavings] = useState<Set<string>>(new Set());
  const [selLoanPayments, setSelLoanPayments] = useState<Set<string>>(new Set());
  const [selLoans, setSelLoans] = useState<Set<string>>(new Set());
  const [selPayments, setSelPayments] = useState<Set<string>>(new Set());

  // Dialogs
  const [decision, setDecision] = useState<DecisionTarget>(null);
  const [bulk, setBulk] = useState<BulkDecision>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: lp }, { data: l }, { data: p }] = await Promise.all([
        supabase.from("savings_transactions").select("id,txn_date,amount,type,status,note,farmer_id,farmers(name_en,farmer_code,member_no)")
          .is("deleted_at", null).eq("type", "withdraw").eq("status", "pending").order("txn_date", { ascending: false }).limit(500),
        supabase.from("loan_payments").select("id,paid_on,amount,status,loan_id,loans(farmer_id,farmers(name_en,farmer_code,member_no))")
          .eq("status", "pending").order("paid_on", { ascending: false }).limit(500),
        supabase.from("loans").select("id,issued_on,principal,total_payable,status,note,farmer_id,farmers(name_en,farmer_code,member_no)")
          .is("deleted_at", null).eq("status", "pending").order("issued_on", { ascending: false }).limit(500),
        supabase.from("payments").select("id,created_at,amount,status,kind,receipt_no,note,farmer_id,farmers(name_en,farmer_code,member_no)")
          .is("deleted_at", null).eq("status", "pending").order("created_at", { ascending: false }).limit(500),
      ]);
      setSavings((s as any[]) || []);
      setLoanPayments((lp as any[]) || []);
      setLoans((l as any[]) || []);
      setPayments((p as any[]) || []);
      setSelSavings(new Set()); setSelLoanPayments(new Set()); setSelLoans(new Set()); setSelPayments(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  // Filters
  const minAmt = Number(minAmount) || 0;
  const matchesFarmer = (f: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [f?.name_en, f?.farmer_code, f?.member_no].filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  };
  const inDate = (d: string) => {
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const fSavings = useMemo(() => savings.filter(r => matchesFarmer(r.farmers) && inDate(r.txn_date) && Number(r.amount) >= minAmt), [savings, search, from, to, minAmt]);
  const fLoanPayments = useMemo(() => loanPayments.filter(r => matchesFarmer(r.loans?.farmers) && inDate(r.paid_on) && Number(r.amount) >= minAmt), [loanPayments, search, from, to, minAmt]);
  const fLoans = useMemo(() => loans.filter(r => matchesFarmer(r.farmers) && inDate(r.issued_on) && Number(r.principal) >= minAmt), [loans, search, from, to, minAmt]);
  const fPayments = useMemo(() => payments.filter(r => matchesFarmer(r.farmers) && inDate((r.created_at || "").slice(0, 10)) && Number(r.amount) >= minAmt), [payments, search, from, to, minAmt]);

  const totalPending = fSavings.length + fLoanPayments.length + fLoans.length + fPayments.length;

  // Helpers
  const labelWithdrawal = (amount: number, name?: string) =>
    t("withdrawalLabel").replace("{amount}", money(amount)).replace("{name}", name ?? "");
  const labelLoan = (amount: number, name?: string) =>
    t("loanLabel").replace("{amount}", money(amount)).replace("{name}", name ?? "");
  const labelPayment = (amount: number) =>
    t("paymentLabel").replace("{amount}", money(amount));

  const askDecision = (table: Table, id: string, status: "approved" | "rejected", label: string) => {
    setComment(""); setDecision({ table, id, status, label });
  };

  const confirmDecision = async () => {
    if (!decision) return;
    if (decision.status === "rejected" && !comment.trim()) {
      return toast.error(t("rejectionReasonRequired"));
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const patch: any = { status: decision.status, approved_by: u.user?.id };
      if (decision.table === "savings_transactions" || decision.table === "payments") {
        if (comment.trim()) patch.note = comment.trim();
      } else {
        if (comment.trim()) patch.approval_note = comment.trim();
      }
      patch.approved_at = new Date().toISOString();
      const { error } = await supabase.from(decision.table).update(patch).eq("id", decision.id);
      if (error) throw error;
      await logAudit({
        module: "other",
        action_type: decision.status === "approved" ? "approve" : "reject",
        reference_id: decision.id,
        new_data: { table: decision.table, status: decision.status, note: comment.trim() || null },
      });
      const statusLabel = decision.status === "approved" ? t("approved") : t("rejected");
      toast.success(t("markedAs").replace("{status}", statusLabel));
      setDecision(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const confirmBulk = async () => {
    if (!bulk) return;
    if (bulk.status === "rejected" && !comment.trim()) {
      return toast.error(t("rejectionReasonRequired"));
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const patch: any = { status: bulk.status, approved_by: u.user?.id, approved_at: new Date().toISOString() };
      if (comment.trim()) {
        if (bulk.table === "savings_transactions" || bulk.table === "payments") patch.note = comment.trim();
        else patch.approval_note = comment.trim();
      }
      const { error } = await supabase.from(bulk.table).update(patch).in("id", bulk.ids);
      if (error) throw error;
      toast.success(`${bulk.ids.length} ${bulk.status === "approved" ? t("approved") : t("rejected")}`);
      setBulk(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  if (!isCommittee) {
    return (
      <div className="container mx-auto p-4">
        <PageHeader title={t("approvals")} />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{t("onlyCommitteeApprove")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Selection helpers
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };
  const toggleAll = (rows: any[], setter: (s: Set<string>) => void, current: Set<string>) => {
    if (current.size === rows.length) setter(new Set());
    else setter(new Set(rows.map(r => r.id)));
  };

  const SelBar = ({ count, onApprove, onReject }: { count: number; onApprove: () => void; onReject: () => void }) =>
    count > 0 ? (
      <div className="flex items-center justify-between rounded border bg-muted/30 p-2 mb-2">
        <div className="text-sm">{count} {(t as any)("selected") || "selected"}</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onApprove}><CheckCheck className="h-4 w-4 mr-1" />{t("approve")} ({count})</Button>
          <Button size="sm" variant="outline" onClick={onReject}>{t("reject")} ({count})</Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("approvals")}
        description={`${t("approvalsDesc")} — ${totalPending} ${t("pending") || "pending"}`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>{t("from")}</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>{t("to")}</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("farmerName")}</Label>
              <Input placeholder="name / code / member no" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div>
              <Label>Min Amount</Label>
              <Input type="number" min={0} value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="col-span-2 md:col-span-5 flex justify-end">
              <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("refresh") || "Refresh"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">
            {(t as any)("paymentsLabel") || "Payments"} <Badge variant="secondary" className="ml-1">{fPayments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="savings">
            {t("savingsWithdrawals")} <Badge variant="secondary" className="ml-1">{fSavings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="loans">
            {t("loanDisbursements")} <Badge variant="secondary" className="ml-1">{fLoans.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="loanPayments">
            {t("loanPayments")} <Badge variant="secondary" className="ml-1">{fLoanPayments.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Payments (Irrigation / PAY / COMBO) */}
        <TabsContent value="payments">
          <SelBar
            count={selPayments.size}
            onApprove={() => { setComment(""); setBulk({ table: "payments", ids: [...selPayments], status: "approved" }); }}
            onReject={() => { setComment(""); setBulk({ table: "payments", ids: [...selPayments], status: "rejected" }); }}
          />
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={fPayments.length > 0 && selPayments.size === fPayments.length}
                    onCheckedChange={() => toggleAll(fPayments, setSelPayments, selPayments)}
                  />
                </TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fPayments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox checked={selPayments.has(r.id)} onCheckedChange={() => toggle(selPayments, setSelPayments, r.id)} />
                    </TableCell>
                    <TableCell>{fmtDate((r.created_at || "").slice(0, 10))}</TableCell>
                    <TableCell className="font-mono text-xs">{r.receipt_no ?? "—"}</TableCell>
                    <TableCell>{(r.farmers?.member_no || r.farmers?.farmer_code) ?? "—"} — {r.farmers?.name_en}</TableCell>
                    <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => askDecision("payments", r.id, "approved", labelPayment(r.amount))}>{t("approve")}</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("payments", r.id, "rejected", labelPayment(r.amount))}>{t("reject")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!fPayments.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noPendingPayments")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Savings withdrawals */}
        <TabsContent value="savings">
          <SelBar
            count={selSavings.size}
            onApprove={() => { setComment(""); setBulk({ table: "savings_transactions", ids: [...selSavings], status: "approved" }); }}
            onReject={() => { setComment(""); setBulk({ table: "savings_transactions", ids: [...selSavings], status: "rejected" }); }}
          />
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={fSavings.length > 0 && selSavings.size === fSavings.length} onCheckedChange={() => toggleAll(fSavings, setSelSavings, selSavings)} />
                </TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fSavings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selSavings.has(r.id)} onCheckedChange={() => toggle(selSavings, setSelSavings, r.id)} /></TableCell>
                    <TableCell>{fmtDate(r.txn_date)}</TableCell>
                    <TableCell>{(r.farmers?.member_no || r.farmers?.farmer_code) ?? "—"} — {r.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => askDecision("savings_transactions", r.id, "approved", labelWithdrawal(r.amount, r.farmers?.name_en))}>{t("approve")}</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("savings_transactions", r.id, "rejected", labelWithdrawal(r.amount, r.farmers?.name_en))}>{t("reject")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!fSavings.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noPendingWithdrawals")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Loan disbursements */}
        <TabsContent value="loans">
          <SelBar
            count={selLoans.size}
            onApprove={() => { setComment(""); setBulk({ table: "loans", ids: [...selLoans], status: "approved" }); }}
            onReject={() => { setComment(""); setBulk({ table: "loans", ids: [...selLoans], status: "rejected" }); }}
          />
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={fLoans.length > 0 && selLoans.size === fLoans.length} onCheckedChange={() => toggleAll(fLoans, setSelLoans, selLoans)} />
                </TableHead>
                <TableHead>{t("issued")}</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead className="text-right">{t("principal")}</TableHead>
                <TableHead className="text-right">{t("totalPayable")}</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fLoans.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selLoans.has(r.id)} onCheckedChange={() => toggle(selLoans, setSelLoans, r.id)} /></TableCell>
                    <TableCell>{fmtDate(r.issued_on)}</TableCell>
                    <TableCell>{(r.farmers?.member_no || r.farmers?.farmer_code) ?? "—"} — {r.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.principal)}</TableCell>
                    <TableCell className="text-right">{money(r.total_payable)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => askDecision("loans", r.id, "approved", labelLoan(r.principal, r.farmers?.name_en))}>{t("approve")}</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("loans", r.id, "rejected", labelLoan(r.principal, r.farmers?.name_en))}>{t("reject")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!fLoans.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noPendingLoans")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Loan repayments */}
        <TabsContent value="loanPayments">
          <SelBar
            count={selLoanPayments.size}
            onApprove={() => { setComment(""); setBulk({ table: "loan_payments", ids: [...selLoanPayments], status: "approved" }); }}
            onReject={() => { setComment(""); setBulk({ table: "loan_payments", ids: [...selLoanPayments], status: "rejected" }); }}
          />
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={fLoanPayments.length > 0 && selLoanPayments.size === fLoanPayments.length} onCheckedChange={() => toggleAll(fLoanPayments, setSelLoanPayments, selLoanPayments)} />
                </TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fLoanPayments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selLoanPayments.has(r.id)} onCheckedChange={() => toggle(selLoanPayments, setSelLoanPayments, r.id)} /></TableCell>
                    <TableCell>{fmtDate(r.paid_on)}</TableCell>
                    <TableCell>{(r.loans?.farmers?.member_no || r.loans?.farmers?.farmer_code) ?? "—"} — {r.loans?.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => askDecision("loan_payments", r.id, "approved", labelPayment(r.amount))}>{t("approve")}</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("loan_payments", r.id, "rejected", labelPayment(r.amount))}>{t("reject")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!fLoanPayments.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noPendingPayments")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Single decision dialog */}
      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(decision?.status === "approved" ? t("approve") : t("reject"))} — {decision?.label}
            </DialogTitle>
            <DialogDescription>{t("decisionAuditNote")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("comment")} {decision?.status === "rejected" && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={decision?.status === "rejected" ? t("rejectionReasonPh") : t("optionalAuditNotePh")}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>{t("cancel")}</Button>
            <Button variant={decision?.status === "rejected" ? "destructive" : "default"} onClick={confirmDecision} disabled={busy}>
              {t("confirm")} {decision?.status === "approved" ? t("approve") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk decision dialog */}
      <Dialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(bulk?.status === "approved" ? t("approve") : t("reject"))} {bulk?.ids.length} items
            </DialogTitle>
            <DialogDescription>{t("decisionAuditNote")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("comment")} {bulk?.status === "rejected" && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={bulk?.status === "rejected" ? t("rejectionReasonPh") : t("optionalAuditNotePh")}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulk(null)} disabled={busy}>{t("cancel")}</Button>
            <Button variant={bulk?.status === "rejected" ? "destructive" : "default"} onClick={confirmBulk} disabled={busy}>
              {t("confirm")} {bulk?.status === "approved" ? t("approve") : t("reject")} ({bulk?.ids.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
