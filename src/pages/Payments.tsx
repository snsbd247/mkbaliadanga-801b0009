import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { fetchOpenIrrigationInvoicesResult, filterInvoicesByStatus, searchAndSortInvoices } from "@/lib/irrigationInvoiceQueries";
import { createInvoiceCache } from "@/lib/invoiceCache";
import { invoiceStatusBadge, computeIrrigationDue, detectDueMismatch } from "@/lib/dues";
import { logAudit } from "@/lib/audit";
import { fetchReceiptAuditLogs } from "@/lib/receiptAudit";
import { postIrrigationCollection, takeLastImbalance, checkRequiredAccounts, formatImbalance } from "@/lib/accountingPosting";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { usePermission } from "@/hooks/usePermission";
import { Paperclip, Check, X, FileText, Plus, Trash2, Printer, ArrowDownToLine } from "lucide-react";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { TruncateText } from "@/components/ui/truncate-text";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { downloadBnReceiptPdf, type ReceiptCopy, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { paymentInitialStatus } from "@/lib/approvalMatrix";
import { computeInvoiceDue } from "@/lib/irrigationDue";
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
import { buildIrrigationReceiptEnrichment } from "@/lib/irrigationReceiptData";
import { getTodayMethodSummary, type MethodSummary } from "@/lib/paymentMethodSummary";
import { previewEdit, checkConsistency, type EditBaseline } from "@/lib/combinedReceiptValidation";

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
  const [dueMismatch, setDueMismatch] = useState<import("@/lib/dues").DueMismatchResult | null>(null);
  const [invoiceEmpty, setInvoiceEmpty] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<"open" | "cancelled">("open");
  // In-flight request token to ignore stale responses / prevent concurrent races.
  const dueReqRef = useRef(0);
  // Per-farmer invoice cache to avoid redundant refetches on revisit.
  const invoiceCacheRef = useRef(createInvoiceCache<any>());
  const [cancelledIrr, setCancelledIrr] = useState<any[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSort, setInvoiceSort] = useState<import("@/lib/irrigationInvoiceQueries").InvoiceSortKey>("due_date");
  const [invoiceSortDir, setInvoiceSortDir] = useState<import("@/lib/irrigationInvoiceQueries").SortDir>("asc");
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [detailTxns, setDetailTxns] = useState<any[]>([]);
  const [invoicePage, setInvoicePage] = useState(0);
  const INVOICE_PAGE_SIZE = 10;
  const displayInvoices = useMemo(
    () => searchAndSortInvoices(invoiceFilter === "open" ? openIrr : cancelledIrr, invoiceSearch, invoiceSort, invoiceSortDir),
    [invoiceFilter, openIrr, cancelledIrr, invoiceSearch, invoiceSort, invoiceSortDir],
  );
  const invoicePageCount = Math.max(1, Math.ceil(displayInvoices.length / INVOICE_PAGE_SIZE));
  const pagedInvoices = useMemo(
    () => displayInvoices.slice(invoicePage * INVOICE_PAGE_SIZE, invoicePage * INVOICE_PAGE_SIZE + INVOICE_PAGE_SIZE),
    [displayInvoices, invoicePage],
  );
  // Reset to first page whenever the filtered set changes.
  useEffect(() => { setInvoicePage(0); }, [invoiceFilter, invoiceSearch, invoiceSort, invoiceSortDir, openIrr, cancelledIrr]);
  const [isAdmin, setIsAdmin] = useState(false);
  // Developer/super_admin (via isAdmin) OR users granted payments edit permission may edit receipts.
  const canEditPayments = usePermission("payments", "can_edit");
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
  const [editBaseline, setEditBaseline] = useState<EditBaseline | null>(null);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const editPreview = useMemo(() => {
    if (!editBaseline) return null;
    return previewEdit(editBaseline, { delay_fee: editForm.delay_fee, amount: editForm.amount });
  }, [editBaseline, editForm.delay_fee, editForm.amount]);

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
    let baseline: EditBaseline | null = null;
    if (invId) {
      const { data: inv } = await db.from("irrigation_invoices")
        .select("land_id,owner_farmer_id,delay_fee,payable_amount,due_amount,paid_amount,lands(mouza,land_size)").eq("id", invId).maybeSingle();
      if (inv) {
        landId = (inv as any).land_id ?? null;
        owner = (inv as any).owner_farmer_id ?? "";
        delay = Number((inv as any).delay_fee || 0);
        mouza = (inv as any).lands?.mouza ?? "";
        land_size = Number((inv as any).lands?.land_size || 0);
        baseline = {
          payable_amount: Number((inv as any).payable_amount || 0),
          due_amount: Number((inv as any).due_amount || 0),
          paid_amount: Number((inv as any).paid_amount || 0),
          delay_fee: delay,
          amount: Number(p.amount || 0),
        };
      }
    }
    setEditLandId(landId);
    setEditBaseline(baseline);
    setEditForm({ mouza, land_size, owner_farmer_id: owner, delay_fee: delay, amount: Number(p.amount || 0), note: p.note ?? "", reason: "" });
    setEditLoading(false);
  }

  async function saveEditReceipt() {
    if (!editPayment) return;
    if (!editForm.reason.trim()) return toast.error(tx("Reason is required", "কারণ আবশ্যক"));
    // Front-end guards: block negative amounts and over-payment beyond payable.
    const amt = Math.round(Number(editForm.amount) || 0);
    if (amt < 0 || Number.isNaN(amt)) return toast.error(tx("Enter a valid amount", "সঠিক অঙ্ক দিন"));
    if (editBaseline && amt > editBaseline.payable_amount + (Math.round(Number(editForm.delay_fee) || 0) - editBaseline.delay_fee)) {
      return toast.error(tx("Amount exceeds payable", "অঙ্ক প্রদেয়র চেয়ে বেশি"));
    }
    if (editInvoiceId && !editForm.owner_farmer_id) return toast.error(tx("Select a farmer", "কৃষক নির্বাচন করুন"));
    // Save-time consistency check: recalculated due/paid must agree across
    // invoice, allocation and payment records before we persist anything.
    if (editBaseline && editPreview) {
      const { ok, errors } = checkConsistency({
        invoicePaid: editPreview.paid,
        allocationAmount: Math.round(Number(editForm.amount) || 0),
        paymentAmount: Math.round(Number(editForm.amount) || 0),
        payable: editPreview.payable,
        due: editPreview.due,
      });
      if (!ok) return toast.error(tx("Cannot save: ", "সংরক্ষণ করা যাচ্ছে না: ") + errors.join("; "));
    }
    const p = editPayment;
    setEditLoading(true);
    // All writes happen server-side (payment-edit edge function) so that users with
    // the payments edit permission — not just admins — can safely edit, and every
    // linked module (invoice due/paid, allocation, savings, audit) stays consistent.
    const { data, error } = await supabase.functions.invoke("payment-edit", {
      body: {
        payment_id: p.id,
        reason: editForm.reason.trim(),
        amount: Math.round(Number(editForm.amount) || 0),
        note: editForm.note,
        mouza: editLandId ? editForm.mouza : null,
        land_size: editLandId ? editForm.land_size : null,
        owner_farmer_id: editInvoiceId ? (editForm.owner_farmer_id || null) : null,
        delay_fee: editInvoiceId ? Math.round(Number(editForm.delay_fee) || 0) : null,
      },
    });
    setEditLoading(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || tx("Failed to update receipt", "রসিদ হালনাগাদ ব্যর্থ হয়েছে"));
    }
    toast.success(tx("Receipt updated", "রসিদ হালনাগাদ হয়েছে"));
    setEditOpen(false); setEditPayment(null);
    load();
  }


  async function loadSavingsBalance(fid: string) {
    const { data } = await db
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
    const { error } = await db.from("savings_transactions").insert({
      farmer_id: farmerId, type: "withdraw" as any, amount: withdrawForm.amount,
      note: withdrawForm.note, status: "pending" as any, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    await db.from("notifications").insert({
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
  useEffect(() => { backfillMissingReceiptNos(officeId).then((n) => { if (n > 0) load(); }); }, [officeId]);
  useEffect(() => { load(); /* refresh on filters */ }, [showDeleted, period]);
  useEffect(() => { if (farmerId) { loadDues(); loadSavingsBalance(farmerId); } else { setOpenIrr([]); setCancelledIrr([]); setSavingsBalance(0); } setInvoiceFilter("open"); }, [farmerId]);
  // Lazy-load cancelled/soft-deleted invoices only when that filter is selected.
  useEffect(() => {
    if (invoiceFilter !== "cancelled" || !farmerId) return;
    let active = true;
    (async () => {
      const { data } = await db
        .from("irrigation_invoices")
        .select("id,invoice_no,due_amount,due_date,invoice_status,deleted_at")
        .eq("farmer_id", farmerId);
      if (active) setCancelledIrr(filterInvoicesByStatus((data as any[]) ?? [], "cancelled"));
    })();
    return () => { active = false; };
  }, [invoiceFilter, farmerId]);
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
    const { data: prof } = await db.from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    if (!prof?.office_id) return;
    const { data: off } = await db.from("offices").select("payment_priority").eq("id", prof.office_id).maybeSingle();
    if (off?.payment_priority?.length) setPriority(off.payment_priority as string[]);
  }

  async function checkRole() {
    if (!user) return;
    const { data } = await db.from("user_roles").select("role").eq("user_id", user.id);
    setIsAdmin((data ?? []).some((r: any) => r.role === "committee" || r.role === "super_admin"));
  }

  async function load() {
    let pq = db.from("payments").select("*, farmers(name_en,name_bn,farmer_code,member_no,mobile,village,father_name,voter_number,account_number,is_voter,union_id), payment_allocations(*)").order("created_at", { ascending: false }).limit(100);
    pq = showDeleted ? pq.not("deleted_at", "is", null) : pq.is("deleted_at", null);
    if (period !== "all") {
      const now = new Date();
      const from = period === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1);
      pq = pq.gte("created_at", from.toISOString());
    }
    const [f, p] = await Promise.all([
      db.from("farmers").select("id,name_en,farmer_code").order("name_en"),
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
    const { error } = await db.from("payments").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("restored")); load();
  }
  async function loadDues(opts?: { force?: boolean }) {
    const fid = farmerId;
    // Serve from cache on revisit unless a forced refresh is requested.
    if (!opts?.force && invoiceCacheRef.current.has(fid)) {
      const cached = invoiceCacheRef.current.get(fid)!;
      setOpenIrr(cached);
      setInvoiceEmpty(!!fid && cached.length === 0);
      return;
    }
    // Concurrency guard: only the latest request may commit its result.
    const reqId = ++dueReqRef.current;
    setInvoiceLoading(true);
    // Shared query util keeps filtering identical to IrrigationPaymentPanel and
    // keeps NULL invoice_status invoices visible (see irrigationInvoiceQueries).
    const { rows, error, traceId } = await fetchOpenIrrigationInvoicesResult(
      fid,
      "id,invoice_no,payable_amount,paid_amount,due_amount,due_date,generated_at,office_id,is_borga,delay_fee,maintenance_amount,canal_amount,irrigation_amount,other_charge,invoice_status",
    );
    // Ignore stale responses (a newer farmer selection has superseded this one).
    if (reqId !== dueReqRef.current) return;
    setInvoiceLoading(false);
    if (error) {
      toast.error(
        tx(`Failed to load invoices (trace: ${traceId})`, `ইনভয়েস লোড ব্যর্থ (ট্রেস: ${traceId})`),
        { description: error.message, action: { label: tx("Retry", "আবার চেষ্টা"), onClick: () => loadDues({ force: true }) } },
      );
    }
    if (!error) invoiceCacheRef.current.set(fid, rows);
    setOpenIrr(rows);
    // Diagnose missing invoices: flag when a farmer is selected but nothing came back.
    const isEmpty = !error && !!fid && rows.length === 0;
    setInvoiceEmpty(isEmpty);
    if (isEmpty) console.warn("[payments] no open irrigation invoices returned for farmer", fid);

    // Cross-check: the Farmer List irrigation-due total (canonical) must equal
    // the sum of open invoices we render here. If they diverge, an invoice is
    // being dropped — surface a UI alert and log server-side so it can't hide.
    try {
      const { data: allRows } = await db
        .from("irrigation_invoices")
        .select("due_amount,invoice_status,deleted_at")
        .eq("farmer_id", farmerId);
      const listDue = computeIrrigationDue((allRows as any[]) ?? []);
      const paymentsDue = rows.reduce((s: number, x: any) => s + Math.max(0, Number(x.due_amount || 0)), 0);
      const result = detectDueMismatch(listDue, paymentsDue);
      setDueMismatch(result.mismatch ? result : null);
      if (result.mismatch) {
        console.error("[due-mismatch]", { farmerId, ...result });
        logAudit({
          module: "payments",
          action_type: "due_mismatch",
          reference_id: farmerId,
          new_data: { list_due: result.listDue, payments_due: result.paymentsDue, diff: result.diff },
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("due mismatch check failed", e);
    }




    // Preload allocations from URL ?irr=id1,id2 — used by FarmerDetail "Pay" flow
    const irrParam = params.get("irr");
    if (irrParam) {
      const ids = irrParam.split(",").map(s => s.trim()).filter(Boolean);
      const matched = rows.filter((x: any) => ids.includes(x.id) && Number(x.due_amount || 0) > 0);
      if (matched.length) {
        setAllocs(matched.map((x: any) => ({ kind: "irrigation" as const, reference_id: x.id, amount: Number(x.due_amount) })));
        toast.success(`${matched.length} ${tx("invoices preloaded", "টি ইনভয়েস প্রিলোড হয়েছে")}`);
      }
    }
  }

  function invoiceExportRows() {
    // Export the full filtered/searched/sorted set (not just the current page).
    return displayInvoices.map((ic) => ({
      invoice_no: String(ic.invoice_no ?? ""),
      due_date: fmtDate(ic.due_date),
      status: invoiceStatusBadge(ic.invoice_status ?? null).label_bn,
      payable: Number(ic.payable_amount ?? 0),
      paid: Number(ic.paid_amount ?? 0),
      due: Number(ic.due_amount ?? 0),
    }));
  }

  async function exportInvoicesExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(invoiceExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices-${invoiceFilter}-${Date.now()}.xlsx`);
  }

  async function exportInvoicesPdf() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["Invoice", "Due date", "Status", "Payable", "Paid", "Due"]],
      body: invoiceExportRows().map((r) => [r.invoice_no, r.due_date, r.status, r.payable, r.paid, r.due]),
    });
    doc.save(`invoices-${invoiceFilter}-${Date.now()}.pdf`);
  }

  async function openInvoiceDetails(inv: any | null | undefined) {
    if (!inv) return;
    setDetailInvoice(inv);
    setDetailTxns([]);
    const { data } = await db
      .from("irrigation_invoice_payments")
      .select("id,collected_amount,created_at,payment_id")
      .eq("invoice_id", inv.id)
      .order("created_at", { ascending: false });
    setDetailTxns((data as any[]) ?? []);
  }

  const totalAmount = useMemo(() => allocs.reduce((s, a) => s + Number(a.amount || 0), 0), [allocs]);

  async function uploadReceipt(paymentId: string): Promise<string | null> {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop();
    const path = `${user?.id}/${paymentId}.${ext}`;
    const { error } = await db.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (error) { toast.error(t("receiptUploadFailed").replace("{msg}", error.message)); return null; }
    const { data } = await db.storage.from("payment-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
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
      // অগ্রাধিকার ৫ — Approval matrix: collections (irrigation/savings/loan repayment)
      // are approval-free regardless of an attached receipt scan.
      const primaryKind = allocs[0]?.kind as "loan" | "savings" | "irrigation";
      const status = paymentInitialStatus(primaryKind);
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


      const { data: inserted, error } = await db.from("payments").insert(payload).select("id").single();
      if (error) {
        if ((error as any).code === "23505" || /duplicate/i.test(error.message)) {
          toast.error(t("duplicateSubmissionDetected"));
          return;
        }
        return toast.error(error.message);
      }

      // Insert allocations
      const allocRows = allocs.map(a => ({ payment_id: inserted!.id, kind: a.kind, reference_id: a.reference_id || null, amount: Number(a.amount) }));
      const { error: aErr } = await db.from("payment_allocations").insert(allocRows);
      if (aErr) toast.error(t("allocationsErr").replace("{msg}", aErr.message));

      if (receiptFile) {
        const url = await uploadReceipt(inserted.id);
        if (url) await db.from("payments").update({ receipt_url: url }).eq("id", inserted.id);
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
      const { data: full } = await db.from("farmers").select("mobile,name_bn,name_en").eq("id", fId).maybeSingle();
      const mobile = full?.mobile ?? farmer?.mobile;
      if (!mobile) return;
      const message = tx(`BDT ${irrTotal.toLocaleString()} received against your irrigation invoice.${receiptNo ? `\nReceipt no: ${receiptNo}` : ""}\nThank you.`, `আপনার সেচ ইনভয়েসের ৳${irrTotal.toLocaleString()} টাকা গ্রহণ করা হয়েছে।${receiptNo ? `\nরসিদ নং: ${receiptNo}` : ""}\nধন্যবাদ।`);
      await db.functions.invoke("send-sms", { body: { mobile, message, event_type: "irrigation_payment", farmer_id: fId } });
    } catch (_) { /* SMS failure must not break payment flow */ }
  }

  async function applyAllocationsToLedgers(paymentId: string, fId: string, list: Allocation[], desc?: string, loanContext: Record<string, any> = {}, receiptNo?: string | null) {
    const noteText = desc?.trim() || undefined;
    for (const a of list) {
      if (a.kind === "irrigation" && a.reference_id) {
        const { data: inv } = await db
          .from("irrigation_invoices")
          .select("paid_amount,office_id")
          .eq("id", a.reference_id)
          .single();
        if (inv) {
          await db.from("irrigation_invoices")
            .update({ paid_amount: Number(inv.paid_amount) + Number(a.amount) })
            .eq("id", a.reference_id);
          await db.from("irrigation_invoice_payments").insert({
            invoice_id: a.reference_id,
            payment_id: paymentId,
            office_id: inv.office_id,
            collected_amount: Number(a.amount),
            irrigation_collected: Number(a.amount),
            created_by: user?.id,
          });
          // Chart of accounts: Dr Cash / Cr Irrigation Income for the collected amount.
          const acc = await checkRequiredAccounts();
          if (!acc.ok) toast.error(acc.message!);
          await postIrrigationCollection({
            amount: Number(a.amount),
            receiptNo: receiptNo ?? null,
            officeId: (inv as any).office_id ?? null,
            createdBy: user?.id ?? null,
          });
          const imb = takeLastImbalance();
          if (imb) {
            toast.warning(formatImbalance(imb, tx("en", "bn") as "en" | "bn"));
          }
        }
      } else if (a.kind === "savings") {
        await db.from("savings_transactions").insert({ farmer_id: fId, type: "deposit", amount: Number(a.amount), status: "approved", created_by: user?.id, note: noteText });
      }
    }
  }

  async function approvePayment(p: any) {
    const { error } = await db.from("payments").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
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
    const { error } = await db.from("payments").update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("rejectedToast"));
    load();
  }

  async function voidPayment(p: any) {
    if (p.voided_at || p.status === "voided") return toast.error("এই রসিদ ইতোমধ্যে বাতিল করা হয়েছে");
    const reason = window.prompt("কেন এই রসিদ বাতিল করছেন? (Reason for voiding receipt)");
    if (!reason || !reason.trim()) return;
    const { error } = await db.from("payments").update({
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
        const { data: inv } = await db.from("irrigation_invoices").select("paid_amount,payable_amount").eq("id", a.reference_id).maybeSingle();
        if (inv) {
          const st = computeInvoiceDue(inv.payable_amount, Number(inv.paid_amount || 0) - amt);
          await db.from("irrigation_invoices").update({ paid_amount: st.paid, due_amount: st.due, invoice_status: st.status } as any).eq("id", a.reference_id);
        }
        await db.from("irrigation_invoice_payments").delete().eq("invoice_id", a.reference_id).eq("payment_id", p.id);
      } else if (a.kind === "savings") {
        await db.from("savings_transactions").insert({
          farmer_id: p.farmer_id, type: "withdraw" as any, amount: amt,
          status: "approved" as any, created_by: user?.id,
          note: `Void reversal of payment ${p.receipt_no ?? p.id} — ${reason.trim()}`,
        } as any);
      }
    }

    await db.from("audit_logs").insert({
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
        description={tx("Unified payment — splits across loan, savings & irrigation in one entry", "একীভূত পেমেন্ট — এক এন্ট্রিতে ঋণ, সঞ্চয় ও সেচে ভাগ হয়")}
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

            {dueMismatch && (
              <div
                role="alert"
                data-testid="due-mismatch-alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
              >
                {tx(
                  `Due mismatch: Farmer list shows ৳${money(dueMismatch.listDue)} but open invoices total ৳${money(dueMismatch.paymentsDue)} (diff ৳${money(dueMismatch.diff)}). An invoice may be hidden — this has been logged.`,
                  `বকেয়া অমিল: farmer list এ ৳${money(dueMismatch.listDue)} কিন্তু খোলা ইনভয়েসের যোগফল ৳${money(dueMismatch.paymentsDue)} (পার্থক্য ৳${money(dueMismatch.diff)})। কোনো ইনভয়েস লুকানো থাকতে পারে — লগ করা হয়েছে।`,
                )}
              </div>
            )}
            {invoiceEmpty && (
              <div
                role="alert"
                data-testid="no-invoices-alert"
                className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
              >
                {tx(
                  "No open irrigation invoices found for this farmer. If you expected some, an invoice may be filtered out — check the console log for details.",
                  "এই কৃষকের কোনো খোলা সেচ ইনভয়েস পাওয়া যায়নি। থাকার কথা থাকলে কোনো ইনভয়েস ফিল্টার হয়ে থাকতে পারে — বিস্তারিত কনসোল লগে দেখুন।",
                )}
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
                    invoiceLoading ? (
                      <div className="space-y-2" data-testid="invoice-loading-skeleton">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-2/3" />
                      </div>
                    ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" size="sm" variant={invoiceFilter === "open" ? "default" : "outline"} onClick={() => setInvoiceFilter("open")}>{tx("Open", "খোলা")}</Button>
                        <Button type="button" size="sm" variant={invoiceFilter === "cancelled" ? "default" : "outline"} onClick={() => setInvoiceFilter("cancelled")}>{tx("Cancelled", "বাতিল")}</Button>
                        <Input
                          className="h-8 w-40"
                          placeholder={tx("Search no./date", "নম্বর/তারিখ খুঁজুন")}
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          data-testid="invoice-search"
                        />
                        <Select value={invoiceSort} onValueChange={(v: any) => setInvoiceSort(v)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="due_date">{tx("Due date", "তারিখ")}</SelectItem>
                            <SelectItem value="invoice_no">{tx("Invoice no.", "নম্বর")}</SelectItem>
                            <SelectItem value="due_amount">{tx("Due amount", "পরিমাণ")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={() => setInvoiceSortDir(invoiceSortDir === "asc" ? "desc" : "asc")}>
                          {invoiceSortDir === "asc" ? "↑" : "↓"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={exportInvoicesExcel} disabled={!displayInvoices.length}>Excel</Button>
                        <Button type="button" size="sm" variant="outline" onClick={exportInvoicesPdf} disabled={!displayInvoices.length}>PDF</Button>
                      </div>
                      <Select value={a.reference_id} onValueChange={(v) => updateAlloc(i, { reference_id: v })} disabled={invoiceFilter === "cancelled"}>
                        <SelectTrigger><SelectValue placeholder={displayInvoices.length ? "Pick invoice" : (invoiceFilter === "cancelled" ? "No cancelled invoices" : "No open invoices")} /></SelectTrigger>
                        <SelectContent>{pagedInvoices.map(ic => (
                          <SelectItem key={ic.id} value={ic.id}>
                            {ic.invoice_no}{!ic.invoice_status ? ` (${invoiceStatusBadge(null).label_bn})` : ""} — {fmtDate(ic.due_date)} — Due{" "}
                            <span
                              data-testid="invoice-due-amount"
                              className={Number(ic.due_amount || 0) > 0 ? "font-semibold text-destructive" : ""}
                            >
                              {money(ic.due_amount)}
                            </span>
                          </SelectItem>

                        ))}</SelectContent>
                      </Select>
                      {displayInvoices.length > INVOICE_PAGE_SIZE && (
                        <div className="flex items-center gap-2 text-xs" data-testid="invoice-pagination">
                          <Button type="button" size="sm" variant="outline" disabled={invoicePage === 0} onClick={() => setInvoicePage((p) => Math.max(0, p - 1))}>{tx("Prev", "পূর্ব")}</Button>
                          <span>{invoicePage + 1} / {invoicePageCount}</span>
                          <Button type="button" size="sm" variant="outline" disabled={invoicePage >= invoicePageCount - 1} onClick={() => setInvoicePage((p) => Math.min(invoicePageCount - 1, p + 1))}>{tx("Next", "পরবর্তী")}</Button>
                        </div>
                      )}
                      {a.reference_id && (
                        <Button type="button" size="sm" variant="link" className="h-6 px-0" onClick={() => openInvoiceDetails(displayInvoices.find((x) => x.id === a.reference_id))}>
                          {tx("View details", "বিস্তারিত দেখুন")}
                        </Button>
                      )}
                    </div>


                    )
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
                  <SelectItem value="bank">{tx("Scrap sale", "ভাংড়ী বিক্রি")}</SelectItem>
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
                      {!showDeleted && (isAdmin || canEditPayments) && p.status === "approved" && !p.voided_at && (
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
                            const irrAllocs = (p.payment_allocations ?? []).filter((a: any) => a.kind === "irrigation");
                            const refIds = irrAllocs.map((a: any) => a.reference_id).filter(Boolean);
                            const collectedFromOutstanding = irrAllocs.reduce((s: number, a: any) => s + Number(a.amount || 0), 0) || Number(p.amount || 0);
                            irrEnriched = await buildIrrigationReceiptEnrichment({
                              farmerId: p.farmer_id ?? null,
                              refIds,
                              paymentAmount: collectedFromOutstanding,
                              paymentNote: p.note ?? null,
                              memberNoFallback: p.farmers?.member_no ?? p.farmers?.farmer_code ?? null,
                            });
                          }


                          // বিবিধ আদায় (হাওলাত/ব্যাংক/দান/বিবিধ): জমি-সম্পর্কিত সারি বাদ, শুধু bill_info ধরন দেখাবে।
                          const miscLabels: Record<string, string> = {
                            hawlat: "হাওলাত গ্রহণ", bank: "ভাংড়ী বিক্রি", donation: "অনুদান", misc: "বিবিধ",
                          };
                          const catBn = miscLabels[(p.category as string) ?? ""] ?? null;
                          const isMiscCollection = kind === "irrigation" && !!catBn;
                          let villageUnion: string | null = null;
                          if (kind === "irrigation" && p.farmers?.union_id) {
                            const { data: u } = await db.from("unions").select("name_bn,name").eq("id", p.farmers.union_id).maybeSingle();
                            villageUnion = u?.name_bn || u?.name || null;
                          }
                          const rd: BnReceiptData = {
                            kind,
                            company_name: brand.company_name,
                            company_name_bn: brand.company_name_bn,
                            logo_url: brand.logo_url ?? null,
                            org: receiptArgs.org,
                            receipt_no: p.receipt_no || autoReceiptNo(prefix as any, p.id, new Date(p.created_at)),
                            date: p.created_at,
                            misc_collection: isMiscCollection || undefined,
                            bill_info: kind === "irrigation" ? (catBn ?? irrEnriched.bill_info ?? "সেচ চার্জ") : undefined,
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
                                  owner_self: irrEnriched.owner_self,
                                  land_owner_label: irrEnriched.land_owner_label,
                                  village_union: villageUnion,
                                  rate: irrEnriched.rate,
                                  member_summary: irrEnriched.member_summary,
                                  current_season_charge: irrEnriched.current_season_charge,
                                  penalty_amount: irrEnriched.penalty_amount,
                                  maintenance_charge: irrEnriched.maintenance_charge,
                                  canal_charge: irrEnriched.canal_charge,
                                  discount_amount: irrEnriched.discount_amount,
                                  total_outstanding: irrEnriched.total_outstanding,
                                  collected_from_outstanding: irrEnriched.collected_from_outstanding,
                                  remark: irrEnriched.remark,
                                  holding_description: irrEnriched.holding_description,
                                  patwari_name: irrEnriched.patwari_name,
                                  patwari_mobile: irrEnriched.patwari_mobile,
                                }
                              : {}),
                            collected_amount: Number(p.amount),
                            description,
                            collector_signature_url: receiptArgs.signatureUrl,
                            office_collector_signature_url: receiptArgs.signatureUrl,
                            verify_url: p.verify_token ? `${window.location.origin}/r/${p.verify_token}` : null,
                          };
                          return rd;
                        };
                        const doDownload = async (copy: ReceiptCopy) =>
                          downloadBnReceiptPdf(await buildReceiptData(), copy, receiptArgs.options);
                        const doPreview = async () => setPreview({ data: await buildReceiptData(), copy: kind === "irrigation" ? "farmer" : "both" });
                        return (
                          <>
                            <button
                              type="button"
                              hidden
                              aria-hidden="true"
                              data-auto-print={p.id}
                              onClick={() => doDownload(kind === "irrigation" ? "farmer" : "both")}
                            />
                            <span data-receipt-menu><ReceiptCopyMenu singleCopy={kind === "irrigation"} onSelect={doDownload} onPreview={kind === "irrigation" ? doPreview : undefined} title={t("printReceipt") || "Print Receipt"} /></span>
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
                    <MouzaSelect value={editForm.mouza} onChange={(v) => setEditForm(f => ({ ...f, mouza: v }))} />
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
              {editInvoiceId && editPreview && (
                <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{tx("Recalculated preview", "পুনঃগণনা প্রিভিউ")}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>{tx("Payable", "প্রদেয়")}<div className="font-semibold">{money(editPreview.payable)}</div></div>
                    <div>{tx("Paid", "পরিশোধিত")}<div className="font-semibold">{money(editPreview.paid)}</div></div>
                    <div>{tx("Due", "বকেয়া")}<div className="font-semibold">{money(editPreview.due)}</div></div>
                  </div>
                  <div className="text-xs text-muted-foreground">{tx("Status", "অবস্থা")}: {editPreview.status}</div>
                </div>
              )}
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

      <Dialog open={!!detailInvoice} onOpenChange={(o) => { if (!o) setDetailInvoice(null); }}>
        <DialogContent data-testid="invoice-details-modal">
          <DialogHeader>
            <DialogTitle>{tx("Invoice", "ইনভয়েস")} {detailInvoice?.invoice_no}</DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tx("Status", "স্ট্যাটাস")}</span><span>{invoiceStatusBadge(detailInvoice.invoice_status ?? null).label_bn}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{tx("Payable", "প্রদেয়")}</span><span className="font-mono">{money(detailInvoice.payable_amount ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{tx("Paid", "পরিশোধিত")}</span><span className="font-mono">{money(detailInvoice.paid_amount ?? 0)}</span></div>
              <div className="flex justify-between font-semibold"><span>{tx("Due", "বকেয়া")}</span><span className="font-mono">{money(detailInvoice.due_amount ?? 0)}</span></div>
              <div>
                <p className="mb-1 font-medium">{tx("Transaction history", "লেনদেন হিস্ট্রি")}</p>
                {detailTxns.length === 0 ? (
                  <div
                    data-testid="invoice-no-transactions"
                    role="status"
                    className="rounded-md border border-dashed p-3 text-center text-muted-foreground"
                  >
                    <p className="font-medium">{tx("No transactions yet", "এখনো কোনো লেনদেন নেই")}</p>
                    <p className="text-xs">{tx("This invoice has no payment records. It is shown as read-only.", "এই ইনভয়েসে কোনো পেমেন্ট রেকর্ড নেই। এটি কেবল-পঠন হিসেবে দেখানো হচ্ছে।")}</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {detailTxns.map((tItem) => (
                      <li key={tItem.id} className="flex justify-between">
                        <span>{fmtDate(tItem.created_at)}</span>
                        <span className="font-mono">{money(tItem.collected_amount ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
