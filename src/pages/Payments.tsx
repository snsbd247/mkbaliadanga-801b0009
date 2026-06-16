import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchReceiptAuditLogs } from "@/lib/receiptAudit";
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
import { guardSavingsLoan } from "@/lib/memberEligibility";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Paperclip, Check, X, FileText, Plus, Trash2, Printer, ArrowDownToLine } from "lucide-react";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { TruncateText } from "@/components/ui/truncate-text";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { downloadBnReceiptPdf, type ReceiptCopy, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { nextMonthlyReceiptNo, nextUnifiedReceiptNo, peekMonthlyReceiptNo } from "@/lib/monthlyReceiptNo";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { IrrigationReceiptPreviewDialog } from "@/components/receipts/IrrigationReceiptPreviewDialog";
import { ReceiptSettingsButton } from "@/components/receipts/ReceiptSettingsButton";
import { DuplicateReceiptWarning } from "@/components/receipts/DuplicateReceiptWarning";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IrrigationPaymentPanel } from "@/components/payments/IrrigationPaymentPanel";
import { findRecentDuplicatePayment } from "@/lib/duplicatePaymentCheck";
import { getTodayMethodSummary, type MethodSummary } from "@/lib/paymentMethodSummary";

type Allocation = { kind: "savings" | "irrigation"; reference_id: string; amount: number };

const newKey = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function Payments() {
  const { t, tx } = useLang();
  const { user, officeId } = useAuth();
  const [params, setParams] = useSearchParams();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState(params.get("farmer") ?? "");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState<string>("general");
  const [note, setNote] = useState("");
  const [receiptNo, setReceiptNo] = useState("");

  const [allocs, setAllocs] = useState<Allocation[]>([{ kind: "irrigation", reference_id: "", amount: 0 }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ data: BnReceiptData; copy: ReceiptCopy } | null>(null);
  
  const [openIrr, setOpenIrr] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState<string>(newKey());
  const [priority, setPriority] = useState<string[]>(["irrigation", "savings"]);
  const [previewSerial, setPreviewSerial] = useState<string>("");
  const [autoAmount, setAutoAmount] = useState<number>(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | "irrigation" | "savings" | "loan">("all");
  const [paidOnly, setPaidOnly] = useState(false);
  const [period, setPeriod] = useState<"all" | "today" | "this_month">((params.get("period") as any) === "today" || (params.get("period") as any) === "this_month" ? params.get("period") as any : "all");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: 0, note: "" });
  const [savingsBalance, setSavingsBalance] = useState<number>(0);
  const [methodSummary, setMethodSummary] = useState<MethodSummary[]>([]);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    try { return localStorage.getItem("payments:autoDl") === "1"; } catch { return false; }
  });
  const [pendingAutoId, setPendingAutoId] = useState<string | null>(null);

  // Admin: edit an irrigation receipt after payment (mouza, owner, land size, delay fee, amount)
  const [editOpen, setEditOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [editLandId, setEditLandId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ mouza: "", land_size: 0, owner_farmer_id: "", delay_fee: 0, amount: 0, note: "", reason: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editHistory, setEditHistory] = useState<any[]>([]);

  async function loadEditHistory(paymentId: string) {
    try {
      const { rows } = await fetchReceiptAuditLogs({ paymentId, limit: 50 });
      setEditHistory(rows);
    } catch {
      setEditHistory([]);
    }
  }

  async function openEditReceipt(p: any) {
    setEditPayment(p);
    setEditOpen(true);
    setEditLoading(true);
    loadEditHistory(p.id);
    const irrAlloc = (p.payment_allocations ?? []).find((a: any) => a.kind === "irrigation" && a.reference_id)
      ?? (p.kind === "irrigation" && p.reference_id ? { reference_id: p.reference_id, amount: p.amount } : null);
    const invId = irrAlloc?.reference_id ?? null;
    setEditInvoiceId(invId);
    let mouza = "", land_size = 0, owner = "", delay = 0, landId: string | null = null;
    if (invId) {
      const { data: inv } = await supabase.from("irrigation_invoices")
        .select("land_id,owner_farmer_id,delay_fee,lands(mouza,land_size)").eq("id", invId).maybeSingle();
      if (inv) {
        landId = (inv as any).land_id ?? null;
        owner = (inv as any).owner_farmer_id ?? "";
        delay = Number((inv as any).delay_fee || 0);
        mouza = (inv as any).lands?.mouza ?? "";
        land_size = Number((inv as any).lands?.land_size || 0);
      }
    }
    setEditLandId(landId);
    setEditForm({ mouza, land_size, owner_farmer_id: owner, delay_fee: delay, amount: Number(p.amount || 0), note: p.note ?? "", reason: "" });
    setEditLoading(false);
  }

  async function saveEditReceipt() {
    if (!editPayment) return;
    if (!editForm.reason.trim()) return toast.error(tx("Reason is required", "কারণ আবশ্যক"));
    const p = editPayment;
    const before: any = {};
    const after: any = {};
    // 1) Land fields (mouza, land size)
    if (editLandId) {
      const { data: land } = await supabase.from("lands").select("mouza,land_size").eq("id", editLandId).maybeSingle();
      const newMouza = editForm.mouza.trim();
      const newSize = Number(editForm.land_size) || 0;
      if (land && (land.mouza !== newMouza || Number(land.land_size || 0) !== newSize)) {
        before.land = { mouza: land.mouza, land_size: land.land_size };
        after.land = { mouza: newMouza, land_size: newSize };
        await supabase.from("lands").update({ mouza: newMouza, land_size: newSize } as any).eq("id", editLandId);
      }
    }
    // 2) Invoice: owner + delay fee (recompute payable/due)
    if (editInvoiceId) {
      const { data: inv } = await supabase.from("irrigation_invoices")
        .select("owner_farmer_id,delay_fee,payable_amount,due_amount,paid_amount").eq("id", editInvoiceId).maybeSingle();
      if (inv) {
        const oldFee = Number((inv as any).delay_fee || 0);
        const newFee = Math.round(Number(editForm.delay_fee) || 0);
        const newOwner = editForm.owner_farmer_id || null;
        const patch: any = {};
        if ((inv as any).owner_farmer_id !== newOwner) { before.owner = (inv as any).owner_farmer_id; after.owner = newOwner; patch.owner_farmer_id = newOwner; }
        if (oldFee !== newFee) {
          before.delay_fee = oldFee; after.delay_fee = newFee;
          patch.delay_fee = newFee;
          patch.payable_amount = Number((inv as any).payable_amount || 0) + (newFee - oldFee);
          patch.due_amount = Math.max(0, Number((inv as any).due_amount || 0) + (newFee - oldFee));
        }
        if (Object.keys(patch).length) await supabase.from("irrigation_invoices").update(patch).eq("id", editInvoiceId);
      }
    }
    // 3) Payment amount adjustment (reflect in invoice paid_amount + allocation row)
    const newAmount = Math.round(Number(editForm.amount) || 0);
    if (newAmount !== Number(p.amount || 0)) {
      before.amount = Number(p.amount || 0); after.amount = newAmount;
      const diff = newAmount - Number(p.amount || 0);
      await supabase.from("payments").update({ amount: newAmount } as any).eq("id", p.id);
      if (editInvoiceId) {
        const { data: inv2 } = await supabase.from("irrigation_invoices").select("paid_amount,payable_amount").eq("id", editInvoiceId).maybeSingle();
        if (inv2) {
          const newPaid = Math.max(0, Number((inv2 as any).paid_amount || 0) + diff);
          const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= Number((inv2 as any).payable_amount || 0) ? "paid" : "partial";
          await supabase.from("irrigation_invoices").update({ paid_amount: newPaid, invoice_status: newStatus } as any).eq("id", editInvoiceId);
        }
        const { data: iip } = await supabase.from("irrigation_invoice_payments").select("id,collected_amount").eq("payment_id", p.id).eq("invoice_id", editInvoiceId).maybeSingle();
        if (iip) await supabase.from("irrigation_invoice_payments").update({ collected_amount: Math.max(0, Number((iip as any).collected_amount || 0) + diff), irrigation_collected: Math.max(0, Number((iip as any).collected_amount || 0) + diff) } as any).eq("id", (iip as any).id);
      }
      const { data: pa } = await supabase.from("payment_allocations").select("id").eq("payment_id", p.id).eq("kind", "irrigation").maybeSingle();
      if (pa) await supabase.from("payment_allocations").update({ amount: newAmount } as any).eq("id", (pa as any).id);
    }
    // 4) Note (applies to all kinds incl. savings)
    const newNote = editForm.note.trim() || null;
    if ((p.note ?? null) !== newNote) {
      before.note = p.note ?? null; after.note = newNote;
      await supabase.from("payments").update({ note: newNote } as any).eq("id", p.id);
    }
    await supabase.from("audit_logs").insert({
      user_id: user?.id, action: "edit", entity: "payments", entity_id: p.id, office_id: p.office_id ?? null,
      old_values: before, new_values: { ...after, reason: editForm.reason.trim() }, meta: { receipt_no: p.receipt_no },
    } as any);
    toast.success(tx("Receipt updated", "রসিদ হালনাগাদ হয়েছে"));
    setEditOpen(false); setEditPayment(null);
    load();
  }


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
  useEffect(() => { load(); /* refresh on filters */ }, [showDeleted, period]);
  useEffect(() => { if (farmerId) { loadDues(); loadSavingsBalance(farmerId); } else { setOpenIrr([]); setSavingsBalance(0); } }, [farmerId]);
  useEffect(() => {
    const f = params.get("farmer"); if (f) setFarmerId(f);
    const pr = params.get("period");
    if (pr === "today" || pr === "this_month" || pr === "all") setPeriod(pr);
  }, [params]);
  // Deep-link from the receipt audit log: open the edit dialog for ?receipt=NO
  useEffect(() => {
    const rno = params.get("receipt");
    if (!rno || editOpen || !(list ?? []).length) return;
    const match = (list ?? []).find((p: any) => p.receipt_no === rno);
    if (match) openEditReceipt(match);
  }, [params, list]);

  // Live preview of the auto-generated monthly receipt no. Reads (does not consume) the counter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (receiptNo.trim()) { setPreviewSerial(""); return; }
      const allIrr = allocs.length > 0 && allocs.every(a => a.kind === "irrigation");
      const k = allIrr ? "IRR" : "PAY";
      const preview = await peekMonthlyReceiptNo(k, officeId);
      if (!cancelled) setPreviewSerial(preview ?? "");
    })();
    return () => { cancelled = true; };
  }, [allocs, receiptNo, officeId]);

  // Auto-download the freshly-saved receipt as soon as its row appears in the list
  useEffect(() => {
    if (!pendingAutoId) return;
    if (!list.some(p => p.id === pendingAutoId)) return;
    const id = pendingAutoId;
    setPendingAutoId(null);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(`button[data-auto-print="${id}"]`);
      el?.click();
    });
  }, [list, pendingAutoId]);

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
    if (period !== "all") {
      const now = new Date();
      const from = period === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1);
      pq = pq.gte("created_at", from.toISOString());
    }
    const [f, p] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      pq,
    ]);
    setFarmers(f.data ?? []); setList(p.data ?? []);
    try { setMethodSummary(await getTodayMethodSummary({ officeId })); } catch {}
  }

  function clearFilters() {
    setShowDeleted(false);
    setPeriod("all");
    setFarmerId("");
    setKindFilter("all");
    setPaidOnly(false);
    setParams(new URLSearchParams(), { replace: true });
  }

  const displayList = useMemo(() => {
    return (list ?? []).filter((p: any) => {
      if (paidOnly && !(p.status === "approved" && !p.voided_at)) return false;
      if (kindFilter !== "all") {
        const kinds = (p.payment_allocations ?? []).length
          ? p.payment_allocations.map((a: any) => a.kind)
          : [p.kind];
        const matchSavings = kindFilter === "savings"
          ? kinds.some((k: string) => k === "savings" || k === "share")
          : kinds.includes(kindFilter);
        if (!matchSavings) return false;
      }
      return true;
    });
  }, [list, kindFilter, paidOnly]);


  async function restorePayment(id: string) {
    const { error } = await supabase.from("payments").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("restored")); load();
  }
  async function loadDues() {
    const i = await supabase.from("irrigation_invoices")
      .select("id,invoice_no,payable_amount,paid_amount,due_amount,due_date,generated_at,office_id,is_borga,delay_fee,maintenance_amount,canal_amount,irrigation_amount,other_charge")
      .eq("farmer_id", farmerId)
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled")
      .gt("due_amount", 0)
      .order("due_date", { ascending: true });
    setOpenIrr(i.data ?? []);

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
      if (a.kind === "irrigation" && !a.reference_id) return toast.error(`Pick target for ${a.kind}`);
    }

    // Member guard: savings/loan allocations require an active member with a member number.
    if (allocs.some(a => a.kind === "savings" || (a.kind as string) === "loan")) {
      const elig = await guardSavingsLoan(farmerId, allocs.some(a => (a.kind as string) === "loan") ? "loan" : "savings", tx);
      if (!elig.ok) return toast.error(elig.reason);
    }

    // Soft duplicate-payment guard: same farmer + same amount within 2 minutes.
    const dup = await findRecentDuplicatePayment({ farmer_id: farmerId, amount: totalAmount, withinSeconds: 120 });
    if (dup) {
      const ago = Math.round((Date.now() - new Date(dup.created_at).getTime()) / 1000);
      const ok = window.confirm(
        tx(
          `A payment of ৳${dup.amount} for this farmer was recorded ${ago}s ago (Receipt: ${dup.receipt_no ?? "—"}). Submit another one?`,
          `এই কৃষকের ৳${dup.amount} টাকার একটি পেমেন্ট ${ago} সেকেন্ড আগে নেওয়া হয়েছে (রসিদ: ${dup.receipt_no ?? "—"})। আরেকটি জমা দেবেন?`,
        ),
      );
      if (!ok) return;
    }

    const loanContext: Record<string, any> = {};

    setSubmitting(true);
    try {
      const status = receiptFile ? "pending" : "approved";
      // Primary kind = first allocation kind (kept for backward compat)
      const primary = allocs[0];

      // Auto-generate receipt number if user didn't supply one.
      // Unified paid-receipt serial shared across all streams (RCP-YYYY-MM-NNNN).
      let finalReceiptNo: string | null = receiptNo.trim() || null;
      if (!finalReceiptNo) {
        const allIrr = allocs.every(a => a.kind === "irrigation");
        finalReceiptNo = await nextUnifiedReceiptNo(officeId, allIrr ? "IRR" : "PAY", idemKey);
      }


      const payload: any = {
        farmer_id: farmerId,
        kind: primary.kind,
        amount: totalAmount,
        method, note,
        category,
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
        await applyAllocationsToLedgers(inserted.id, farmerId, allocs, note, loanContext, finalReceiptNo);
        await sendIrrigationPaymentSms(farmerId, allocs, finalReceiptNo);
      }

      toast.success(status === "pending" ? "Submitted for approval" : t("paymentSuccess"));
      if (autoDownload && status === "approved") setPendingAutoId(inserted.id);
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

  async function applyAllocationsToLedgers(paymentId: string, fId: string, list: Allocation[], desc?: string, loanContext: Record<string, any> = {}, receiptNo?: string | null) {
    const noteText = desc?.trim() || undefined;
    for (const a of list) {
      if (a.kind === "irrigation" && a.reference_id) {
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

    await applyAllocationsToLedgers(p.id, p.farmer_id, allocList, p.note, {}, p.receipt_no ?? null);
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

  async function voidPayment(p: any) {
    if (p.voided_at || p.status === "voided") return toast.error("এই রসিদ ইতোমধ্যে বাতিল করা হয়েছে");
    const reason = window.prompt("কেন এই রসিদ বাতিল করছেন? (Reason for voiding receipt)");
    if (!reason || !reason.trim()) return;
    const { error } = await supabase.from("payments").update({
      voided_at: new Date().toISOString(),
      voided_by: user?.id,
      void_reason: reason.trim(),
      status: "voided" as any,
    } as any).eq("id", p.id);
    if (error) return toast.error(error.message);

    const allocs: any[] = (p.payment_allocations ?? []).length
      ? p.payment_allocations
      : [{ kind: p.kind, reference_id: p.reference_id, amount: p.amount }];

    for (const a of allocs) {
      const amt = Number(a.amount || 0);
      if (!(amt > 0)) continue;
      if (a.kind === "irrigation" && a.reference_id) {
        const { data: inv } = await supabase.from("irrigation_invoices").select("paid_amount,payable_amount").eq("id", a.reference_id).maybeSingle();
        if (inv) {
          const newPaid = Math.max(0, Number(inv.paid_amount || 0) - amt);
          const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= Number(inv.payable_amount || 0) ? "paid" : "partial";
          await supabase.from("irrigation_invoices").update({ paid_amount: newPaid, invoice_status: newStatus } as any).eq("id", a.reference_id);
        }
        await supabase.from("irrigation_invoice_payments").delete().eq("invoice_id", a.reference_id).eq("payment_id", p.id);
      } else if (a.kind === "savings") {
        await supabase.from("savings_transactions").insert({
          farmer_id: p.farmer_id, type: "withdraw" as any, amount: amt,
          status: "approved" as any, created_by: user?.id,
          note: `Void reversal of payment ${p.receipt_no ?? p.id} — ${reason.trim()}`,
        } as any);
      }
    }

    await supabase.from("audit_logs").insert({
      user_id: user?.id,
      action: "void",
      entity: "payments",
      entity_id: p.id,
      office_id: p.office_id ?? null,
      old_values: { status: p.status, amount: p.amount, allocations: allocs },
      new_values: { status: "voided", void_reason: reason.trim() },
      meta: { receipt_no: p.receipt_no, farmer_id: p.farmer_id },
    } as any);

    toast.success("রসিদ বাতিল এবং বরাদ্দ পুনঃস্থাপন করা হয়েছে");
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
      <Tabs defaultValue="irrigation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="irrigation">{tx("Irrigation Payment (জরিমানা · ২ সিজন)", "সেচ পেমেন্ট (জরিমানা · ২ সিজন)")}</TabsTrigger>
          <TabsTrigger value="quick">{tx("Quick / Multi-allocation", "দ্রুত / মিশ্র (সেভিং)")}</TabsTrigger>
        </TabsList>
        <TabsContent value="irrigation">
          <IrrigationPaymentPanel initialFarmerId={farmerId} onPaid={load} />
        </TabsContent>
        <TabsContent value="quick">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
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
                        <SelectItem value="savings">{t("savings")}</SelectItem>
                      </SelectContent>
                    </Select>
                     {allocs.length > 1 && (
                      <DeleteButton onClick={() => setAllocs(allocs.filter((_, idx) => idx !== i))} />
                    )}
                  </div>
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
              <Label>{tx("Category", "ক্যাটাগরি")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{tx("General", "সাধারণ")}</SelectItem>
                  <SelectItem value="hawlat">{tx("Hawlat", "হাওলাত")}</SelectItem>
                  <SelectItem value="bank">{tx("Bank", "ব্যাংক")}</SelectItem>
                  <SelectItem value="donation">{tx("Donation", "দান")}</SelectItem>
                  <SelectItem value="misc">{tx("Misc", "বিবিধ")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <Switch
                checked={autoDownload}
                onCheckedChange={(v) => {
                  setAutoDownload(!!v);
                  try { localStorage.setItem("payments:autoDl", v ? "1" : "0"); } catch {}
                }}
              />
              <span>{tx("Auto-download receipt after save", "সংরক্ষণের পর রসিদ স্বয়ংক্রিয় ডাউনলোড")}</span>
            </label>
            <Button className="w-full" onClick={pay} disabled={submitting}>
              {submitting ? "Processing…" : t("payNow")}
            </Button>
            <p className="text-[10px] text-muted-foreground">Idempotency key: <span className="font-mono">{idemKey.slice(0, 8)}…</span></p>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          {methodSummary.length > 0 && (
            <div className="mb-3 rounded-md border bg-muted/30 p-2 text-xs">
              <div className="font-semibold uppercase text-[10px] text-muted-foreground mb-1">
                {tx("Today's collections by method", "আজকের আদায় (মাধ্যম-ভিত্তিক)")}
              </div>
              <div className="flex flex-wrap gap-3">
                {methodSummary.map(m => (
                  <span key={m.method} className="inline-flex items-center gap-1">
                    <Badge variant="secondary" className="uppercase">{m.method}</Badge>
                    <span className="font-mono font-semibold">{money(m.total)}</span>
                    <span className="text-muted-foreground">({m.count})</span>
                  </span>
                ))}
                <span className="ml-auto font-mono font-semibold">
                  {tx("Total", "মোট")}: {money(methodSummary.reduce((s, x) => s + x.total, 0))}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-semibold">{t("recentTransactions")}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {list[0] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const el = document.querySelector<HTMLElement>(`[data-payment-row="${list[0].id}"] [data-receipt-menu] button`);
                    el?.click();
                  }}
                  title={tx("Reprint last receipt", "শেষ রসিদ পুনঃমুদ্রণ")}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  {tx("Reprint last", "শেষ রসিদ")}
                </Button>
              )}
              <Select value={period} onValueChange={(v: any) => { setPeriod(v); const n = new URLSearchParams(params); if (v === "all") n.delete("period"); else n.set("period", v); setParams(n, { replace: true }); }}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All time", "সবসময়")}</SelectItem>
                  <SelectItem value="today">{tx("Today", "আজ")}</SelectItem>
                  <SelectItem value="this_month">{tx("This month", "এই মাস")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={kindFilter} onValueChange={(v: any) => setKindFilter(v)}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All types", "সব ধরন")}</SelectItem>
                  <SelectItem value="irrigation">{tx("Irrigation", "সেচ")}</SelectItem>
                  <SelectItem value="savings">{tx("Savings/Share", "সেভিং/শেয়ার")}</SelectItem>
                  <SelectItem value="loan">{tx("Loan", "ঋণ")}</SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <Switch checked={paidOnly} onCheckedChange={setPaidOnly} />
                <span className="text-xs">{tx("Paid only", "শুধু পরিশোধিত")}</span>
              </Label>
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
                <span className="text-xs">{t("showArchived")}</span>
              </Label>
              <Button variant="ghost" size="sm" onClick={clearFilters}>{tx("Clear filters", "ফিল্টার মুছুন")}</Button>
            </div>
          </div>
          <div className="[&_table]:min-w-[760px]">
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>Receipt #</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("allocations")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("receipt")}</TableHead><TableHead>{t("action")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {displayList.map(p => (
                <TableRow key={p.id} data-payment-row={p.id}>
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
                    <Badge variant={p.status === "voided" ? "destructive" : p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                      {p.status ?? "approved"}
                    </Badge>
                    {p.void_reason && <div className="text-[10px] text-muted-foreground mt-1 max-w-[160px] truncate" title={p.void_reason}>⊘ {p.void_reason}</div>}
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
                      {!showDeleted && isAdmin && p.status === "approved" && !p.voided_at && (
                        <Button size="sm" variant="outline" onClick={() => openEditReceipt(p)} title={tx("Edit receipt", "রসিদ এডিট")}>{tx("Edit", "এডিট")}</Button>
                      )}
                      {!showDeleted && isAdmin && p.status === "approved" && !p.voided_at && (
                        <Button size="sm" variant="outline" onClick={() => voidPayment(p)} title="Void receipt" className="text-destructive">Void</Button>
                      )}
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

                        const buildReceiptData = async (): Promise<BnReceiptData> => {
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

                          const rd: BnReceiptData = {
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
                          };
                          return rd;
                        };
                        const doDownload = async (copy: ReceiptCopy) =>
                          downloadBnReceiptPdf(await buildReceiptData(), copy, receiptArgs.options);
                        const doPreview = async () => setPreview({ data: await buildReceiptData(), copy: "both" });
                        return (
                          <>
                            <button
                              type="button"
                              hidden
                              aria-hidden="true"
                              data-auto-print={p.id}
                              onClick={() => doDownload("both")}
                            />
                            <span data-receipt-menu><ReceiptCopyMenu onSelect={doDownload} onPreview={kind === "irrigation" ? doPreview : undefined} title={t("printReceipt") || "Print Receipt"} /></span>
                          </>
                        );
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {displayList.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx("Edit receipt", "রসিদ এডিট")} {editPayment?.receipt_no ? `— ${editPayment.receipt_no}` : ""}</DialogTitle>
          </DialogHeader>
          {editLoading ? (
            <div className="py-6 text-center text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</div>
          ) : (
            <div className="space-y-3">
              {!editInvoiceId && (
                <p className="text-xs text-muted-foreground">{tx("This receipt has no linked irrigation invoice; only amount can be edited.", "এই রসিদে কোনো সেচ ইনভয়েস যুক্ত নেই; শুধু টাকা এডিট করা যাবে।")}</p>
              )}
              {editInvoiceId && (<>
                <div>
                  <Label>{tx("Owner", "মালিক")}</Label>
                  <FarmerSearchSelect value={editForm.owner_farmer_id || null} onChange={(id) => setEditForm(f => ({ ...f, owner_farmer_id: id ?? "" }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tx("Mouza", "মৌজা")}</Label>
                    <Input value={editForm.mouza} onChange={(e) => setEditForm(f => ({ ...f, mouza: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{tx("Land size", "জমির পরিমাণ")}</Label>
                    <Input type="number" step="0.01" value={editForm.land_size || ""} onChange={(e) => setEditForm(f => ({ ...f, land_size: Number(e.target.value || 0) }))} />
                  </div>
                </div>
                <div>
                  <Label>{tx("Delay fee / penalty", "জরিমানা")}</Label>
                  <Input type="number" step={1} value={editForm.delay_fee || ""} onChange={(e) => setEditForm(f => ({ ...f, delay_fee: Math.round(Number(e.target.value || 0)) }))} />
                </div>
              </>)}
              <div>
                <Label>{tx("Amount (৳)", "টাকা (৳)")}</Label>
                <Input type="number" step={1} value={editForm.amount || ""} onChange={(e) => setEditForm(f => ({ ...f, amount: Math.round(Number(e.target.value || 0)) }))} />
              </div>
              <div>
                <Label>{tx("Note", "নোট")}</Label>
                <Input value={editForm.note} onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder={tx("Remark / note", "মন্তব্য / নোট")} />
              </div>
              <div>
                <Label>{tx("Reason for change", "পরিবর্তনের কারণ")} *</Label>
                <Input value={editForm.reason} onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))} placeholder={tx("Why are you editing this receipt?", "কেন এই রসিদ এডিট করছেন?")} />
              </div>
              {editHistory.length > 0 && (
                <div className="rounded-md border p-2 max-h-48 overflow-auto space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">{tx("Edit history", "এডিট ইতিহাস")}</div>
                  {editHistory.map((h) => (
                    <div key={h.id} className="text-xs border-b pb-1 last:border-0">
                      <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()} · {h.new_values?.reason || "—"}</div>
                      <div className="font-mono whitespace-pre-wrap break-all">
                        {tx("Before", "আগে")}: {JSON.stringify(h.old_values)}{"\n"}{tx("After", "পরে")}: {JSON.stringify((({ reason, ...rest }) => rest)(h.new_values || {}))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={saveEditReceipt} disabled={editLoading}>{tx("Save changes", "সংরক্ষণ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IrrigationReceiptPreviewDialog
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        data={preview?.data ?? null}
        copy={preview?.copy ?? "both"}
      />
    </>
  );
}
