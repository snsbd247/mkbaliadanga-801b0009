import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect, type FarmerLite } from "@/components/farmers/FarmerSearchSelect";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { money } from "@/lib/format";
import { guardSavingsLoan } from "@/lib/memberEligibility";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isLumpSum, lumpSumSchedule, validateLumpSumInterest } from "@/lib/lumpSumLoan";

const EMPTY = {
  farmer_id: "", plan_id: "", principal: 0, interest_rate: 9,
  interest_enabled: true, issued_on: new Date().toISOString().slice(0, 10), note: "",
};

type Party = { name: string; father_name: string; village: string; mobile: string; nid: string };
const emptyParty = (): Party => ({ name: "", father_name: "", village: "", mobile: "", nid: "" });

export default function LoanForm() {
  const { tx } = useLang();
  const { user, officeId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [, setFarmer] = useState<FarmerLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [errors, setErrors] = useState<{ farmer_id?: string; principal?: string; interest_rate?: string; issued_on?: string }>({});
  const [guarantors, setGuarantors] = useState<Party[]>([]);
  const [nominees, setNominees] = useState<Party[]>([]);

  useEffect(() => {
    document.title = `${isEdit ? tx("Edit Loan", "ঋণ এডিট") : tx("Issue Loan", "ঋণ ইস্যু")} — MK Baliadanga`;
    (async () => {
      const { data: p } = await supabase.from("loan_plans").select("*").eq("is_active", true).order("name");
      setPlans(p ?? []);
      if (isEdit) {
        const { data: l } = await supabase.from("loans").select("*").eq("id", id).maybeSingle();
        if (l) {
          setForm({
            farmer_id: l.farmer_id ?? "", plan_id: l.plan_id ?? "", principal: Number(l.principal ?? 0),
            interest_rate: Number(l.interest_rate ?? 9), interest_enabled: !!l.interest_enabled,
            issued_on: (l.issued_on ?? new Date().toISOString()).slice(0, 10), note: l.note ?? "",
          });
          setStatus(l.status ?? "pending");
        }
        const { data: parties } = await supabase.from("loan_guarantors").select("*").eq("loan_id", id);
        const toParty = (r: any): Party => ({ name: r.name ?? "", father_name: r.father_name ?? "", village: r.village ?? "", mobile: r.mobile ?? "", nid: r.nid ?? "" });
        setGuarantors((parties ?? []).filter((r: any) => (r.role ?? "guarantor") === "guarantor").map(toParty));
        setNominees((parties ?? []).filter((r: any) => r.role === "nominee").map(toParty));
      }
    })();
  }, [id]);


  const selectedPlan = useMemo(() => plans.find(p => p.id === form.plan_id) || null, [plans, form.plan_id]);
  const lumpSum = isLumpSum(selectedPlan?.installment_type);

  const totalPayable = useMemo(() => {
    const pr = Number(form.principal || 0);
    return form.interest_enabled ? Math.round(pr * (1 + Number(form.interest_rate || 0) / 100)) : pr;
  }, [form.principal, form.interest_rate, form.interest_enabled]);

  const schedule = useMemo(() => {
    if (!lumpSum || !(Number(form.principal) > 0)) return [];
    return lumpSumSchedule({
      principal: Number(form.principal),
      interestRate: form.interest_enabled ? Number(form.interest_rate || 0) : 0,
      durationMonths: Number(selectedPlan?.duration_months || 0),
      issuedOn: form.issued_on,
    });
  }, [lumpSum, form.principal, form.interest_rate, form.interest_enabled, form.issued_on, selectedPlan]);

  function pickPlan(id: string) {
    const pl = plans.find(p => p.id === id);
    setForm(f => ({ ...f, plan_id: id, interest_rate: pl ? Number(pl.interest_rate ?? f.interest_rate) : f.interest_rate }));
  }

  async function save() {
    const errs: { farmer_id?: string; principal?: string; interest_rate?: string; issued_on?: string } = {};
    if (!form.farmer_id) errs.farmer_id = tx("Select a farmer", "ফার্মার নির্বাচন করুন");
    const pr = Number(form.principal);
    if (!(pr > 0)) errs.principal = tx("Principal must be greater than 0", "আসল টাকা ০ এর বেশি হতে হবে");
    else if (pr > 100000000) errs.principal = tx("Principal is too large", "আসল টাকা অত্যধিক বড়");
    if (form.interest_enabled) {
      const iv = validateLumpSumInterest(form.interest_rate, tx);
      if (!iv.ok) errs.interest_rate = iv.error;
    }
    if (!form.issued_on) errs.issued_on = tx("Issue date is required", "ইস্যু তারিখ আবশ্যক");
    else if (form.issued_on > new Date().toISOString().slice(0, 10)) errs.issued_on = tx("Issue date cannot be in the future", "ইস্যু তারিখ ভবিষ্যতের হতে পারে না");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const elig = await guardSavingsLoan(form.farmer_id, "loan", tx);
    if (!elig.ok) { setErrors({ farmer_id: elig.reason }); return; }
    const { data: mchk } = await supabase.from("farmers").select("is_voter,savings_inactive,name_en").eq("id", form.farmer_id).maybeSingle();
    setSaving(true);
    try {
      const payload = {
        farmer_id: form.farmer_id,
        plan_id: form.plan_id || null,
        principal: Number(form.principal),
        interest_enabled: form.interest_enabled,
        interest_rate: form.interest_enabled ? Number(form.interest_rate) : 0,
        total_payable: totalPayable,
        issued_on: form.issued_on,
        note: form.note || null,
      };
      const buildRows = (loanId: string) => {
        const mk = (p: Party, role: string) => ({
          loan_id: loanId, role, name: p.name.trim(),
          father_name: p.father_name.trim() || null, village: p.village.trim() || null,
          mobile: p.mobile.trim() || null, nid: p.nid.trim() || null, office_id: officeId ?? null,
        });
        return [
          ...guarantors.filter(p => p.name.trim()).map(p => mk(p, "guarantor")),
          ...nominees.filter(p => p.name.trim()).map(p => mk(p, "nominee")),
        ];
      };
      if (isEdit) {
        const { error } = await supabase.from("loans").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("loan_guarantors").delete().eq("loan_id", id);
        const rows = buildRows(id!);
        if (rows.length) {
          const { error: gErr } = await supabase.from("loan_guarantors").insert(rows);
          if (gErr) throw gErr;
        }
        toast.success(tx("Loan updated", "ঋণ আপডেট হয়েছে"));
      } else {
        const { data: ins, error } = await supabase.from("loans").insert({
          ...payload, status: "pending", office_id: officeId ?? null, created_by: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        const rows = buildRows(ins.id);
        if (rows.length) {
          const { error: gErr } = await supabase.from("loan_guarantors").insert(rows);
          if (gErr) throw gErr;
        }
        await supabase.from("notifications").insert({
          kind: "loan_pending",
          title: tx("Loan approval pending", "ঋণ অনুমোদন অপেক্ষমাণ"),
          body: `${mchk?.name_en ?? ""} — ৳${Number(form.principal).toLocaleString()}`,
          link: "/loans",
        });
        toast.success(tx("Loan issued — pending approval", "ঋণ ইস্যু হয়েছে — অনুমোদনের অপেক্ষায়"));
      }
      navigate("/loans");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setSaving(false); }
  }

  function renderParty(
    title: string,
    list: Party[],
    setList: React.Dispatch<React.SetStateAction<Party[]>>,
  ) {
    const upd = (i: number, key: keyof Party, v: string) =>
      setList(arr => arr.map((p, idx) => (idx === i ? { ...p, [key]: v } : p)));
    return (
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{title}</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setList(arr => [...arr, emptyParty()])}>
            <Plus className="h-4 w-4 mr-1" />{tx("Add", "যোগ করুন")}
          </Button>
        </div>
        {list.length === 0 && <p className="text-xs text-muted-foreground">{tx("None added", "কেউ যোগ করা হয়নি")}</p>}
        {list.map((p, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md bg-muted/40 p-2">
            <Input placeholder={tx("Name", "নাম")} value={p.name} onChange={e => upd(i, "name", e.target.value)} />
            <Input placeholder={tx("Father's name", "পিতার নাম")} value={p.father_name} onChange={e => upd(i, "father_name", e.target.value)} />
            <Input placeholder={tx("Village", "গ্রাম")} value={p.village} onChange={e => upd(i, "village", e.target.value)} />
            <Input placeholder={tx("Mobile", "মোবাইল")} value={p.mobile} onChange={e => upd(i, "mobile", e.target.value)} />
            <Input placeholder={tx("NID", "এনআইডি")} value={p.nid} onChange={e => upd(i, "nid", e.target.value)} />
            <Button type="button" variant="ghost" size="sm" className="text-destructive justify-self-start"
              onClick={() => setList(arr => arr.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 mr-1" />{tx("Remove", "মুছুন")}
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? tx("Edit Loan", "ঋণ এডিট") : tx("Issue Loan", "ঋণ ইস্যু")}
        description={isEdit ? `${tx("Status", "অবস্থা")}: ${status}` : tx("Issue a new member loan", "নতুন সদস্য ঋণ ইস্যু")}
        actions={<Button variant="outline" size="sm" onClick={() => navigate("/loans")}><ArrowLeft className="h-4 w-4 mr-1" />{tx("Back", "ফিরে")}</Button>}
      />
      <Card className="p-4 max-w-2xl">
        <div className="grid gap-3">
          <div>
            <Label>{tx("Member", "সদস্য")} *</Label>
            <FarmerSearchSelect value={form.farmer_id} votersOnly blockInactive
              onChange={(id, f) => { setForm({ ...form, farmer_id: id ?? "" }); setFarmer(f); setErrors(e => ({ ...e, farmer_id: undefined })); }} />
            {errors.farmer_id && <p className="text-sm text-destructive mt-1">{errors.farmer_id}</p>}
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
            <div><Label>{tx("Principal (৳)", "আসল (৳)")} *</Label><Input type="number" min={0} value={form.principal} onChange={e => { setForm({ ...form, principal: +e.target.value }); setErrors(er => ({ ...er, principal: undefined })); }} aria-invalid={!!errors.principal} />{errors.principal && <p className="text-sm text-destructive mt-1">{errors.principal}</p>}</div>
            <div><Label>{tx("Interest Rate (%)", "সুদের হার (%)")}</Label><Input type="number" min={0} step="0.01" disabled={!form.interest_enabled} value={form.interest_rate} onChange={e => { setForm({ ...form, interest_rate: +e.target.value }); setErrors(er => ({ ...er, interest_rate: undefined })); }} aria-invalid={!!errors.interest_rate} />{errors.interest_rate && <p className="text-sm text-destructive mt-1">{errors.interest_rate}</p>}</div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>{tx("Interest Enabled", "সুদ সক্রিয়")}</Label>
            <Switch checked={form.interest_enabled} onCheckedChange={v => setForm({ ...form, interest_enabled: v })} />
          </div>
          <div><Label>{tx("Issued On", "ইস্যু তারিখ")}</Label><Input type="date" value={form.issued_on} onChange={e => { setForm({ ...form, issued_on: e.target.value }); setErrors(er => ({ ...er, issued_on: undefined })); }} aria-invalid={!!errors.issued_on} />{errors.issued_on && <p className="text-sm text-destructive mt-1">{errors.issued_on}</p>}</div>
          <div><Label>{tx("Note", "নোট")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          {lumpSum && schedule.length > 0 && (
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium mb-2">{tx("Repayment Schedule (lump sum at end of term)", "পরিশোধ সূচি (মেয়াদ শেষে একবারে)")}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Due Date", "নির্ধারিত তারিখ")}</TableHead>
                    <TableHead className="text-right">{tx("Principal Due", "আসল")}</TableHead>
                    <TableHead className="text-right">{tx("Interest Due", "লাভ")}</TableHead>
                    <TableHead className="text-right">{tx("Total Due", "মোট")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map(r => (
                    <TableRow key={r.seq}>
                      <TableCell>{r.dueDate}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.principalDue)}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.interestDue)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{money(r.totalDue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="rounded-md bg-muted p-3 text-sm flex justify-between"><span>{tx("Total Payable", "মোট পরিশোধযোগ্য")}</span><span className="font-mono font-bold">{money(totalPayable)}</span></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/loans")} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : isEdit ? tx("Save", "সংরক্ষণ") : tx("Issue", "ইস্যু")}</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
