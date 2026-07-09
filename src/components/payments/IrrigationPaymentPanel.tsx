import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { fetchOpenIrrigationInvoicesResult } from "@/lib/irrigationInvoiceQueries";
import { InvoiceStatusBadge } from "@/components/payments/InvoiceStatusBadge";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle, ChevronDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { downloadBnReceiptPdf, normalizeIrrigationRatePerAcre } from "@/lib/bnReceipts";
import { fetchPaymentReceiptData } from "@/lib/buildPaymentReceiptData";
import { useBranding } from "@/lib/branding";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { IrrigationReceiptPreviewDialog } from "@/components/receipts/IrrigationReceiptPreviewDialog";
import type { BnReceiptData, ReceiptCopy } from "@/lib/bnReceipts";
import { resolveFieldTypeLabel } from "@/lib/irrigationLandType";
import { safeWithRetry } from "@/lib/retryQueue";
import { logAudit } from "@/lib/audit";
import { exceedsDue } from "@/lib/irrigationPaymentMath";
import { verifyPaymentCoverage } from "@/lib/irrigationPaymentCoverage";
import { recalcInvoice } from "@/lib/invoiceRecalc";
import { resolveReceiptPatwari } from "@/lib/receiptPatwari";
import { verifyInvoiceConsistency } from "@/lib/invoiceBreakdown";
import { nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";
import { buildMemberSummary } from "@/lib/receiptMemberSummary";

// Shared select for open irrigation invoices (used by both initial load and reload).
const OPEN_INVOICE_SELECT =
  "id,invoice_no,season_id,office_id,land_id,owner_farmer_id,is_borga,due_date,due_amount,paid_amount,payable_amount,irrigation_amount,delay_fee,maintenance_amount,canal_amount,other_charge,season_rate,land_type_name,irrigation_category_name,invoice_status,deleted_at,seasons(name,year,status),lands(mouza,land_size,dag_no,field_type,notes,patwari_id),owner:farmers!irrigation_invoices_owner_farmer_id_fkey(name_bn,name_en,member_no,farmer_code,account_number,voter_number,savings_inactive,is_voter)";


type Invoice = {
  id: string;
  invoice_no: string;
  season_id: string;
  office_id: string | null;
  land_id: string | null;
  owner_farmer_id: string | null;
  is_borga: boolean | null;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  payable_amount: number;
  irrigation_amount: number;
  delay_fee: number;
  maintenance_amount: number;
  canal_amount: number;
  other_charge: number;
  season_rate?: number | null;
  land_type_name?: string | null;
  irrigation_category_name?: string | null;
  invoice_status?: string | null;
  deleted_at?: string | null;
  seasons?: { name: string | null; year: number | null; status: string | null } | null;
  lands?: {
    mouza: string | null;
    land_size: number | null;
    dag_no: string | null;
    field_type?: string | null;
    notes?: string | null;
    patwari_id?: string | null;
    patwaris?: { name: string | null; name_bn: string | null; mobile: string | null } | null;
  } | null;
  owner?: { name_bn: string | null; name_en: string | null; member_no?: string | null; farmer_code?: string | null; account_number?: string | null; voter_number?: string | null; savings_inactive?: boolean | null; is_voter?: boolean | null } | null;
};

// All money values are whole-taka (round figure). Land sizes keep decimals.
const roundTk = (n: number) => Math.round(Number(n) || 0);

export function IrrigationPaymentPanel({ initialFarmerId, onPaid }: { initialFarmerId?: string; onPaid?: () => void }) {
  const { t, tx, lang } = useLang();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();
  const { user, isAdmin, isSuper, roles } = useAuth();
  const [farmerId, setFarmerId] = useState(initialFarmerId ?? "");
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLoadError, setInvoiceLoadError] = useState<{ message: string; traceId: string | null } | null>(null);
  const [invoiceReloadTick, setInvoiceReloadTick] = useState(0);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPrevIds, setSelectedPrevIds] = useState<Set<string>>(new Set());
  // Post-submit status summary of the invoices this payment touched.
  const [paidStatuses, setPaidStatuses] = useState<Array<{ invoice_no: string; cleared: boolean }>>([]);
  // Last successful payment id — enables preview/re-download of the exact receipt.
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BnReceiptData | null>(null);
  // editable delay fees per invoice
  const [delayFee, setDelayFee] = useState<Record<string, number>>({});
  const [delayFeeReason, setDelayFeeReason] = useState<Record<string, string>>({});

  const [currentCollected, setCurrentCollected] = useState<number>(0);
  const [previousCollected, setPreviousCollected] = useState<number>(0);

  const [specialPermission, setSpecialPermission] = useState(false);
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseRemarks, setPromiseRemarks] = useState("");
  const [simplifiedReceipt, setSimplifiedReceipt] = useState(false);


  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  // Manual patwari selection — used when the land has no patwari linked.
  const [patwariList, setPatwariList] = useState<Array<{ id: string; name: string | null; name_bn: string | null; mobile: string | null }>>([]);
  const [manualPatwariId, setManualPatwariId] = useState<string>("");

  // Configurable: which roles may receive partial payments.
  const [allowedRoles, setAllowedRoles] = useState<string[]>(["super_admin"]);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Validation modal for unpaid dues.
  const [dueDialogOpen, setDueDialogOpen] = useState(false);
  const [dueDialogRows, setDueDialogRows] = useState<{ label: string; missing: number }[]>([]);
  const [patwariConfirmOpen, setPatwariConfirmOpen] = useState(false);



  const canDoPartial = isSuper || roles.some(r => allowedRoles.includes(r));

  async function hydrateLandPatwaris(rows: Invoice[]): Promise<Invoice[]> {
    const ids = Array.from(new Set(
      rows.map((inv) => inv.lands?.patwari_id).filter(Boolean) as string[],
    ));
    if (!ids.length) return rows;
    const { data } = await db.from("patwaris").select("id,name,name_bn,mobile").in("id", ids);
    const byId = new Map(((data as any[]) ?? []).map((p) => [p.id, p]));
    return rows.map((inv) => {
      const pid = inv.lands?.patwari_id;
      if (!pid || !byId.has(pid) || !inv.lands) return inv;
      return { ...inv, lands: { ...inv.lands, patwaris: byId.get(pid) } };
    });
  }

  const retryInvoiceLoad = () => setInvoiceReloadTick((v) => v + 1);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from("irrigation_partial_payment_settings")
        .select("id,allowed_roles")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettingsId(data.id as string);
        setAllowedRoles((data.allowed_roles as string[]) ?? ["super_admin"]);
      }
    })();
  }, []);

  async function toggleAllowedRole(role: string, checked: boolean) {
    const next = checked ? Array.from(new Set([...allowedRoles, role])) : allowedRoles.filter(r => r !== role);
    setAllowedRoles(next);
    setSavingSettings(true);
    try {
      if (settingsId) {
        const { error } = await db
          .from("irrigation_partial_payment_settings")
          .update({ allowed_roles: next, updated_by: user?.id })
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from("irrigation_partial_payment_settings")
          .insert({ allowed_roles: next, updated_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        setSettingsId(data!.id as string);
      }
      toast.success(tx("Settings saved", "সেটিংস সংরক্ষিত হয়েছে"));
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => { if (initialFarmerId) setFarmerId(initialFarmerId); }, [initialFarmerId]);

  // Load office-scoped patwaris so the collector can pick one when the land has none.
  useEffect(() => {
    const officeId = invoices.find((i) => i.office_id)?.office_id ?? null;
    let alive = true;
    (async () => {
      let q = db.from("patwaris").select("id,name,name_bn,mobile").eq("is_active", true).order("name_bn", { ascending: true });
      if (officeId) q = q.eq("office_id", officeId);
      const { data } = await q;
      if (alive) setPatwariList((data as any[]) ?? []);
    })();
    return () => { alive = false; };
  }, [invoices]);

  useEffect(() => {
    if (!farmerId) { setInvoices([]); return; }
    let alive = true;
    setLoading(true);
    setInvoiceLoadError(null);
    (async () => {
      try {
        const [{ data: act }, result] = await Promise.all([
          db.from("seasons").select("id").eq("status", "active").order("year", { ascending: false }).limit(1).maybeSingle(),
          fetchOpenIrrigationInvoicesResult<Invoice>(farmerId, OPEN_INVOICE_SELECT),
        ]);
        if (!alive) return;
        setActiveSeasonId(act?.id ?? null);
        if (result.error) {
          setInvoices([]);
          setInvoiceLoadError({ message: result.error.message, traceId: result.traceId });
          toast.error(
            tx(`Failed to load invoices (trace: ${result.traceId})`, `ইনভয়েস লোড ব্যর্থ (ট্রেস: ${result.traceId})`),
            { description: result.error.message, action: { label: tx("Retry", "আবার চেষ্টা"), onClick: retryInvoiceLoad } },
          );
        } else {
          const hydrated = await hydrateLandPatwaris((result.rows ?? []) as Invoice[]);
          if (!alive) return;
          setInvoices(hydrated);
          // Auto-check: warn if any stored due/payable disagrees with the model.
          const bad = hydrated.filter((inv) => !verifyInvoiceConsistency(inv as any).ok);
          if (bad.length) {
            toast.warning(
              tx(
                `${bad.length} invoice(s) have inconsistent due/total — please recalculate.`,
                `${bad.length} টি ইনভয়েসের বকেয়া/মোট মিলছে না — পুনরায় হিসাব করুন।`,
              ),
              { description: bad.map((b) => b.invoice_no).join(", ") },
            );
          }
        }

      } catch (e: any) {
        if (!alive) return;
        const traceId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}`;
        const message = e?.message ?? "Failed to load invoices";
        console.error(`[irrigation-invoices][${traceId}] panel fetch failed for farmer ${farmerId}:`, e);
        setInvoices([]);
        setInvoiceLoadError({ message, traceId });
        toast.error(
          tx(`Failed to load invoices (trace: ${traceId})`, `ইনভয়েস লোড ব্যর্থ (ট্রেস: ${traceId})`),
          { description: message, action: { label: tx("Retry", "আবার চেষ্টা"), onClick: retryInvoiceLoad } },
        );
      }

      setSelectedIds(new Set());
      setSelectedPrevIds(new Set());
      setDelayFee({});
      setDelayFeeReason({});
      setCurrentCollected(0);
      setPreviousCollected(0);
      setSpecialPermission(false);
      setPromiseDate("");
      setPromiseRemarks("");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [farmerId, invoiceReloadTick]);

  // "চলতি" সিজন = status=active সিজন যদি এই কৃষকের ইনভয়েস থাকে; নইলে কৃষকের
  // খোলা ইনভয়েসগুলোর মধ্যে সর্বশেষ বছরের সিজন। এতে active flag অন্য সিজনে থাকলেও
  // (যেমন Boro active কিন্তু ইনভয়েস আমন) হাল/বকেয়া সঠিকভাবে ভাগ হয়।
  const currentSeasonId = useMemo(() => {
    if (activeSeasonId && invoices.some(i => i.season_id === activeSeasonId)) return activeSeasonId;
    let best: string | null = null, bestYear = -Infinity, bestDate = "";
    for (const i of invoices) {
      const y = Number((i as any).seasons?.year ?? 0);
      const d = i.due_date ?? "";
      if (y > bestYear || (y === bestYear && d > bestDate)) { bestYear = y; bestDate = d; best = i.season_id; }
    }
    return best;
  }, [invoices, activeSeasonId]);
  const currentInvoices = useMemo(
    () => invoices.filter(i => currentSeasonId && i.season_id === currentSeasonId),
    [invoices, currentSeasonId],
  );
  const previousInvoices = useMemo(
    () => invoices.filter(i => !currentSeasonId || i.season_id !== currentSeasonId),
    [invoices, currentSeasonId],
  );
 
  // Admin-visible reconciliation: which season classifies as হাল, and the
  // computed হাল/জরিমানা totals used when generating the receipt.
  const currentSeasonLabel = useMemo(() => {
    const inv = invoices.find(i => i.season_id === currentSeasonId);
    return inv ? `${inv.seasons?.name ?? "—"} ${inv.seasons?.year ?? ""}`.trim() : "—";
  }, [invoices, currentSeasonId]);
  const halPenaltyReconciliation = useMemo(() => {
    const rows = invoices.map(inv => {
      const isHal = !!currentSeasonId && inv.season_id === currentSeasonId;
      const penalty = (delayFee[inv.id] ?? Number(inv.delay_fee || 0));
      const original = Number(inv.delay_fee || 0);
      return {
        id: inv.id,
        invoice_no: inv.invoice_no,
        season: `${inv.seasons?.name ?? "—"} ${inv.seasons?.year ?? ""}`.trim(),
        classification: isHal ? "hal" : "due",
        charge: Math.max(0, Number(inv.due_amount || 0) - original),
        penalty,
      };
    });
    const halCharge = rows.filter(r => r.classification === "hal").reduce((s, r) => s + r.charge, 0);
    const halPenalty = rows.filter(r => r.classification === "hal").reduce((s, r) => s + r.penalty, 0);
    const dueCharge = rows.filter(r => r.classification === "due").reduce((s, r) => s + r.charge, 0);
    const duePenalty = rows.filter(r => r.classification === "due").reduce((s, r) => s + r.penalty, 0);
    return { rows, halCharge, halPenalty, dueCharge, duePenalty };
  }, [invoices, currentSeasonId, delayFee]);
  // Auto-select all previous invoices by default; operator can deselect.
  useEffect(() => {
    setSelectedPrevIds(new Set(previousInvoices.map(i => i.id)));
  }, [previousInvoices]);

  const selectedPreviousInvoices = useMemo(
    () => previousInvoices.filter(i => selectedPrevIds.has(i.id)),
    [previousInvoices, selectedPrevIds],
  );

  const previousDueTotal = useMemo(
    () => selectedPreviousInvoices.reduce((s, i) => s + Number(i.due_amount || 0), 0),
    [selectedPreviousInvoices],
  );

  const selectedCurrentInvoices = useMemo(
    () => currentInvoices.filter(i => selectedIds.has(i.id)),
    [currentInvoices, selectedIds],
  );

  const currentPayable = useMemo(() => {
    return selectedCurrentInvoices.reduce((s, inv) => {
      const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
      const adjusted = Number(inv.due_amount) + (fee - Number(inv.delay_fee || 0));
      return s + Math.max(0, adjusted);
    }, 0);
  }, [selectedCurrentInvoices, delayFee]);

  // Auto-fill the "current received" box with the rounded selected payable.
  // Operator can still edit it manually for partial payments.
  useEffect(() => {
    setCurrentCollected(roundTk(currentPayable));
  }, [currentPayable]);

  // Auto-fill the "previous due received" box with the full previous due so the
  // operator only needs to confirm. They can still edit it for partial payments.
  useEffect(() => {
    setPreviousCollected(roundTk(previousDueTotal));
  }, [previousDueTotal]);

  const previousRemainingAfter = previousDueTotal - Number(previousCollected || 0);
  const blockedByPreviousDue = previousDueTotal > 0 && previousRemainingAfter > 0 && !specialPermission;

  const grandTotal = Number(currentCollected || 0) + Number(previousCollected || 0);

  function toggleInvoice(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function togglePrevInvoice(id: string) {
    setSelectedPrevIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Lands whose patwari will change if we proceed with the manually-selected
  // patwari — shown in the pre-payment confirmation dialog.
  const patwariUpdateTargets = useMemo(() => {
    if (!manualPatwariId) return [] as Array<{ land_id: string; mouza: string | null; dag_no: string | null; invoice_no: string }>;
    const seen = new Set<string>();
    const rows: Array<{ land_id: string; mouza: string | null; dag_no: string | null; invoice_no: string }> = [];
    for (const inv of [...selectedCurrentInvoices, ...selectedPreviousInvoices]) {
      const landId = inv.land_id;
      if (!landId || seen.has(landId)) continue;
      if ((inv.lands as any)?.patwari_id === manualPatwariId) continue;
      seen.add(landId);
      rows.push({ land_id: landId, mouza: inv.lands?.mouza ?? null, dag_no: inv.lands?.dag_no ?? null, invoice_no: inv.invoice_no });
    }
    return rows;
  }, [manualPatwariId, selectedCurrentInvoices, selectedPreviousInvoices]);

  const selectedPatwariName = useMemo(() => {
    const p = patwariList.find((x) => x.id === manualPatwariId);
    return p ? (lang === "bn" ? p.name_bn : p.name) || p.name_bn || p.name || "" : "";
  }, [patwariList, manualPatwariId, lang]);

  // Gate the Receive button: if the manual patwari will change lands, confirm first.
  function handleReceiveClick() {
    if (patwariUpdateTargets.length > 0) {
      setPatwariConfirmOpen(true);
      return;
    }
    void submit();
  }



  async function submit() {
    if (submitting) return;
    if (!farmerId) return toast.error(t("pickFarmer") || "Pick a farmer");
    if (grandTotal <= 0) return toast.error(tx("Enter an amount", "একটি পরিমাণ লিখুন"));
    if (Number(currentCollected) > 0 && selectedCurrentInvoices.length === 0) {
      return toast.error(tx("Select at least one current invoice", "অন্তত একটি বর্তমান ইনভয়েস বাছাই করুন"));
    }
    if (exceedsDue(Number(previousCollected), previousDueTotal)) {
      return toast.error(tx("Previous due collected exceeds previous due", "পূর্বের বকেয়া থেকে সংগৃহীত পূর্বের মোট বকেয়ার চেয়ে বেশি"));
    }
    // Received current amount must not exceed the sum of the selected current
    // invoices — each receipt maps to exactly one invoice's payable.
    if (Number(currentCollected || 0) - roundTk(currentPayable) > 0.5) {
      return toast.error(tx("Current collected exceeds the selected invoices total", "সংগৃহীত চলতি টাকা নির্বাচিত ইনভয়েসের মোটের চেয়ে বেশি"));
    }
    // Full-clearance rule: only roles allowed in settings (or super admins) may
    // accept a partial payment. Everyone else must fully clear all dues
    // (previous + current) before a receipt can be generated.
    const currentShortfall = roundTk(currentPayable) - Number(currentCollected || 0);
    const previousShortfall = previousRemainingAfter;
    if (!canDoPartial && (currentShortfall > 0.5 || previousShortfall > 0.5)) {
      const rows: { label: string; missing: number }[] = [];
      // Per-invoice current-season unpaid breakdown (covers multiple invoices).
      if (currentShortfall > 0.5) {
        for (const inv of selectedCurrentInvoices) {
          const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
          const adjusted = Math.max(0, Number(inv.due_amount) + (fee - Number(inv.delay_fee || 0)));
          if (adjusted > 0.5) rows.push({ label: `${tx("Current", "চলতি")} • ${inv.invoice_no}`, missing: adjusted });
        }
        if (rows.length === 0) rows.push({ label: tx("Current season charge", "চলতি সিজন চার্জ"), missing: currentShortfall });
      }
      if (previousShortfall > 0.5) {
        for (const inv of selectedPreviousInvoices) {
          if (Number(inv.due_amount) > 0.5) rows.push({ label: `${tx("Previous due", "আগের বকেয়া")} • ${inv.invoice_no}`, missing: Number(inv.due_amount) });
        }
      }
      setDueDialogRows(rows);
      setDueDialogOpen(true);
      // Audit the blocked attempt.
      logAudit({
        module: "irrigation_payment",
        action_type: "fail",
        office_id: (selectedCurrentInvoices[0]?.office_id ?? previousInvoices[0]?.office_id) ?? null,
        reference_id: farmerId,
        new_data: {
          reason: "unpaid_dues_block",
          farmer_id: farmerId,
          user_roles: roles,
          invoice_ids: [...selectedCurrentInvoices.map(i => i.id), ...previousInvoices.map(i => i.id)],
          missing_current: currentShortfall > 0.5 ? roundTk(currentShortfall) : 0,
          missing_previous: previousShortfall > 0.5 ? roundTk(previousShortfall) : 0,
        },
      });
      return;
    }
    if (blockedByPreviousDue && !canDoPartial) {
      return toast.error(tx("Previous irrigation due must be cleared first", "আগের সেচ বকেয়া সম্পূর্ণ পরিশোধ করতে হবে"));
    }
    if (specialPermission) {
      if (!promiseDate) return toast.error(tx("Promise date required", "প্রতিশ্রুতির তারিখ আবশ্যক"));
      if (!promiseRemarks.trim()) return toast.error(tx("Remarks required for special permission", "বিশেষ অনুমতির জন্য মন্তব্য আবশ্যক"));
    }

    setSubmitting(true);
    try {
      // Build the list of invoices that will actually receive money, allocating
      // the collected amounts oldest-first. EACH invoice becomes its OWN payment
      // record with its OWN receipt number so every invoice is tracked and
      // printed separately (even when multiple invoices are selected at once).
      const byDueDate = (a: Invoice, b: Invoice) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      const chargeItems: Array<{ inv: Invoice; take: number; isCurrent: boolean; newFee: number; originalFee: number }> = [];

      let remainingCurrent = Number(currentCollected || 0);
      for (const inv of [...selectedCurrentInvoices].sort(byDueDate)) {
        if (remainingCurrent <= 0) break;
        const originalFee = Number(inv.delay_fee || 0);
        const newFee = delayFee[inv.id] ?? originalFee;
        const adjustedDue = Math.max(0, Number(inv.due_amount) + (newFee - originalFee));
        const take = Math.min(remainingCurrent, adjustedDue);
        if (take <= 0) continue;
        chargeItems.push({ inv, take, isCurrent: true, newFee, originalFee });
        remainingCurrent -= take;
      }

      let remainingPrev = Number(previousCollected || 0);
      for (const inv of [...selectedPreviousInvoices].sort(byDueDate)) {
        if (remainingPrev <= 0) break;
        const take = Math.min(remainingPrev, Number(inv.due_amount));
        if (take <= 0) continue;
        const fee = Number(inv.delay_fee || 0);
        chargeItems.push({ inv, take, isCurrent: false, newFee: fee, originalFee: fee });
        remainingPrev -= take;
      }

      if (chargeItems.length === 0) {
        toast.error(tx("Nothing to collect", "সংগ্রহের কিছু নেই"));
        setSubmitting(false);
        return;
      }

      const { data: farmer } = await db
        .from("farmers")
        .select("mobile,office_id")
        .eq("id", farmerId)
        .maybeSingle();

      const touchedStatuses: Array<{ invoice_no: string; cleared: boolean }> = [];
      const createdReceipts: Array<{ paymentId: string; receiptNo: string; invoice_no: string }> = [];

      // Account codes for the split-ledger journal (looked up once, reused per payment).
      const codes = ["1010", "IRR-INCOME", "IRR-PREV-DUE", "IRR-DELAY", "IRR-MAINT", "IRR-CANAL"];
      const { data: accs } = await db.from("accounts").select("id,code").in("code", codes);
      const byCode = Object.fromEntries((accs ?? []).map((a: any) => [a.code, a.id]));

      for (const item of chargeItems) {
        const { inv, take, isCurrent, newFee, originalFee } = item;
        const officeId = inv.office_id ?? null;

        // Per-invoice receipt number (unified serial with offline fallback).
        const generatedReceiptNo = await nextUnifiedReceiptNo(officeId, "IRR");

        // 1) One payment row per invoice
        const { data: ins, error: payErr } = await db.from("payments").insert({
          farmer_id: farmerId,
          kind: "irrigation",
          amount: take,
          method,
          note: note || null,
          patwari_id: manualPatwariId || null,
          collected_by: user?.id,
          status: "approved",
          office_id: officeId,
          receipt_no: generatedReceiptNo,
        }).select("id, receipt_no").single();
        if (payErr) throw payErr;
        const paymentId = ins!.id as string;
        const receiptNo = String((ins as any)?.receipt_no ?? generatedReceiptNo ?? "").trim();
        if (!receiptNo) {
          throw new Error(tx("Receipt number was not generated", "রশিদ নম্বর তৈরি হয়নি"));
        }

        // 2) delay-fee override audit (current invoices only)
        if (isCurrent && newFee !== originalFee) {
          await db.from("irrigation_delay_fee_audit").insert({
            invoice_id: inv.id, payment_id: paymentId,
            original_amount: originalFee, modified_amount: newFee,
            reason: delayFeeReason[inv.id] || null,
            changed_by: user?.id, office_id: officeId,
          });
          logAudit({
            module: "delay_fee_override",
            action_type: "override",
            office_id: officeId,
            reference_id: inv.id,
            old_data: { delay_fee: originalFee },
            new_data: { delay_fee: newFee, reason: delayFeeReason[inv.id] || null, payment_id: paymentId },
          });
        }

        // 3) Update the invoice paid/due/status snapshot
        const newPaid = Number(inv.paid_amount) + take;
        const effectivePayable = isCurrent
          ? Number(inv.payable_amount) + (newFee - originalFee)
          : Number(inv.payable_amount);
        const newDue = Math.max(0, effectivePayable - newPaid);
        await db.from("irrigation_invoices")
          .update({
            paid_amount: newPaid,
            due_amount: newDue,
            invoice_status: newDue <= 0 ? "paid" : "partial_paid",
            ...(isCurrent && newFee !== originalFee ? { delay_fee: newFee, payable_amount: effectivePayable } : {}),
          })
          .eq("id", inv.id);

        // 4) Allocation row linking this payment to this invoice
        await db.from("irrigation_invoice_payments").insert({
          invoice_id: inv.id,
          payment_id: paymentId,
          office_id: officeId,
          collected_amount: take,
          irrigation_collected: take,
          current_invoice_collected: isCurrent ? take : 0,
          previous_due_collected: isCurrent ? 0 : take,
          delay_fee_original: isCurrent && newFee !== originalFee ? originalFee : null,
          delay_fee_override_reason: isCurrent && newFee !== originalFee ? (delayFeeReason[inv.id] || null) : null,
          created_by: user?.id,
        });

        // 5) Verify the persisted coverage for this single invoice
        const coverage = await verifyPaymentCoverage(paymentId, [inv.id], take);
        if (!coverage.ok) {
          console.warn("[irrigation-payment] coverage verification failed", coverage);
          toast.warning(tx(
            "Saved payment coverage could not be verified — please review",
            "সংরক্ষিত পেমেন্ট কভারেজ যাচাই করা যায়নি — অনুগ্রহ করে যাচাই করুন",
          ));
          logAudit({
            module: "irrigation_payment",
            action_type: "verify_fail",
            office_id: officeId,
            reference_id: paymentId,
            new_data: coverage as unknown as Record<string, unknown>,
          });
        }

        // 6) Split-ledger journal posting for this payment
        try {
          let irrPart = 0, delayPart = 0, maintPart = 0, canalPart = 0, prevPart = 0;
          if (isCurrent) {
            const delayCollected = newFee;
            const maintCollected = Number(inv.maintenance_amount || 0);
            const canalCollected = Number(inv.canal_amount || 0);
            const overheadTotal = delayCollected + maintCollected + canalCollected;
            const scale = overheadTotal > 0 ? Math.min(1, take / overheadTotal) : 0;
            delayPart = +(delayCollected * scale).toFixed(2);
            maintPart = +(maintCollected * scale).toFixed(2);
            canalPart = +(canalCollected * scale).toFixed(2);
            irrPart = +(take - delayPart - maintPart - canalPart).toFixed(2);
          } else {
            prevPart = +take.toFixed(2);
          }
          if (byCode["1010"]) {
            const { data: je, error: jeErr } = await db.from("journal_entries").insert({
              entry_date: new Date().toISOString().slice(0, 10),
              reference: `IRR-PAY-${paymentId.slice(0, 8)}`,
              description: `Irrigation payment ${paymentId.slice(0, 8)} (${inv.invoice_no})`,
              office_id: officeId,
              posted: true,
              posted_at: new Date().toISOString(),
              created_by: user?.id,
            }).select("id").single();
            if (!jeErr && je) {
              const lines: any[] = [
                { journal_id: je.id, account_id: byCode["1010"], debit: take, credit: 0, position: 0, description: "Cash received" },
              ];
              let pos = 1;
              const credits: Array<[string, number]> = [
                ["IRR-INCOME", irrPart],
                ["IRR-DELAY", delayPart],
                ["IRR-MAINT", maintPart],
                ["IRR-CANAL", canalPart],
                ["IRR-PREV-DUE", prevPart],
              ];
              for (const [code, amt] of credits) {
                if (amt > 0 && byCode[code]) {
                  lines.push({ journal_id: je.id, account_id: byCode[code], debit: 0, credit: amt, position: pos++, description: code });
                }
              }
              await db.from("journal_entry_lines").insert(lines);
            }
          }
        } catch (jErr) {
          console.warn("[irrigation-pay] journal posting failed", jErr);
        }

        // 7) Central audit log
        logAudit({
          module: "irrigation_payment",
          action_type: "create",
          office_id: officeId,
          reference_id: paymentId,
          new_data: {
            farmer_id: farmerId,
            amount: take,
            method,
            invoice_id: inv.id,
            invoice_no: inv.invoice_no,
            is_current: isCurrent,
            receipt_no: receiptNo,
          },
        });

        const cleared = recalcInvoice(effectivePayable, newPaid, { currentStatus: inv.invoice_status, dueDate: inv.due_date }).cleared;
        touchedStatuses.push({ invoice_no: inv.invoice_no, cleared });
        createdReceipts.push({ paymentId, receiptNo, invoice_no: inv.invoice_no });

        // 8) Separate receipt PDF per invoice — never blocks payment.
        const receiptResult = await safeWithRetry(
          "receipt_generation",
          async () => {
            const data = await fetchPaymentReceiptData(paymentId, { brand, receiptArgs, tx });
            await downloadBnReceiptPdf(data, "farmer", receiptArgs.options);
          },
          { referenceId: paymentId, payload: { kind: "irrigation", receipt_no: receiptNo, farmer_id: farmerId }, officeId: farmer?.office_id ?? null },
        );
        if (!receiptResult.ok) {
          toast.warning(tx(
            `Receipt generation failed for ${inv.invoice_no} — queued for retry`,
            `${inv.invoice_no} এর রসিদ তৈরি ব্যর্থ — রিট্রাই কিউতে যোগ হয়েছে`,
          ));
        }
      }

      // Promise record (special permission) — attach to the last created payment.
      const lastPayment = createdReceipts[createdReceipts.length - 1];
      if (specialPermission && lastPayment) {
        await db.from("irrigation_due_promises").insert({
          office_id: farmer?.office_id ?? null,
          farmer_id: farmerId,
          payment_id: lastPayment.paymentId,
          previous_due_amount: previousRemainingAfter,
          promise_date: promiseDate,
          remarks: promiseRemarks,
          approved_by: user?.id,
          status: "pending",
        });
        logAudit({
          module: "promise_date",
          action_type: "create",
          office_id: farmer?.office_id ?? null,
          reference_id: lastPayment.paymentId,
          new_data: { farmer_id: farmerId, promise_date: promiseDate, previous_due_amount: previousRemainingAfter, remarks: promiseRemarks },
        });
      }

      // Manual patwari → update the patwari on every land tied to the paid
      // invoices. Never blocks the payment/receipt; only warns on failure.
      if (manualPatwariId) {
        try {
          const landIds = Array.from(
            new Set(chargeItems.map((c) => c.inv.land_id).filter((id): id is string => !!id)),
          );
          const targetLands = landIds.filter((id) => {
            const inv = chargeItems.find((c) => c.inv.land_id === id)?.inv;
            return (inv?.lands as any)?.patwari_id !== manualPatwariId;
          });
          if (targetLands.length > 0) {
            const { error: landErr } = await db
              .from("lands")
              .update({ patwari_id: manualPatwariId })
              .in("id", targetLands);
            if (landErr) throw landErr;
            logAudit({
              module: "land_patwari_update",
              action_type: "update",
              office_id: farmer?.office_id ?? null,
              reference_id: farmerId,
              new_data: { patwari_id: manualPatwariId, land_ids: targetLands, source: "irrigation_payment" },
            });
          }
        } catch (patErr) {
          console.warn("[irrigation-pay] land patwari update failed", patErr);
          toast.warning(tx(
            "Land patwari could not be updated",
            "জমির পাটুয়ারী আপডেট করা যায়নি",
          ));
        }
      }

      // SMS summary — one message listing every receipt generated.
      if (farmer?.mobile) {
        const remaining = Math.max(0, previousDueTotal - Number(previousCollected || 0));
        const promiseLine = specialPermission && promiseDate
          ? `\n${tx("Promise date", "প্রতিশ্রুতির তারিখ")}: ${promiseDate}` : "";
        const receiptList = createdReceipts.map((r) => `${r.invoice_no}: ${r.receiptNo}`).join("\n");
        const message = tx(
          `Irrigation payment received.\nCurrent: BDT ${Number(currentCollected || 0).toLocaleString()}\nPrevious due: BDT ${Number(previousCollected || 0).toLocaleString()}\nRemaining previous due: BDT ${remaining.toLocaleString()}${promiseLine}\nReceipts:\n${receiptList}`,
          `সেচের পেমেন্ট গ্রহণ করা হয়েছে।\nবর্তমান: ৳${Number(currentCollected || 0).toLocaleString()}\nপূর্বের বকেয়া: ৳${Number(previousCollected || 0).toLocaleString()}\nঅবশিষ্ট পূর্বের বকেয়া: ৳${remaining.toLocaleString()}${promiseLine}\nরসিদসমূহ:\n${receiptList}`,
        );
        const smsResult = await safeWithRetry(
          "sms_send",
          async () => {
            const { error } = await db.functions.invoke("send-sms", { body: { mobile: farmer.mobile, message, event_type: "irrigation_payment", farmer_id: farmerId } });
            if (error) throw error;
          },
          { referenceId: lastPayment?.paymentId ?? farmerId, payload: { mobile: farmer.mobile, message, event_type: "irrigation_payment", farmer_id: farmerId }, officeId: farmer?.office_id ?? null },
        );
        if (!smsResult.ok) {
          toast.warning(tx("SMS send failed — queued for retry", "SMS পাঠানো ব্যর্থ — রিট্রাই কিউতে যোগ হয়েছে"));
        }
      }

      toast.success(
        tx("Payment recorded", "পেমেন্ট সংরক্ষিত হয়েছে"),
        createdReceipts.length === 1
          ? { description: tx(`Receipt #: ${createdReceipts[0].receiptNo}`, `রসিদ নং: ${createdReceipts[0].receiptNo}`) }
          : { description: tx(`${createdReceipts.length} receipts generated`, `${createdReceipts.length}টি রসিদ তৈরি হয়েছে`) },
      );
      setPaidStatuses(touchedStatuses);
      setLastPaymentId(lastPayment?.paymentId ?? null);
      // refresh
      setFarmerId(farmerId);
      setCurrentCollected(0);
      setPreviousCollected(0);
      setSelectedIds(new Set());
      setSpecialPermission(false);
      setPromiseDate("");
      setPromiseRemarks("");
      setNote("");
      setManualPatwariId("");
      onPaid?.();
      // re-trigger load (shared util keeps filtering identical)
      const refreshed = await fetchOpenIrrigationInvoicesResult<Invoice>(farmerId, OPEN_INVOICE_SELECT);
      if (refreshed.error) {
        setInvoiceLoadError({ message: refreshed.error.message, traceId: refreshed.traceId });
      } else {
        setInvoiceLoadError(null);
        setInvoices(await hydrateLandPatwaris((refreshed.rows ?? []) as Invoice[]));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label>{tx("Select farmer", "ফার্মার বাছাই")}</Label>
        <FarmerSearchSelect blockInactive value={farmerId || null} onChange={(id) => setFarmerId(id ?? "")} />
      </Card>

      {paidStatuses.length > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <div className="mb-1 font-medium">{tx("Invoice status after payment", "পেমেন্টের পর ইনভয়েসের অবস্থা")}</div>
            <div className="flex flex-wrap gap-2">
              {paidStatuses.map((s) => (
                <Badge key={s.invoice_no} variant={s.cleared ? "default" : "secondary"} className="font-mono">
                  {s.invoice_no}: {s.cleared ? tx("Cleared", "পরিশোধিত") : tx("Pending", "বকেয়া")}
                </Badge>
              ))}
            </div>
            {lastPaymentId && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      setPreviewData(await fetchPaymentReceiptData(lastPaymentId, { brand, receiptArgs, tx }));
                    } catch (e: any) {
                      toast.error(e?.message ?? tx("Receipt preview failed", "রসিদ প্রিভিউ ব্যর্থ"));
                    }
                  }}
                >
                  {tx("Preview receipt", "রসিদ প্রিভিউ")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const data = await fetchPaymentReceiptData(lastPaymentId, { brand, receiptArgs, tx });
                      await downloadBnReceiptPdf(data, "farmer", receiptArgs.options);
                    } catch (e: any) {
                      toast.error(e?.message ?? tx("Receipt download failed", "রসিদ ডাউনলোড ব্যর্থ"));
                    }
                  }}
                >
                  {tx("Download receipt", "রসিদ ডাউনলোড")}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <IrrigationReceiptPreviewDialog
        open={!!previewData}
        onOpenChange={(o) => !o && setPreviewData(null)}
        data={previewData}
        copy="farmer"
        options={receiptArgs.options}
      />




      {farmerId && loading && (
        <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> {tx("Loading…", "লোড হচ্ছে…")}</div>
      )}

      {farmerId && !loading && invoiceLoadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {tx("Could not load irrigation invoices.", "সেচ ইনভয়েস লোড করা যায়নি।")}
              {invoiceLoadError.traceId ? ` Trace: ${invoiceLoadError.traceId}` : ""}
              <br />
              <span className="text-xs">{invoiceLoadError.message}</span>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={retryInvoiceLoad}>{tx("Retry", "আবার চেষ্টা")}</Button>
          </AlertDescription>
        </Alert>
      )}

      {farmerId && !loading && !invoiceLoadError && invoices.length === 0 && (
        <Alert><AlertDescription>{tx("No outstanding irrigation invoices for this farmer.", "এই ফার্মারের কোনো বকেয়া সেচ ইনভয়েস নেই।")}</AlertDescription></Alert>
      )}

      {farmerId && !loading && invoices.length > 0 && (isAdmin || isSuper) && (
        <Card className="p-4 space-y-3 border-sky-300 dark:border-sky-800">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{tx("Season classification & receipt breakdown", "সিজন শ্রেণিবিন্যাস ও রশিদ ব্রেকডাউন")}</h3>
            <Badge variant="outline" className="text-[10px]">{tx("Admin", "অ্যাডমিন")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {tx("Season classified as হাল (current)", "হাল (চলতি) হিসেবে বিবেচিত সিজন")}:{" "}
            <span className="font-semibold text-foreground">{currentSeasonLabel}</span>
            {" · "}
            {activeSeasonId && invoices.some(i => i.season_id === activeSeasonId)
              ? tx("(from global active season)", "(গ্লোবাল সক্রিয় সিজন থেকে)")
              : tx("(latest-year fallback)", "(সর্বশেষ বছরের ফলব্যাক)")}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead>{tx("Class", "শ্রেণি")}</TableHead>
                <TableHead className="text-right">{tx("Charge", "চার্জ")}</TableHead>
                <TableHead className="text-right">{tx("Penalty (জরিমানা)", "জরিমানা")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {halPenaltyReconciliation.rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                  <TableCell className="text-xs">{r.season}</TableCell>
                  <TableCell>
                    <Badge variant={r.classification === "hal" ? "default" : "outline"} className="text-[10px]">
                      {r.classification === "hal" ? tx("হাল", "হাল") : tx("বকেয়া", "বকেয়া")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{money(r.charge)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{money(r.penalty)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
            <div>{tx("হাল charge", "হাল চার্জ")}: <span className="font-mono font-semibold">{money(halPenaltyReconciliation.halCharge)}</span></div>
            <div>{tx("হাল penalty", "হাল জরিমানা")}: <span className="font-mono font-semibold">{money(halPenaltyReconciliation.halPenalty)}</span></div>
            <div>{tx("বকেয়া charge", "বকেয়া চার্জ")}: <span className="font-mono font-semibold">{money(halPenaltyReconciliation.dueCharge)}</span></div>
            <div>{tx("বকেয়া penalty", "বকেয়া জরিমানা")}: <span className="font-mono font-semibold">{money(halPenaltyReconciliation.duePenalty)}</span></div>
          </div>
        </Card>
      )}


      {farmerId && !loading && currentInvoices.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">{tx("Current Invoice (বর্তমান বকেয়া)", "বর্তমান বকেয়া")}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                <TableHead>{tx("Owner", "মালিক")}</TableHead>
                <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                <TableHead className="text-right">{tx("Land", "জমি")}</TableHead>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
                <TableHead className="text-right">{tx("Delay Fee", "জরিমানা")}</TableHead>
                <TableHead className="text-right">{tx("Maintenance", "রক্ষণাবেক্ষণ")}</TableHead>
                <TableHead className="text-right">{tx("Canal", "ক্যানেল")}</TableHead>
                <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentInvoices.map(inv => {
                const checked = selectedIds.has(inv.id);
                const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
                const original = Number(inv.delay_fee || 0);
                const overridden = fee !== original;
                return (
                  <>
                    <TableRow key={inv.id} className={checked ? "bg-muted/30" : ""}>
                      <TableCell><input type="checkbox" checked={checked} onChange={() => toggleInvoice(inv.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.invoice_no}
                        <InvoiceStatusBadge status={(inv as any).invoice_status} className="ml-1" />
                      </TableCell>
                      <TableCell className="text-xs">
                        {(inv.owner?.name_bn || inv.owner?.name_en || "—")}
                        {inv.is_borga && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{tx("Borga", "বর্গা")}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{inv.lands?.mouza || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{inv.lands?.land_size ?? "—"}</TableCell>
                      <TableCell className="text-xs">{inv.seasons?.name} {inv.seasons?.year}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.irrigation_amount)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number" step={1} className="h-7 text-xs text-right w-24 ml-auto font-mono"
                          value={fee}
                          title={tx("Enter delay fee / penalty", "জরিমানা লিখুন")}
                          onChange={(e) => setDelayFee(p => ({ ...p, [inv.id]: roundTk(Number(e.target.value || 0)) }))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.maintenance_amount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.canal_amount)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{money(Number(inv.due_amount) + (fee - original))}</TableCell>
                    </TableRow>
                    {overridden && (
                      <TableRow key={inv.id + "-r"}>
                        <TableCell colSpan={11} className="bg-amber-50/40 dark:bg-amber-950/20">
                          <div className="flex items-center gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>{tx("Delay fee overridden — reason required", "বিলম্ব ফি পরিবর্তিত — কারণ আবশ্যক")}:</span>
                            <Input
                              className="h-7 text-xs flex-1"
                              value={delayFeeReason[inv.id] ?? ""}
                              onChange={(e) => setDelayFeeReason(p => ({ ...p, [inv.id]: e.target.value }))}
                              placeholder={tx("Reason for override", "পরিবর্তনের কারণ")}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              {tx("Selected payable", "বাছাইকৃত পরিশোধযোগ্য")}: <span className="font-mono font-semibold">{money(currentPayable)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">{tx("Current invoice received (বকেয়া)", "বকেয়া হতে গৃহীত")}</Label>
              <Input
                type="number" step={1} className="w-32 font-mono"
                value={currentCollected || ""}
                onChange={(e) => setCurrentCollected(roundTk(Number(e.target.value || 0)))}
              />
            </div>
          </div>
        </Card>
      )}

      {farmerId && !loading && previousInvoices.length > 0 && (
        <Card className="p-4 space-y-3 border-amber-300 dark:border-amber-800">
          <Alert variant="destructive" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {tx("This farmer has previous-season unpaid irrigation invoices.", "এই কৃষকের পূর্বের বকেয়া ইনভয়েস রয়েছে")}
            </AlertDescription>
          </Alert>
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
              <ChevronDown className="h-4 w-4" /> {tx("Previous unpaid invoices", "পূর্বের অপরিশোধিত ইনভয়েস")} ({previousInvoices.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{tx("Season", "সিজন")}</TableHead>
                  <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                  <TableHead>{tx("Due Date", "নির্ধারিত তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {previousInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPrevIds.has(inv.id)}
                          onCheckedChange={() => togglePrevInvoice(inv.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{inv.seasons?.name} {inv.seasons?.year}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                      <TableCell className="text-xs">{fmtDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right font-mono">{money(inv.due_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              {tx("Previous due total", "মোট পূর্বের বকেয়া")}: <span className="font-mono font-semibold">{money(previousDueTotal)}</span>
              {selectedPreviousInvoices.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({selectedPreviousInvoices.map(i => `${i.invoice_no} ${money(i.due_amount)}`).join(" + ")})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">{tx("Previous due received (পূর্বের বকেয়া হতে)", "পূর্বের বকেয়া হতে গৃহীত")}</Label>
              <Input
                type="number" step={1} className="w-32 font-mono"
                value={previousCollected || ""}
                onChange={(e) => setPreviousCollected(roundTk(Number(e.target.value || 0)))}
              />
            </div>
          </div>

          {previousDueTotal > 0 && previousRemainingAfter > 0 && canDoPartial && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={specialPermission} onCheckedChange={setSpecialPermission} />
                  <span>{tx("Accept under special permission (বিশেষ অনুমতিতে গ্রহণ)", "বিশেষ অনুমতিতে গ্রহণ করুন")}</span>
                </Label>
                <Badge variant="outline">{tx("Remaining after this payment", "বাকি থাকবে")}: {money(previousRemainingAfter)}</Badge>
              </div>
              {specialPermission && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{tx("Promise date", "প্রতিশ্রুতির তারিখ")} *</Label>
                    <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{tx("Remarks", "মন্তব্য")} *</Label>
                    <Input value={promiseRemarks} onChange={(e) => setPromiseRemarks(e.target.value)} placeholder={tx("e.g. will clear by Jul 31", "যেমন: ৩১ জুলাইয়ের মধ্যে পরিশোধ করবে")} />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {farmerId && !loading && invoices.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{tx("Method", "পেমেন্ট মাধ্যম")}</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Note", "নোট")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {!invoices.some((i) => i.lands?.patwaris) && (
              <div data-testid="manual-patwari-block">
                <Label>{tx("Patwari (manual)", "পাটোয়ারি (ম্যানুয়াল)")}</Label>
                <Select value={manualPatwariId} onValueChange={setManualPatwariId}>
                  <SelectTrigger data-testid="manual-patwari-select">
                    <SelectValue placeholder={tx("Select patwari", "পাটোয়ারি নির্বাচন করুন")} />
                  </SelectTrigger>
                  <SelectContent>
                    {patwariList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {(p.name_bn || p.name) ?? "—"}{p.mobile ? ` — ${p.mobile}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {tx("Land has no patwari linked; the selected patwari will appear on the receipt.", "জমিতে পাটোয়ারি যুক্ত নেই; নির্বাচিত পাটোয়ারি রসিদে দেখাবে।")}
                </p>
              </div>
            )}
          </div>
          <Label className="hidden items-center gap-2 cursor-pointer text-sm">
            <Switch checked={simplifiedReceipt} onCheckedChange={setSimplifiedReceipt} />
            <span>{tx("Simplified receipt (only farmer + amount + remark)", "সরল রসিদ (শুধু কৃষক + পরিমাণ + মন্তব্য)")}</span>
          </Label>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-base">
              <div className="text-xs text-muted-foreground">{tx("Grand total received", "মোট গ্রহণ")}</div>
              <div className="text-2xl font-mono font-bold">{money(grandTotal)}</div>
            </div>
            <Button size="lg" onClick={handleReceiveClick} disabled={submitting || grandTotal <= 0 || (blockedByPreviousDue && canDoPartial)}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{tx("Saving…", "সংরক্ষণ…")}</> : <><CheckCircle2 className="h-4 w-4 mr-2" />{tx("Receive Payment", "পেমেন্ট গ্রহণ")}</>}
            </Button>
          </div>
          {blockedByPreviousDue && canDoPartial && (
            <p className="text-xs text-destructive">{tx("Submit blocked: previous irrigation due not fully cleared. Enable special permission to bypass.", "জমা করা যাবে না: আগের সেচ বকেয়া পরিশোধ হয়নি। অনুমতি দিতে চাইলে বিশেষ অনুমতি চালু করুন।")}</p>
          )}
          {!canDoPartial && (
            <p className="text-xs text-muted-foreground">{tx("All dues (previous + current) must be fully cleared to generate a receipt.", "রশিদ জেনারেট করতে সকল বকেয়া (আগের + চলতি) সম্পূর্ণ পরিশোধ করতে হবে।")}</p>
          )}
        </Card>
      )}

      {isSuper && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium">{tx("Partial payment permission (Super Admin)", "আংশিক পেমেন্ট অনুমতি (সুপার অ্যাডমিন)")}</div>
          <p className="text-xs text-muted-foreground">{tx("Select which roles may receive partial payments. All other roles must fully clear dues.", "কোন রোলগুলো আংশিক পেমেন্ট নিতে পারবে তা বাছাই করুন। বাকি সব রোলকে সম্পূর্ণ বকেয়া পরিশোধ করতে হবে।")}</p>
          <div className="flex flex-wrap gap-4 pt-1">
            {(["super_admin", "admin", "committee", "staff"] as const).map(r => (
              <Label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={allowedRoles.includes(r)}
                  disabled={r === "super_admin" || savingSettings}
                  onCheckedChange={(c) => toggleAllowedRole(r, Boolean(c))}
                />
                <span>{r}</span>
              </Label>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={dueDialogOpen} onOpenChange={setDueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {tx("Dues not fully cleared", "বকেয়া সম্পূর্ণ পরিশোধ হয়নি")}
            </DialogTitle>
            <DialogDescription>
              {tx("A receipt cannot be generated until all of the following dues are fully paid.", "নিচের সকল বকেয়া সম্পূর্ণ পরিশোধ না হওয়া পর্যন্ত রশিদ জেনারেট করা যাবে না।")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                  <TableHead className="text-right">{tx("Unpaid", "বকেয়া")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueDialogRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.missing)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">{tx("Total unpaid", "মোট বকেয়া")}</span>
            <span className="font-mono font-bold">{money(dueDialogRows.reduce((s, r) => s + r.missing, 0))}</span>
          </div>
          <DialogFooter>
            <Button onClick={() => setDueDialogOpen(false)}>{tx("OK, fix it", "ঠিক আছে, সংশোধন করি")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
