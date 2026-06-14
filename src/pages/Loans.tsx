import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FarmerSearchSelect, type FarmerLite } from "@/components/farmers/FarmerSearchSelect";
import { LoanStatement } from "@/components/LoanStatement";
import { Plus, Check, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermission";
import { money, fmtDate } from "@/lib/format";

const EMPTY = {
  farmer_id: "", plan_id: "", principal: 0, interest_rate: 9,
  interest_enabled: true, issued_on: new Date().toISOString().slice(0, 10), note: "",
};

export default function Loans() {
  const { tx, lang } = useLang();
  const { user, officeId } = useAuth();
  const canApprove = usePermission("loans", "can_edit");
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [farmer, setFarmer] = useState<FarmerLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("pending");
  const [stmt, setStmt] = useState<any | null>(null);

  useEffect(() => { document.title = `${tx("Loans", "ঋণ")} — MK Baliadanga`; load(); }, []);

  async function load() {
    const [l, p] = await Promise.all([
      supabase.from("loans").select("*, farmers(name_en,name_bn,farmer_code,member_no), loan_plans(name,name_bn), loan_payments(amount,principal_amount)").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("loan_plans").select("*").eq("is_active", true).order("name"),
    ]);
    setRows(l.data ?? []);
    setPlans(p.data ?? []);
  }

  const selectedPlan = useMemo(() => plans.find(p => p.id === form.plan_id), [plans, form.plan_id]);
  const totalPayable = useMemo(() => {
    const pr = Number(form.principal || 0);
    return form.interest_enabled ? Math.round(pr * (1 + Number(form.interest_rate || 0) / 100)) : pr;
  }, [form.principal, form.interest_rate, form.interest_enabled]);

  function openNew() { setForm({ ...EMPTY }); setFarmer(null); setOpen(true); }

  function pickPlan(id: string) {
    const pl = plans.find(p => p.id === id);
    setForm(f => ({ ...f, plan_id: id, interest_rate: pl ? Number(pl.interest_rate ?? f.interest_rate) : f.interest_rate }));
  }

  async function save() {
    if (!form.farmer_id) return toast.error(tx("Select a farmer", "ফার্মার নির্বাচন করুন"));
    if (!(Number(form.principal) > 0)) return toast.error(tx("Principal must be greater than 0", "আসল টাকা ০ এর বেশি হতে হবে"));
    // Loans are only for savings members, and inactive members cannot transact.
    const { data: mchk } = await supabase.from("farmers").select("is_voter,savings_inactive,name_en").eq("id", form.farmer_id).maybeSingle();
    if (!mchk?.is_voter) return toast.error(tx("Loans are only allowed for savings members", "শুধু সঞ্চয় সদস্যকে ঋণ দেওয়া যাবে"));
    if (mchk?.savings_inactive) return toast.error(`${mchk?.name_en ?? tx("This member", "এই সদস্য")} ${tx("is inactive — loans cannot be issued.", "ইনঅ্যাক্টিভ — ঋণ ইস্যু করা যাবে না।")}`);
    setSaving(true);
    try {
      const { error } = await supabase.from("loans").insert({
        farmer_id: form.farmer_id,
        plan_id: form.plan_id || null,
        principal: Number(form.principal),
        interest_enabled: form.interest_enabled,
        interest_rate: form.interest_enabled ? Number(form.interest_rate) : 0,
        total_payable: totalPayable,
        issued_on: form.issued_on,
        note: form.note || null,
        status: "pending",
        office_id: officeId ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        kind: "loan_pending",
        title: tx("Loan approval pending", "ঋণ অনুমোদন অপেক্ষমাণ"),
        body: `${mchk?.name_en ?? ""} — ৳${Number(form.principal).toLocaleString()}`,
        link: "/loans",
      });
      toast.success(tx("Loan issued — pending approval", "ঋণ ইস্যু হয়েছে — অনুমোদনের অপেক্ষায়"));
      setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setSaving(false); }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    const patch: any = { status };
    if (status === "approved") { patch.approved_by = user?.id ?? null; }
    const { error } = await supabase.from("loans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    const ln = rows.find((r: any) => r.id === id);
    if (ln?.created_by) {
      await supabase.from("notifications").insert({
        user_id: ln.created_by,
        kind: status === "approved" ? "loan_approved" : "loan_rejected",
        title: status === "approved" ? tx("Loan approved", "ঋণ অনুমোদিত") : tx("Loan rejected", "ঋণ বাতিল"),
        body: `${ln?.farmers?.name_en ?? ln?.farmer_name ?? ""} — ৳${Number(ln?.principal ?? 0).toLocaleString()}`,
        link: "/loans",
      });
    }
    toast.success(status === "approved" ? tx("Approved", "অনুমোদিত") : tx("Rejected", "বাতিল"));
    load();
  }


  const filtered = rows.filter(r => tab === "all" ? true : tab === "pending" ? r.status === "pending" : r.status === "approved");

  function paidPrincipal(r: any) {
    return (r.loan_payments ?? []).reduce((s: number, p: any) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
  }

  return (
    <>
      <PageHeader
        title={tx("Loans", "ঋণ")}
        description={tx("Issue and manage member loans", "সদস্যদের ঋণ ইস্যু ও পরিচালনা")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />{tx("Issue Loan", "ঋণ ইস্যু")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tx("Issue Loan", "ঋণ ইস্যু")}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>{tx("Member", "সদস্য")} *</Label>
                  <FarmerSearchSelect value={form.farmer_id} votersOnly
                    onChange={(id, f) => { setForm({ ...form, farmer_id: id ?? "" }); setFarmer(f); }} />
                </div>
                <div>
                  <Label>{tx("Loan Plan", "ঋণ প্ল্যান")}</Label>
                  <Select value={form.plan_id || "none"} onValueChange={(v) => pickPlan(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={tx("Select", "নির্বাচন")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx("— None —", "— নেই —")}</SelectItem>
                      {plans.map(p => <SelectItem key={p.id} value={p.id}>{(p.name_bn || p.name)} — {Number(p.interest_rate)}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{tx("Principal (৳)", "আসল (৳)")} *</Label><Input type="number" min={0} value={form.principal} onChange={e => setForm({ ...form, principal: +e.target.value })} /></div>
                  <div><Label>{tx("Interest Rate (%)", "সুদের হার (%)")}</Label><Input type="number" min={0} step="0.01" disabled={!form.interest_enabled} value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>{tx("Interest Enabled", "সুদ সক্রিয়")}</Label>
                  <Switch checked={form.interest_enabled} onCheckedChange={v => setForm({ ...form, interest_enabled: v })} />
                </div>
                <div><Label>{tx("Issued On", "ইস্যু তারিখ")}</Label><Input type="date" value={form.issued_on} onChange={e => setForm({ ...form, issued_on: e.target.value })} /></div>
                <div><Label>{tx("Note", "নোট")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                <div className="rounded-md bg-muted p-3 text-sm flex justify-between"><span>{tx("Total Payable", "মোট পরিশোধযোগ্য")}</span><span className="font-mono font-bold">{money(totalPayable)}</span></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Issue", "ইস্যু")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">{tx("Pending", "অপেক্ষমাণ")}</TabsTrigger>
          <TabsTrigger value="approved">{tx("Approved", "অনুমোদিত")}</TabsTrigger>
          <TabsTrigger value="all">{tx("All", "সব")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Member", "সদস্য")}</TableHead>
                <TableHead>{tx("Issued", "ইস্যু")}</TableHead>
                <TableHead className="text-right">{tx("Principal", "আসল")}</TableHead>
                <TableHead className="text-right">{tx("Principal Due", "আসল বাকি")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                <TableHead className="text-right">{tx("Actions", "কার্যক্রম")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const due = Math.max(0, Number(r.principal ?? 0) - paidPrincipal(r));
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/farmers/${r.farmer_id}`} className="text-primary hover:underline">
                          {lang === "bn" ? (r.farmers?.name_bn || r.farmers?.name_en) : r.farmers?.name_en}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.farmers?.member_no || r.farmers?.farmer_code}</div>
                      </TableCell>
                      <TableCell>{fmtDate(r.issued_on)}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.principal)}</TableCell>
                      <TableCell className="text-right font-mono">{money(due)}</TableCell>
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => setStmt(r)}><FileText className="h-4 w-4 mr-1" />{tx("Statement", "স্টেটমেন্ট")}</Button>
                        )}
                        {r.status === "pending" && canApprove && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => decide(r.id, "approved")}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => decide(r.id, "rejected")}><X className="h-4 w-4" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No loans", "কোনো ঋণ নেই")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!stmt} onOpenChange={(o) => { if (!o) setStmt(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tx("Loan Statement", "ঋণ স্টেটমেন্ট")} — {lang === "bn" ? (stmt?.farmers?.name_bn || stmt?.farmers?.name_en) : stmt?.farmers?.name_en}</DialogTitle></DialogHeader>
          {stmt && <LoanStatement loanId={stmt.id} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
