import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Paperclip, Check, X, FileText, Plus, Trash2, Printer, ArrowDownToLine } from "lucide-react";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { TruncateText } from "@/components/ui/truncate-text";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { downloadBnReceiptPdf, type ReceiptCopy } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { ReceiptSettingsButton } from "@/components/receipts/ReceiptSettingsButton";
import { DuplicateReceiptWarning } from "@/components/receipts/DuplicateReceiptWarning";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IrrigationPaymentPanel } from "@/components/payments/IrrigationPaymentPanel";

type Allocation = { kind: "loan" | "savings" | "irrigation"; reference_id: string; amount: number };

const newKey = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function Payments() {
  const { t, tx } = useLang();
  const { user, officeId } = useAuth();
  const [params] = useSearchParams();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState(params.get("farmer") ?? "");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [allocs, setAllocs] = useState<Allocation[]>([{ kind: "irrigation", reference_id: "", amount: 0 }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [openLoans, setOpenLoans] = useState<any[]>([]);
  const [openIrr, setOpenIrr] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState<string>(newKey());
  const [priority, setPriority] = useState<string[]>(["irrigation", "loan", "savings"]);
  const [previewSerial, setPreviewSerial] = useState<string>("");
  const [autoAmount, setAutoAmount] = useState<number>(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: 0, note: "" });
  const [savingsBalance, setSavingsBalance] = useState<number>(0);

  async function loadSavingsBalance(fid: string) {
    const { data } = await supabase
      .from("savings_transactions")
      .select("type,amount,status")
      .eq("farmer_id", fid)
      .eq("status", "approved")
      .is("deleted_at", null);
    const bal = (data ?? []).reduce((s: number, r: any) => {
      const a = Number(r.amount) || 0;
      if (r.type === "withdraw") return s - a;
      if (r.type === "share_deposit" || r.type === "share_collection") return s;
      return s + a;
    }, 0);
    setSavingsBalance(bal);
  }

  async function submitWithdraw() {
    if (!farmerId) return toast.error(t("pickFarmer"));
    if (!(withdrawForm.amount > 0)) return toast.error(t("amountMustBePositiveSavings"));
    if (withdrawForm.amount > savingsBalance) return toast.error(`${tx("Insufficient balance. Available", "যথেষ্ট ব্যালেন্স নেই। উপলব্ধ")}: ৳${savingsBalance.toLocaleString()}`);
    const farmer = farmers.find((x: any) => x.id === farmerId);
    const { error } = await supabase.from("savings_transactions").insert({
      farmer_id: farmerId, type: "withdraw" as any, amount: withdrawForm.amount,
      note: withdrawForm.note, status: "pending" as any, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      kind: "withdrawal_pending",
      title: t("withdrawalRequestTitle"),
      body: t("withdrawalRequestedBody").replace("{name}", farmer?.name_en ?? "").replace("{amount}", String(withdrawForm.amount)),
      link: "/savings",
    });
    toast.success(t("pgSavWithdrawSubmitted" as any));
    setWithdrawOpen(false);
    setWithdrawForm({ amount: 0, note: "" });
    load();
  }

  useEffect(() => { document.title = `${t("payments")} — ${t("appName")}`; load(); checkRole(); loadPriority(); }, []);
  useEffect(() => { load(); /* refresh on toggle */ }, [showDeleted]);
  useEffect(() => { if (farmerId) { loadDues(); loadSavingsBalance(farmerId); } else { setOpenLoans([]); setOpenIrr([]); setSavingsBalance(0); } }, [farmerId]);
  useEffect(() => { const f = params.get("farmer"); if (f) setFarmerId(f); }, [params]);
  useEffect(() => {
    const loan = params.get("loan");
    const amt = params.get("amount");
    if (loan && farmerId) {
      setAllocs([{ kind: "loan", reference_id: loan, amount: amt ? Number(amt) : 0 }]);
    }
  }, [params, farmerId, openLoans.length]);

  // Live preview of the auto-generated receipt serial. Reads (does not consume) the counter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (receiptNo.trim()) { setPreviewSerial(""); return; }
      const allIrr = allocs.length > 0 && allocs.every(a => a.kind === "irrigation");
      const k = allIrr ? "IRR" : "PAY";
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("receipt_counters")
        .select("last_no")
        .eq("kind", k)
        .eq("year", year)
        .maybeSingle();
      const next = ((data?.last_no as number | undefined) ?? 0) + 1;
      if (!cancelled) setPreviewSerial(`${k}-${year}-${String(next).padStart(5, "0")}`);
    })();
    return () => { cancelled = true; };
  }, [allocs, receiptNo]);

  async function loadPriority() {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    if (!prof?.office_id) return;
    const { data: off } = await supabase.from("offices").select("payment_priority").eq("id", prof.office_id).maybeSingle();
    if (off?.payment_priority?.length) setPriority(off.payment_priority as string[]);
  }

  async function checkRole() {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setIsAdmin((data ?? []).some((r: any) => r.role === "committee" || r.role === "super_admin"));
  }

  async function load() {
    let pq = supabase.from("payments").select("*, farmers(name_en,name_bn,farmer_code,member_no,mobile,village,father_name,voter_number,account_number,is_voter), payment_allocations(*)").order("created_at", { ascending: false }).limit(100);
    pq = showDeleted ? pq.not("deleted_at", "is", null) : pq.is("deleted_at", null);
    const [f, p] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      pq,
    ]);
    setFarmers(f.data ?? []); setList(p.data ?? []);
  }
  async function restorePayment(id: string) {
    const { error } = await supabase.from("payments").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("restored")); load();
  }
  async function loadDues() {
    const [l, i] = await Promise.all([
      supabase.from("loans").select("id,principal,total_payable,issued_on,loan_payments(amount)").eq("farmer_id", farmerId).eq("status", "approved"),
      supabase.from("irrigation_invoices")
        .select("id,invoice_no,payable_amount,paid_amount,due_amount,due_date,generated_at,office_id,is_borga,delay_fee,maintenance_amount,canal_amount,irrigation_amount,other_charge")
        .eq("farmer_id", farmerId)
        .is("deleted_at", null)
        .neq("invoice_status", "cancelled")
        .gt("due_amount", 0)
        .order("due_date", { ascending: true }),
    ]);
    setOpenLoans(l.data ?? []); setOpenIrr(i.data ?? []);

    // Preload allocations from URL ?irr=id1,id2 — used by FarmerDetail "Pay" flow
    const irrParam = params.get("irr");
    if (irrParam) {
      const ids = irrParam.split(",").map(s => s.trim()).filter(Boolean);
      const matched = (i.data ?? []).filter((x: any) => ids.includes(x.id) && Number(x.due_amount || 0) > 0);
      if (matched.length) {
        setAllocs(matched.map((x: any) => ({ kind: "irrigation" as const, reference_id: x.id, amount: Number(x.due_amount) })));
        toast.success(`${matched.length} ${tx("invoices preloaded", "টি ইনভয়েস প্রিলোড হয়েছে")}`);
      }
    }
  }

  const totalAmount = useMemo(() => allocs.reduce((s, a) => s + Number(a.amount || 0), 0), [allocs]);

  async function uploadReceipt(paymentId: string): Promise<string | null> {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop();
    const path = `${user?.id}/${paymentId}.${ext}`;
    const { error } = await supabase.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (error) { toast.error(t("receiptUploadFailed").replace("{msg}", error.message)); return null; }
    const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? path;
  }

  function resetForm() {
    setAllocs([{ kind: "irrigation", reference_id: "", amount: 0 }]);
    setNote(""); setReceiptNo(""); setReceiptFile(null); setIdemKey(newKey());
  }

  async function pay() {
    if (submitting) return;
    if (!farmerId) return toast.error(t("pickFarmer"));
    if (totalAmount <= 0) return toast.error(t("totalMustBePositive"));
    for (const a of allocs) {
      if (Number(a.amount) <= 0) return toast.error(t("eachAllocationMustBePositive"));
      if ((a.kind === "loan" || a.kind === "irrigation") && !a.reference_id) return toast.error(`Pick target for ${a.kind}`);
    }

    // Strict installment enforcement for loan allocations (engine v2)
    const loanContext: Record<string, { settings: any; next: any; breakdown: any; override?: string }> = {};
    for (const a of allocs) {
      if (a.kind !== "loan" || !a.reference_id) continue;
      const { data: loanRow } = await supabase.from("loans").select("office_id").eq("id", a.reference_id).maybeSingle();
      const officeId = (loanRow as any)?.office_id ?? null;
      const [{ data: instList }, { data: settingsList }] = await Promise.all([
        supabase.from("loan_installments").select("id,installment_no,amount,paid_amount,due_date,status").eq("loan_id", a.reference_id).order("installment_no"),
        supabase.from("loan_delay_fee_settings").select("*").or(officeId ? `office_id.eq.${officeId},office_id.is.null` : "office_id.is.null"),
      ]);
      const engine = await import("@/lib/loanDelayFee");
      const next = engine.nextDueInstallment((instList ?? []) as any);
      if (!next) continue; // no schedule → fall through (legacy loans)
      const settings = (settingsList && settingsList[0]) || engine.DEFAULT_DELAY_SETTINGS;
      const v = engine.validateInstallmentPayment(next as any, settings as any, Number(a.amount));
      const breakdown = engine.computePenaltyBreakdown(next as any, settings as any);
      let overrideReason: string | undefined;
      if (!v.ok || v.needsOverride) {
        const enf = v.enforcement;
        if (enf === "block") {
          return toast.error(`${v.reason} (${tx("Required", "নির্ধারিত")}: ৳${v.required.toFixed(2)}, ${tx("Given", "প্রদত্ত")}: ৳${Number(a.amount).toFixed(2)})`);
        }
        if (enf === "warn") {
          if (!window.confirm(`⚠ ${tx("Required", "নির্ধারিত")}: ৳${v.required.toFixed(2)} | ${tx("Given", "প্রদত্ত")}: ৳${Number(a.amount).toFixed(2)}\n${tx("Save anyway?", "তবুও সংরক্ষণ করবেন?")}`)) return;
        }
        if (enf === "allow") {
          const reason = window.prompt(tx("Enter reason for partial payment override (saved in audit):", "আংশিক পেমেন্ট override কারণ লিখুন (অডিটে সংরক্ষিত হবে):"), "")?.trim();
          if (!reason) return toast.error(tx("Override reason required", "Override কারণ আবশ্যক"));
          overrideReason = reason;
        }
      }
      loanContext[a.reference_id] = { settings, next, breakdown, override: overrideReason };
    }

    setSubmitting(true);
    try {
      const status = receiptFile ? "pending" : "approved";
      // Primary kind = first allocation kind (kept for backward compat)
      const primary = allocs[0];

      // Auto-generate receipt number if user didn't supply one.
      // IRR-YYYY-NNNNN when every allocation is irrigation, otherwise PAY-YYYY-NNNNN.
      let finalReceiptNo: string | null = receiptNo.trim() || null;
      if (!finalReceiptNo) {
        const allIrr = allocs.every(a => a.kind === "irrigation");
        const rpcKind = allIrr ? "IRR" : "PAY";
        const { data: rn, error: rnErr } = await supabase.rpc("next_receipt_no", { p_kind: rpcKind });
        if (!rnErr && typeof rn === "string") finalReceiptNo = rn;
      }

      const payload: any = {
        farmer_id: farmerId,
        kind: primary.kind,
        amount: totalAmount,
        method, note,
        reference_id: primary.reference_id || null,
        collected_by: user?.id,
        status,
        idempotency_key: idemKey,
        receipt_no: finalReceiptNo,
      };

      const { data: inserted, error } = await supabase.from("payments").insert(payload).select("id").single();
      if (error) {
        if ((error as any).code === "23505" || /duplicate/i.test(error.message)) {
          toast.error(t("duplicateSubmissionDetected"));
          return;
        }
        return toast.error(error.message);
      }

      // Insert allocations
      const allocRows = allocs.map(a => ({ payment_id: inserted!.id, kind: a.kind, reference_id: a.reference_id || null, amount: Number(a.amount) }));
      const { error: aErr } = await supabase.from("payment_allocations").insert(allocRows);
      if (aErr) toast.error(t("allocationsErr").replace("{msg}", aErr.message));

      if (receiptFile) {
        const url = await uploadReceipt(inserted.id);
        if (url) await supabase.from("payments").update({ receipt_url: url }).eq("id", inserted.id);
      }

      if (status === "approved") {
        await applyAllocationsToLedgers(inserted.id, farmerId, allocs, note, loanContext);
        await sendIrrigationPaymentSms(farmerId, allocs, finalReceiptNo);
      }

      toast.success(status === "pending" ? "Submitted for approval" : t("paymentSuccess"));
      resetForm();
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function sendIrrigationPaymentSms(fId: string, list: Allocation[], receiptNo: string | null) {
    try {
      const irrTotal = list.filter(a => a.kind === "irrigation").reduce((s, a) => s + Number(a.amount || 0), 0);
      if (irrTotal <= 0) return;
      const farmer = farmers.find((x: any) => x.id === fId);
      const { data: full } = await supabase.from("farmers").select("mobile,name_bn,name_en").eq("id", fId).maybeSingle();
      const mobile = full?.mobile ?? farmer?.mobile;
      if (!mobile) return;
      const message = tx(`BDT ${irrTotal.toLocaleString()} received against your irrigation invoice.${receiptNo ? `\nReceipt no: ${receiptNo}` : ""}\nThank you.`, `আপনার সেচ ইনভয়েসের ৳${irrTotal.toLocaleString()} টাকা গ্রহণ করা হয়েছে।${receiptNo ? `\nরসিদ নং: ${receiptNo}` : ""}\nধন্যবাদ।`);
      await supabase.functions.invoke("send-sms", { body: { mobile, message, event_type: "irrigation_payment", farmer_id: fId } });
    } catch (_) { /* SMS failure must not break payment flow */ }
  }

  async function applyAllocationsToLedgers(paymentId: string, fId: string, list: Allocation[], desc?: string, loanContext: Record<string, any> = {}) {
    const noteText = desc?.trim() || undefined;
    for (const a of list) {
      if (a.kind === "loan" && a.reference_id) {
        const ctx = loanContext[a.reference_id];
        const penalty = Math.min(Number(a.amount), ctx?.breakdown?.total ?? 0);
        await supabase.from("loan_payments").insert({
          loan_id: a.reference_id,
          amount: Number(a.amount),
          collected_by: user?.id,
          note: noteText,
          penalty_collected: penalty,
          override_reason: ctx?.override ?? null,
          override_by: ctx?.override ? user?.id : null,
        } as any);
        if (ctx?.next) {
          const engine = await import("@/lib/loanDelayFee");
          const snapshot = engine.buildPenaltySnapshot(ctx.next, ctx.settings);
          const newPaid = Number(ctx.next.paid_amount || 0) + Math.max(0, Number(a.amount) - penalty);
          const fullyPaid = newPaid + 0.005 >= Number(ctx.next.amount);
          await supabase.from("loan_installments").update({
            paid_amount: newPaid,
            penalty_amount: (Number(ctx.next.penalty_amount || 0) + penalty),
            overdue_days: ctx.breakdown?.overdueDays ?? 0,
            penalty_rule_snapshot: snapshot as any,
            strict_validation_override: !!ctx.override,
            status: fullyPaid ? "paid" : (newPaid > 0 ? "partial" : ctx.next.status),
            paid_on: fullyPaid ? new Date().toISOString().slice(0, 10) : ctx.next.paid_on,
          } as any).eq("id", ctx.next.id);
          if (ctx.override) {
            await supabase.from("loan_installment_delay_audit").insert({
              installment_id: ctx.next.id,
              original_amount: ctx.breakdown?.total ?? 0,
              modified_amount: penalty,
              reason: ctx.override,
              changed_by: user?.id,
            } as any);
          }
        }
      } else if (a.kind === "irrigation" && a.reference_id) {
        const { data: inv } = await supabase
          .from("irrigation_invoices")
          .select("paid_amount,office_id")
          .eq("id", a.reference_id)
          .single();
        if (inv) {
          await supabase.from("irrigation_invoices")
            .update({ paid_amount: Number(inv.paid_amount) + Number(a.amount) })
            .eq("id", a.reference_id);
          await supabase.from("irrigation_invoice_payments").insert({
            invoice_id: a.reference_id,
            payment_id: paymentId,
            office_id: inv.office_id,
            collected_amount: Number(a.amount),
            irrigation_collected: Number(a.amount),
            created_by: user?.id,
          });
        }
      } else if (a.kind === "savings") {
        await supabase.from("savings_transactions").insert({ farmer_id: fId, type: "deposit", amount: Number(a.amount), status: "approved", created_by: user?.id, note: noteText });
      }
    }
  }

  async function approvePayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);

    const allocList: Allocation[] = (p.payment_allocations ?? []).length > 0
      ? p.payment_allocations.map((x: any) => ({ kind: x.kind, reference_id: x.reference_id ?? "", amount: Number(x.amount) }))
      : [{ kind: p.kind, reference_id: p.reference_id ?? "", amount: Number(p.amount) }];

    await applyAllocationsToLedgers(p.id, p.farmer_id, allocList, p.note);
    await sendIrrigationPaymentSms(p.farmer_id, allocList, p.receipt_no ?? null);
    toast.success(t("approvedToast"));
    load();
  }

  async function rejectPayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("rejectedToast"));
    load();
  }

  function updateAlloc(i: number, patch: Partial<Allocation>) {
    setAllocs(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }

  function autoAllocate() {
    const amt = Number(autoAmount);
    if (!farmerId) return toast.error(t("pickFarmer"));
    if (!(amt > 0)) return toast.error(t("enterAmountToAutoAllocate"));

    // Build queue per priority with oldest-first dues
    const queues: Record<string, { reference_id: string; due: number }[]> = {
      irrigation: [...openIrr]
        .sort((a, b) => new Date(a.due_date || a.generated_at).getTime() - new Date(b.due_date || b.generated_at).getTime())
        .map(i => ({ reference_id: i.id, due: Number(i.due_amount || 0) }))
        .filter(x => x.due > 0),
      loan: [...openLoans]
        .map(l => {
          const paid = (l.loan_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          return { reference_id: l.id, due: Math.max(0, Number(l.total_payable || 0) - paid), issued_on: l.issued_on };
        })
        .filter(x => x.due > 0)
        .sort((a, b) => new Date(a.issued_on).getTime() - new Date(b.issued_on).getTime()),
      savings: [], // savings = deposit, no "due"; consumes remainder
    };

    let remaining = amt;
    const out: Allocation[] = [];
    for (const kind of priority) {
      if (remaining <= 0) break;
      if (kind === "savings") {
        out.push({ kind: "savings", reference_id: "", amount: +remaining.toFixed(2) });
        remaining = 0;
        break;
      }
      const q = queues[kind] ?? [];
      for (const item of q) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, item.due);
        if (take > 0) {
          out.push({ kind: kind as any, reference_id: item.reference_id, amount: +take.toFixed(2) });
          remaining -= take;
        }
      }
    }
    if (remaining > 0) {
      // Surplus → savings deposit
      out.push({ kind: "savings", reference_id: "", amount: +remaining.toFixed(2) });
    }
    if (!out.length) return toast.error(t("noOutstandingDuesToAllocate"));
    setAllocs(out);
    toast.success(`Allocated to ${out.length} target(s) using office priority: ${priority.join(" → ")}`);
  }

  return (
    <>
      <PageHeader
        title={t("payments")}
        description="Unified payment — splits across loan, savings & irrigation in one entry"
        actions={<div className="flex gap-2"><Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!farmerId}><ArrowDownToLine className="h-4 w-4 mr-1" />{tx("Withdraw savings", "সঞ্চয় উত্তোলন")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx("Savings withdrawal request", "সঞ্চয় উত্তোলনের অনুরোধ")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 p-2 text-sm flex justify-between">
                <span>{tx("Available balance", "উপলব্ধ ব্যালেন্স")}</span>
                <span className="font-mono font-semibold">৳{savingsBalance.toLocaleString()}</span>
              </div>
              <div><Label>{tx("Amount", "পরিমাণ")}</Label>
                <Input type="number" min="1" max={savingsBalance} value={withdrawForm.amount || ""} onChange={e => setWithdrawForm(f => ({ ...f, amount: +e.target.value }))} /></div>
              <div><Label>{t("note")}</Label>
                <Input value={withdrawForm.note} onChange={e => setWithdrawForm(f => ({ ...f, note: e.target.value }))} /></div>
              <p className="text-xs text-muted-foreground">{t("withdrawalsRequireApproval")}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>{t("cancel")}</Button>
              <Button onClick={submitWithdraw}>{tx("Submit", "জমা দিন")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog><ReceiptSettingsButton /></div>}
      />
      <DuplicateReceiptWarning />
      <Tabs defaultValue="quick" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick">{tx("Quick / Multi-allocation", "দ্রুত / মিশ্র")}</TabsTrigger>
          <TabsTrigger value="irrigation">{tx("Structured Irrigation Payment", "কাঠামোবদ্ধ সেচ পেমেন্ট")}</TabsTrigger>
        </TabsList>
        <TabsContent value="irrigation">
          <IrrigationPaymentPanel initialFarmerId={farmerId} onPaid={load} />
        </TabsContent>
        <TabsContent value="quick">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-semibold mb-1">{t("payNow")}</h2>
          <p className="text-xs text-muted-foreground mb-3">Approved payments automatically update loan, savings &amp; irrigation ledgers.</p>
          <div className="space-y-3">
            <div><Label>{t("selectFarmer")}</Label>
              <FarmerSearchSelect value={farmerId || null}
                onChange={(id) => { setFarmerId(id ?? ""); setAllocs([{ kind: "irrigation", reference_id: "", amount: 0 }]); }} />

            </div>

            {farmerId && (
              <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
                <div className="font-semibold uppercase text-[10px] text-muted-foreground">{t("outstandingDues")}</div>
                <div className="flex justify-between"><span>{t("irrigation")}</span><span className="font-mono">{money(openIrr.reduce((s, x) => s + Number(x.due_amount || 0), 0))}</span></div>
                <div className="flex justify-between"><span>{t("loans")}</span><span className="font-mono">{money(openLoans.reduce((s, l) => s + (Number(l.total_payable) - (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0)), 0))}</span></div>
              </div>
            )}

            {farmerId && (
              <div className="rounded-md border border-dashed p-2 space-y-2">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Auto-allocate (priority: {priority.join(" → ")})</div>
                <div className="flex gap-2">
                  <Input type="number" min="0" placeholder={t("totalAmountPh")} value={autoAmount || ""} onChange={(e) => setAutoAmount(+e.target.value)} />
                  <Button type="button" variant="secondary" onClick={autoAllocate}>{t("apply")}</Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Configurable per office in Settings → Offices.</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("allocations")}</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAllocs([...allocs, { kind: "irrigation", reference_id: "", amount: 0 }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {allocs.map((a, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Select value={a.kind} onValueChange={(v: any) => updateAlloc(i, { kind: v, reference_id: "" })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="irrigation">{t("irrigation")}</SelectItem>
                        <SelectItem value="loan">{t("loans")}</SelectItem>
                        <SelectItem value="savings">{t("savings")}</SelectItem>
                      </SelectContent>
                    </Select>
                     {allocs.length > 1 && (
                      <DeleteButton onClick={() => setAllocs(allocs.filter((_, idx) => idx !== i))} />
                    )}
                  </div>
                  {a.kind === "loan" && (
                    <Select value={a.reference_id} onValueChange={(v) => updateAlloc(i, { reference_id: v })}>
                      <SelectTrigger><SelectValue placeholder={openLoans.length ? "Pick loan" : "No open loans"} /></SelectTrigger>
                      <SelectContent>{openLoans.map(l => {
                        const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount), 0);
                        return <SelectItem key={l.id} value={l.id}>{fmtDate(l.issued_on)} — Due {money(Number(l.total_payable) - paid)}</SelectItem>;
                      })}</SelectContent>
                    </Select>
                  )}
                  {a.kind === "irrigation" && (
                    <Select value={a.reference_id} onValueChange={(v) => updateAlloc(i, { reference_id: v })}>
                      <SelectTrigger><SelectValue placeholder={openIrr.length ? "Pick invoice" : "No open invoices"} /></SelectTrigger>
                      <SelectContent>{openIrr.map(ic => (
                        <SelectItem key={ic.id} value={ic.id}>
                          {ic.invoice_no} — {fmtDate(ic.due_date)} — Due {money(ic.due_amount)}
                        </SelectItem>
                      ))}</SelectContent>
                    </Select>
                  )}
                  <Input type="number" placeholder={t("amountPh")} value={a.amount || ""} onChange={(e) => updateAlloc(i, { amount: +e.target.value })} />
                </div>
              ))}
              <div className="text-right text-sm font-semibold">Total: {money(totalAmount)}</div>
            </div>

            <div><Label>{t("method")}</Label><Input value={method} onChange={e => setMethod(e.target.value)} /></div>
            <div>
              <Label>Field Receipt # <span className="text-xs text-muted-foreground">(optional — auto-generated if blank)</span></Label>
              <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="e.g. 12345" />
              {!receiptNo.trim() && previewSerial && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto serial preview: <span className="font-mono font-semibold text-foreground">{previewSerial}</span>
                </p>
              )}
            </div>
            <div><Label>{t("note")}</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Receipt (optional, requires approval)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              {receiptFile && <p className="text-xs text-muted-foreground mt-1">{receiptFile.name}</p>}
            </div>
            <Button className="w-full" onClick={pay} disabled={submitting}>
              {submitting ? "Processing…" : t("payNow")}
            </Button>
            <p className="text-[10px] text-muted-foreground">Idempotency key: <span className="font-mono">{idemKey.slice(0, 8)}…</span></p>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="font-semibold">{t("recentTransactions")}</h2>
            <Label className="text-sm flex items-center gap-2 cursor-pointer">
              <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
              <span className="text-xs">{t("showArchived")}</span>
            </Label>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>Receipt #</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("allocations")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("receipt")}</TableHead><TableHead>{t("action")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.receipt_no ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px]"><TruncateText>{p.farmers?.name_en}</TruncateText> <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span></TableCell>
                  <TableCell className="space-x-1">
                    {(p.payment_allocations ?? []).length > 0
                      ? p.payment_allocations.map((a: any) => <Badge key={a.id} variant="outline">{a.kind} {money(a.amount)}</Badge>)
                      : <Badge variant="outline">{p.kind}</Badge>}
                  </TableCell>
                  <TableCell className="font-semibold text-success">{money(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                      {p.status ?? "approved"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.receipt_url ? (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                        <FileText className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {showDeleted && isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => restorePayment(p.id)} title={t("restore")}>{t("restore")}</Button>
                      )}
                      {!showDeleted && isAdmin && p.status === "pending" && (<>
                        <Button size="icon" variant="ghost" onClick={() => approvePayment(p)} title={t("approve")}><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => rejectPayment(p)} title={t("reject")}><X className="h-4 w-4 text-destructive" /></Button>
                      </>)}
                      {!showDeleted && (() => {
                        const k = (p.kind as string) || "savings";
                        const kind = (k === "loan" ? "loan" : k === "irrigation" ? "irrigation" : "savings") as "loan" | "irrigation" | "savings";
                        const prefix = kind === "loan" ? "LOAN" : kind === "irrigation" ? "IRR" : "SAV";
                        const description = p.note
                          ?? (kind === "loan" ? tx("Loan installment received", "ঋণের কিস্তি গ্রহণ")
                            : kind === "savings" ? tx("Savings deposit received", "সঞ্চয় জমা গ্রহণ")
                            : tx("Irrigation charge received", "সেচ চার্জ গ্রহণ"));

                        // owner_type label now derived from invoice.is_borga; helper kept inline above.
                        const memberTypeBn = (f: any) =>
                          f?.is_voter ? "ভোটার নং" : f?.account_number ? "সঞ্চয়ী নং" : null;
                        const memberRefNo = (f: any) => f?.voter_number ?? f?.account_number ?? null;

                        const doDownload = async (copy: ReceiptCopy) => {
                          let irrEnriched: any = {};
                          if (kind === "irrigation") {
                            // Sum allocated to irrigation; pick the first allocation's irrigation_charges + land.
                            const irrAllocs = (p.payment_allocations ?? []).filter((a: any) => a.kind === "irrigation");
                            const refIds = irrAllocs.map((a: any) => a.reference_id).filter(Boolean);
                            const collectedFromOutstanding = irrAllocs.reduce((s: number, a: any) => s + Number(a.amount || 0), 0) || Number(p.amount || 0);
                            let primaryCharge: any = null;
                            let totalOutstanding = 0;
                            if (refIds.length) {
                              const { data: invs } = await supabase
                                .from("irrigation_invoices")
                                .select("id,invoice_no,payable_amount,paid_amount,due_amount,irrigation_amount,maintenance_amount,canal_amount,delay_fee,other_charge,is_borga,land_id,note,due_date,lands(mouza,dag_no,land_size,field_type,owner_type,owner_farmer_id,farmers:owner_farmer_id(name_bn,name_en,member_no))")
                                .in("id", refIds);
                              primaryCharge = (invs ?? [])[0] ?? null;
                              const { data: allDues } = await supabase
                                .from("irrigation_invoices")
                                .select("due_amount")
                                .eq("farmer_id", p.farmer_id)
                                .is("deleted_at", null)
                                .neq("invoice_status", "cancelled");
                              totalOutstanding = (allDues ?? []).reduce((s: number, r: any) => s + Number(r.due_amount || 0), 0);
                            }
                            const land = primaryCharge?.lands;
                            const ownerFarmer = land?.farmers;
                            const isSelf = !primaryCharge?.is_borga && (!land?.owner_farmer_id || land.owner_farmer_id === p.farmer_id || land.owner_type === "owner");
                            const fieldTypeBn = ({ high_land: tx("High land","উঁচু জমি"), medium_land: tx("Medium land","মাঝারি জমি"), low_land: tx("Low land","নিচু জমি"), other: tx("Other","অন্যান্য") } as Record<string, string>)[land?.field_type as string] ?? null;
                            irrEnriched = {
                              farmerExtras: {
                                mouza: land?.mouza ?? null,
                                dag_no: land?.dag_no ?? null,
                                land_size: land?.land_size != null ? Number(land.land_size) : null,
                                field_type_bn: fieldTypeBn,
                                owner_type_bn: primaryCharge?.is_borga ? "বর্গাদার" : "মালিক",
                              },
                              land_owner_label: isSelf
                                ? "নিজ"
                                : ownerFarmer
                                  ? `${ownerFarmer.name_bn || ownerFarmer.name_en}${ownerFarmer.member_no ? " (" + ownerFarmer.member_no + ")" : ""}`
                                  : null,
                              current_season_charge: primaryCharge?.irrigation_amount != null ? Number(primaryCharge.irrigation_amount) : null,
                              penalty_amount: primaryCharge?.delay_fee != null ? Number(primaryCharge.delay_fee) : 0,
                              maintenance_charge: primaryCharge?.maintenance_amount != null ? Number(primaryCharge.maintenance_amount) : 0,
                              canal_charge: primaryCharge?.canal_amount != null ? Number(primaryCharge.canal_amount) : 0,
                              total_outstanding: totalOutstanding,
                              collected_from_outstanding: collectedFromOutstanding,
                              remark: p.note ?? primaryCharge?.invoice_no ?? null,
                            };
                          }

                          await downloadBnReceiptPdf({
                            kind,
                            company_name: brand.company_name,
                            company_name_bn: brand.company_name_bn,
                            logo_url: brand.logo_url ?? null,
                            org: receiptArgs.org,
                            receipt_no: p.receipt_no || autoReceiptNo(prefix as any, p.id, new Date(p.created_at)),
                            date: p.created_at,
                            bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
                            farmer: {
                              name: p.farmers?.name_bn || p.farmers?.name_en || "—",
                              member_no: p.farmers?.member_no ?? p.farmers?.farmer_code ?? null,
                              mobile: p.farmers?.mobile ?? null,
                              village: p.farmers?.village ?? null,
                              father_or_husband: p.farmers?.father_name ?? null,
                              member_type_bn: memberTypeBn(p.farmers),
                              member_ref_no: memberRefNo(p.farmers),
                              ...(irrEnriched.farmerExtras ?? {}),
                            },
                            ...(kind === "irrigation"
                              ? {
                                  land_owner_label: irrEnriched.land_owner_label,
                                  current_season_charge: irrEnriched.current_season_charge,
                                  penalty_amount: irrEnriched.penalty_amount,
                                  maintenance_charge: irrEnriched.maintenance_charge,
                                  canal_charge: irrEnriched.canal_charge,
                                  total_outstanding: irrEnriched.total_outstanding,
                                  collected_from_outstanding: irrEnriched.collected_from_outstanding,
                                  remark: irrEnriched.remark,
                                }
                              : {}),
                            collected_amount: Number(p.amount),
                            description,
                            verify_url: p.verify_token ? `${window.location.origin}/r/${p.verify_token}` : null,
                          }, copy, receiptArgs.options);
                        };
                        return <ReceiptCopyMenu onSelect={doDownload} title={t("printReceipt") || "Print Receipt"} />;
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
