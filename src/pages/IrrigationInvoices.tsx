import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { postIrrigationDiscount, takeLastImbalance, checkRequiredAccounts, formatImbalance } from "@/lib/accountingPosting";
import { resolveRowMouzaName } from "@/lib/mouzaQuery";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { formatLandSize } from "@/lib/irrigationCalc";
import { matchesDagSearch, formatDagNumbers } from "@/lib/dagNumbers";
import {
  calcInvoice, getChargeSettings, generateInvoiceNo, resolveBilledFarmer, resolveBillingSplits, describeBaseCalculation,
  DEFAULT_SETTINGS, type ChargeSettings, type InvoiceStatus,
} from "@/lib/irrigationInvoice";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";
import { resolveIrrigationRate, type CategoryRateInput } from "@/lib/irrigationRateResolver";
import { Sparkles, Plus, Eye, Ban, RefreshCw, ShieldCheck, AlertTriangle, FileSpreadsheet, FileDown, Pencil, Trash2, Printer, Settings as SettingsIcon, Share2, MessageCircle, Mail, Files, ChevronsUpDown, Check, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { exportInvoicesXLSX, exportInvoicesCSV } from "@/lib/irrigationExports";
import { exportTablePDF } from "@/lib/exports";
import { logAudit } from "@/lib/audit";
import { validateDiscount, computeInvoiceTotals, grossAmount, canEditInvoice } from "@/lib/invoiceDiscount";
import {
  downloadIrrigationInvoicePdf, previewIrrigationInvoicePdf,
  downloadIrrigationInvoicesBulkPdf, previewIrrigationInvoicesBulkPdf,
  shareIrrigationInvoicePdf, buildWhatsAppShareLink, buildMailtoLink,
  loadInvoiceSettings, saveInvoiceSettings, loadLastInvoiceCopy, saveLastInvoiceCopy,
  DEFAULT_INVOICE_SETTINGS, PRINTER_PRESETS, type InvoiceCopy, type InvoicePdfSettings,
} from "@/lib/irrigationInvoicePdf";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { OfficeIncomeTab } from "@/pages/irrigation/OfficeIncomeTab";

type Invoice = any;

/**
 * Land area that was billed on this invoice, frozen at generation time.
 * Always prefer the snapshot so that editing a farmer's land later (e.g. .33 → .40)
 * does NOT retroactively change the area shown on past-season invoices/receipts.
 */
function invoiceLandSize(inv: any): number | undefined {
  const snap = inv?.calculation_snapshot;
  const v = snap?.billed_area_shotok ?? snap?.land_size_shotok ?? snap?.parcel_size_shotok;
  if (v != null && Number(v) > 0) return Number(v);
  return inv?.lands?.land_size;
}

const mouzaName = (r: any) => resolveRowMouzaName(r);

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  generated: "secondary",
  partial_paid: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
};

function statusLabel(tx: (en: string, bn: string) => string, st: InvoiceStatus) {
  switch (st) {
    case "draft": return tx("Draft", "খসড়া");
    case "generated": return tx("Issued", "ইস্যু");
    case "partial_paid": return tx("Partial", "আংশিক");
    case "paid": return tx("Paid", "পরিশোধিত");
    case "overdue": return tx("Overdue", "মেয়াদোত্তীর্ণ");
    case "cancelled": return tx("Cancelled", "বাতিল");
  }
}

export default function IrrigationInvoices() {
  const { t, tx, lang } = useLang();
  const { user, isSuper } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [tab, setTab] = useState<"generate" | "list" | "settings" | "office_income">("list");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  useEffect(() => {
    document.title = `${tx("Irrigation Invoices", "সেচ ইনভয়েস")} — ${t("appName")}`;
    Promise.all([
      db.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      db.from("offices").select("id,name").order("name"),
    ]).then(([s, o]) => { setSeasons(s.data ?? []); setOffices(o.data ?? []); });
  }, []);

  return (
    <>
      <PageHeader title={tx("Irrigation Invoices", "সেচ ইনভয়েস")} description={tx("Create, list and configure invoices. Receive payments from the Payments page.", "ইনভয়েস তৈরি, তালিকা ও সেটিংস। অর্থ গ্রহণ পেমেন্ট পেজ থেকে করুন।")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="list">{tx("Invoice list", "ইনভয়েস তালিকা")}</TabsTrigger>
          <TabsTrigger value="generate">{tx("Create invoice", "ইনভয়েস তৈরি")}</TabsTrigger>
          <TabsTrigger value="settings">{tx("Settings", "সেটিংস")}</TabsTrigger>
          <TabsTrigger value="office_income">{tx("Office income", "অফিস আয়")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list"><InvoiceListTab seasons={seasons} offices={offices} isSuper={isSuper} /></TabsContent>
        <TabsContent value="generate"><GenerateTab seasons={seasons} offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
        <TabsContent value="settings"><SettingsTab offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
        <TabsContent value="office_income"><OfficeIncomeTab offices={offices} userId={user?.id} /></TabsContent>
      </Tabs>
      {confirmDialog}
    </>
  );
}

function InvoiceListTab({ seasons, offices, isSuper }: any) {
  const { tx, lang } = useLang();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const persisted = useMemo<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("irr_invoice_filters") || "{}"); } catch { return {}; }
  }, []);
  const [seasonId, setSeasonId] = useState(persisted.seasonId ?? "all");
  const [officeId, setOfficeId] = useState(persisted.officeId ?? "all");
  const [mouza, setMouza] = useState(persisted.mouza ?? "all");
  const [status, setStatus] = useState<string>(persisted.status ?? "all");
  const [search, setSearch] = useState(persisted.search ?? "");
  const [mouzaSort, setMouzaSort] = useState<"none" | "asc" | "desc">("none");
  const [mouzaOpen, setMouzaOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("irr_invoice_filters", JSON.stringify({ seasonId, officeId, mouza, status, search }));
  }, [seasonId, officeId, mouza, status, search]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfSettingsOpen, setPdfSettingsOpen] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<InvoicePdfSettings>(() => loadInvoiceSettings());
  const [lastCopy, setLastCopy] = useState<InvoiceCopy>(() => loadLastInvoiceCopy());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string | null; username: string | null }>>([]);

  useEffect(() => {
    db.from("profiles").select("id,full_name,username").order("full_name").limit(500)
      .then(({ data }) => setStaff((data as any) ?? []));
  }, []);

  async function load() {
    setLoading(true);
    let q = db
      .from("irrigation_invoices" as any)
      .select("*, farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn,farmer_code,mobile), lands(dag_no,land_size,mouza,mouzas(name)), seasons(name,year,type), irrigation_invoice_payments(payments(receipt_no))")
      .is("deleted_at", null)
      .order("generated_at", { ascending: false })
      .limit(500);
    if (seasonId !== "all") q = q.eq("season_id", seasonId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    if (status === "due") {
      // Unified outstanding view: any non-cancelled invoice with money still owed.
      q = q.gt("due_amount", 0).neq("invoice_status", "cancelled");
    } else if (status !== "all") {
      q = q.eq("invoice_status", status);
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); }, [seasonId, officeId, status]);

  const mouzaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows as any[]) {
      const m = mouzaName(r);
      if (m) set.add(m);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let base = rows as any[];
    if (mouza !== "all") base = base.filter((r) => mouzaName(r) === mouza);
    const s = search.trim().toLowerCase();
    if (s) {
      base = base.filter((r: any) =>
        r.invoice_no?.toLowerCase().includes(s) ||
        r.farmers?.name_en?.toLowerCase().includes(s) ||
        r.farmers?.name_bn?.toLowerCase().includes(s) ||
        r.farmers?.farmer_code?.toLowerCase().includes(s) ||
        r.farmers?.mobile?.includes(s) ||
        matchesDagSearch(r.lands?.dag_no, s) ||
        mouzaName(r).toLowerCase().includes(s) ||
        (r.irrigation_invoice_payments ?? []).some((p: any) =>
          p?.payments?.receipt_no?.toLowerCase?.().includes(s))
      );
    }
    if (mouzaSort !== "none") {
      base = [...base].sort((a, b) => {
        const cmp = mouzaName(a).localeCompare(mouzaName(b), "bn");
        return mouzaSort === "asc" ? cmp : -cmp;
      });
    }
    return base;
  }, [rows, search, mouza, mouzaSort]);


  /** Grand totals for the currently-filtered invoices (footer summary).
   *  carried_forward invoices are excluded — their balance has already been
   *  rolled into a target invoice, so counting them would double the totals. */
  const grandTotals = useMemo(() => {
    return (filtered as any[])
      .filter((r) => r.invoice_status !== "carried_forward")
      .reduce(
        (acc, r) => {
          acc.payable += Number(r.payable_amount) || 0;
          acc.paid += Number(r.paid_amount) || 0;
          acc.due += Number(r.due_amount) || 0;
          return acc;
        },
        { payable: 0, paid: 0, due: 0 },
      );
  }, [filtered]);

  /** Farmer-wise aggregate of the currently-loaded invoices (payable/paid/due). */
  const farmerSummary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; payable: number; paid: number; due: number; count: number }>();
    for (const r of filtered as any[]) {
      const id = r.farmer_id;
      if (!id) continue;
      if (r.invoice_status === "carried_forward") continue;
      const cur = map.get(id) ?? {
        id,
        name: r.farmers?.name_bn || r.farmers?.name_en || "—",
        code: r.farmers?.farmer_code || "",
        payable: 0, paid: 0, due: 0, count: 0,
      };
      cur.payable += Number(r.payable_amount) || 0;
      cur.paid += Number(r.paid_amount) || 0;
      cur.due += Number(r.due_amount) || 0;
      cur.count += 1;
      map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.due - a.due);
  }, [filtered]);
  const [showFarmerSummary, setShowFarmerSummary] = useState(false);

  async function cancelInvoice(inv: any) {
    const ok = await confirm({
      title: tx("Cancel invoice?", "ইনভয়েস বাতিল করুন?"),
      description: `${inv.invoice_no} — ${money(inv.payable_amount)} ${tx("BDT. This cannot be undone.", "টাকা। এটি পুনরুদ্ধার করা যাবে না।")}`,
      destructive: true, confirmText: tx("Cancel it", "বাতিল করুন"),
    });
    if (!ok) return;
    const { error } = await db
      .from("irrigation_invoices" as any)
      .update({ invoice_status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Manually cancelled" } as any)
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(tx("Invoice cancelled", "ইনভয়েস বাতিল করা হয়েছে")); load();
  }

  async function deleteInvoice(inv: any) {
    const ok = await confirm({
      title: tx("Delete invoice?", "ইনভয়েস মুছে ফেলবেন?"),
      description: `${inv.invoice_no} — ${tx("Deleted invoices won't appear in the list.", "মুছে ফেলা ইনভয়েস তালিকায় দেখাবে না।")}`,
      destructive: true, confirmText: tx("Delete", "মুছুন"),
    });
    if (!ok) return;
    const { error } = await db
      .from("irrigation_invoices" as any)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(tx("Invoice deleted", "ইনভয়েস মুছে ফেলা হয়েছে")); load();
  }

  function buildInvoicePdfPayload(inv: any) {
    return {
      invoice_no: inv.invoice_no,
      generated_at: inv.generated_at,
      due_date: inv.due_date,
      is_borga: inv.is_borga,
      note: inv.note,
      irrigation_amount: inv.irrigation_amount,
      maintenance_amount: inv.maintenance_amount,
      canal_amount: inv.canal_amount,
      other_charge: inv.other_charge,
      delay_fee: inv.delay_fee,
      payable_amount: inv.payable_amount,
      paid_amount: inv.paid_amount,
      due_amount: inv.due_amount,
      previous_due_amount: inv.previous_due_amount,
      invoice_status: inv.invoice_status,
      rate_source: inv.rate_source ?? (inv.is_manual_rate ? "MANUAL" : "STANDARD"),
      applied_rate: inv.applied_rate ?? inv.season_rate ?? null,
      original_standard_rate: inv.original_standard_rate ?? null,
      irrigation_category_name: inv.irrigation_category_name ?? null,
      farmer: {
        name: inv.farmers?.name_bn ?? inv.farmers?.name_en,
        farmer_code: inv.farmers?.farmer_code,
        mobile: inv.farmers?.mobile,
        village: inv.farmers?.village ?? null,
      },
      land: {
        mouza: mouzaName(inv),
        dag_no: inv.lands?.dag_no,
        // Use the land area frozen on the invoice at generation time, NOT the
        // farmer's current (possibly edited) land — past seasons must keep their
        // original area even after the land is later increased.
        land_size: invoiceLandSize(inv),
      },
      season: inv.seasons,
    };
  }

  async function downloadInvoice(inv: any, copy: InvoiceCopy) {
    try {
      saveLastInvoiceCopy(copy);
      setLastCopy(copy);
      await downloadIrrigationInvoicePdf(buildInvoicePdfPayload(inv), copy, pdfSettings);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to generate PDF", "পিডিএফ তৈরি ব্যর্থ"));
    }
  }

  async function previewInvoice(inv: any, copy: InvoiceCopy) {
    try {
      setPdfPreviewLoading(true);
      saveLastInvoiceCopy(copy);
      setLastCopy(copy);
      const url = await previewIrrigationInvoicePdf(buildInvoicePdfPayload(inv), copy, pdfSettings);
      // Revoke prior URL to avoid leaks
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to preview PDF", "প্রিভিউ তৈরি ব্যর্থ"));
    } finally {
      setPdfPreviewLoading(false);
    }
  }

  async function bulkDownload(copy: InvoiceCopy) {
    const items = filtered.filter((r: any) => selected.has(r.id));
    if (!items.length) return toast.error(tx("Select invoices first", "প্রথমে ইনভয়েস নির্বাচন করুন"));
    // Consistency check: the PDF will contain exactly the selected rows.
    // Warn if that differs from what the current filter shows on screen.
    if (items.length !== filtered.length) {
      const ok = await confirm({
        title: tx("Row count mismatch", "সারির সংখ্যা মিলছে না"),
        description: tx(
          `The list shows ${filtered.length} invoices but the PDF will contain ${items.length}. Continue?`,
          `তালিকায় ${filtered.length} টি ইনভয়েস দেখাচ্ছে কিন্তু PDF-এ থাকবে ${items.length} টি। চালিয়ে যাবেন?`,
        ),
      });
      if (!ok) return;
    }
    if (items.length > 50) {
      const ok = await confirm({
        title: tx("Large batch", "বড় ব্যাচ"),
        description: tx("This may take a while and use a lot of memory. Continue?", "এটি সময়সাপেক্ষ এবং প্রচুর মেমরি ব্যবহার করতে পারে। চালিয়ে যাবেন?"),
      });
      if (!ok) return;
    }
    setBulkBusy(true);
    try {
      saveLastInvoiceCopy(copy); setLastCopy(copy);
      await downloadIrrigationInvoicesBulkPdf(items.map(buildInvoicePdfPayload), copy, pdfSettings);
      toast.success(tx(`Downloaded ${items.length} invoices`, `${items.length} টি ইনভয়েস ডাউনলোড হয়েছে`));
    } catch (e: any) {
      toast.error(e?.message ?? tx("Bulk download failed", "ব্যাচ ডাউনলোড ব্যর্থ"));
    } finally { setBulkBusy(false); }
  }

  async function bulkPreview(copy: InvoiceCopy) {
    const items = filtered.filter((r: any) => selected.has(r.id));
    if (!items.length) return toast.error(tx("Select invoices first", "প্রথমে ইনভয়েস নির্বাচন করুন"));
    setBulkBusy(true);
    try {
      saveLastInvoiceCopy(copy); setLastCopy(copy);
      const url = await previewIrrigationInvoicesBulkPdf(items.map(buildInvoicePdfPayload), copy, pdfSettings);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Preview failed", "প্রিভিউ ব্যর্থ"));
    } finally { setBulkBusy(false); }
  }

  async function shareInvoice(inv: any) {
    try {
      const result = await shareIrrigationInvoicePdf(buildInvoicePdfPayload(inv), lastCopy, pdfSettings);
      if (result === "downloaded") {
        toast.info(tx("Sharing not supported — PDF downloaded instead. Attach it manually.", "শেয়ার সাপোর্ট নেই — PDF ডাউনলোড হয়েছে। ম্যানুয়ালি সংযুক্ত করুন।"));
      }
    } catch (e: any) {
      toast.error(e?.message ?? tx("Share failed", "শেয়ার ব্যর্থ"));
    }
  }

  function shareWhatsApp(inv: any) {
    const url = buildWhatsAppShareLink(buildInvoicePdfPayload(inv), inv.farmers?.mobile);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareEmail(inv: any) {
    const url = buildMailtoLink(buildInvoicePdfPayload(inv), inv.farmers?.email);
    window.location.href = url;
  }

  function applyPreset(presetId: string) {
    const p = PRINTER_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setPdfSettings({ ...pdfSettings, ...p.settings });
    toast.success(tx("Preset applied", "প্রিসেট প্রয়োগ হয়েছে"));
  }

  const eligibleIds = useMemo(() => filtered.map((r: any) => r.id), [filtered]);
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id: string) => selected.has(id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligibleIds));
  }
  function toggleOne(id: string, v: boolean) {
    const s = new Set(selected);
    if (v) s.add(id); else s.delete(id);
    setSelected(s);
  }

  async function exportFilteredPdf() {
    if (!filtered.length) return toast.error(tx("No invoices to export", "এক্সপোর্ট করার মতো ইনভয়েস নেই"));
    const head = [
      tx("Invoice", "ইনভয়েস"),
      tx("Farmer", "কৃষক"),
      tx("Mouza", "মৌজা"),
      tx("Season", "সিজন"),
      tx("Payable", "প্রদেয়"),
      tx("Paid", "পরিশোধিত"),
      tx("Due", "বকেয়া"),
      tx("Status", "স্ট্যাটাস"),
      tx("Note", "নোট"),
    ];
    const body = (filtered as any[])
      .filter((r) => r.invoice_status !== "carried_forward")
      .map((r) => [
        r.invoice_no ?? "—",
        r.farmers?.name_bn || r.farmers?.name_en || "—",
        mouzaName(r) || "—",
        `${r.seasons?.name ?? r.seasons?.type ?? ""} ${r.seasons?.year ?? ""}`.trim(),
        money(r.payable_amount),
        money(r.paid_amount),
        money(r.due_amount),
        statusLabel(tx, r.invoice_status),
        joinInvoiceNotes(r) || "—",
      ]);
    body.push(["", "", "", tx("Grand total", "সর্বমোট"), money(grandTotals.payable), money(grandTotals.paid), money(grandTotals.due), "", ""]);
    await exportTablePDF(tx("Irrigation Invoices", "সেচ ইনভয়েস"), head, body, undefined, { landscape: true });
  }


  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <Label>{tx("Season", "সিজন")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isSuper && (
            <div>
              <Label>{tx("Office", "অফিস")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                  {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{tx("Mouza", "মৌজা")}</Label>
            <Popover open={mouzaOpen} onOpenChange={setMouzaOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{mouza === "all" ? tx("All", "সব") : mouza}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={tx("Search mouza…", "মৌজা খুঁজুন…")} />
                  <CommandList>
                    <CommandEmpty>{tx("No mouza found", "মৌজা পাওয়া যায়নি")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { setMouza("all"); setMouzaOpen(false); }}>
                        <Check className={`mr-2 h-4 w-4 ${mouza === "all" ? "opacity-100" : "opacity-0"}`} />
                        {tx("All", "সব")}
                      </CommandItem>
                      {mouzaOptions.map((m) => (
                        <CommandItem key={m} value={m} onSelect={() => { setMouza(m); setMouzaOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${mouza === m ? "opacity-100" : "opacity-0"}`} />
                          {m}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>{tx("Status", "স্ট্যাটাস")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="due">{tx("Due (outstanding)", "বকেয়া (সব)")}</SelectItem>
                <SelectItem value="generated">{tx("Issued", "ইস্যু")}</SelectItem>
                <SelectItem value="partial_paid">{tx("Partial", "আংশিক")}</SelectItem>
                <SelectItem value="paid">{tx("Paid", "পরিশোধিত")}</SelectItem>
                <SelectItem value="overdue">{tx("Overdue", "মেয়াদোত্তীর্ণ")}</SelectItem>
                <SelectItem value="cancelled">{tx("Cancelled", "বাতিল")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>{tx("Search", "খুঁজুন")}</Label>
            <Input placeholder={tx("Invoice / receipt no / farmer / code / mobile / dag / mouza", "ইনভয়েস / রশিদ নং / কৃষক / কোড / মোবাইল / দাগ / মৌজা")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">{filtered.length} {tx("invoices", "টি ইনভয়েস")} {loading && tx("(loading…)", "(লোড হচ্ছে…)")}</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={showFarmerSummary ? "default" : "outline"} onClick={() => setShowFarmerSummary(v => !v)}>
              {showFarmerSummary ? tx("Hide farmer summary", "ফার্মার সারাংশ লুকান") : tx("Farmer-wise summary", "ফার্মার-ভিত্তিক সারাংশ")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportInvoicesCSV(filtered, "irrigation-invoices.csv", lang)} disabled={!filtered.length}>
              <FileDown className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportInvoicesXLSX(filtered, "irrigation-invoices.xlsx", lang)} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportFilteredPdf} disabled={!filtered.length}>
              <Printer className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {showFarmerSummary && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="text-sm font-semibold">
              {tx("Farmer-wise outstanding (from filtered invoices)", "ফার্মার-ভিত্তিক বকেয়া (ফিল্টার করা ইনভয়েস থেকে)")}
              <span className="ml-2 text-xs text-muted-foreground">
                {tx("Total due", "মোট বকেয়া")}: <span className="font-mono font-semibold text-foreground">{money(farmerSummary.reduce((s, x) => s + x.due, 0))}</span>
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
                  <TableHead className="text-right">{tx("Invoices", "ইনভয়েস")}</TableHead>
                  <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
                  <TableHead className="text-right">{tx("Paid", "পরিশোধিত")}</TableHead>
                  <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {farmerSummary.slice(0, 100).map(f => (
                    <TableRow key={f.id}>
                      <TableCell>{f.name} <span className="text-xs text-muted-foreground">({f.code})</span></TableCell>
                      <TableCell className="text-right">{f.count}</TableCell>
                      <TableCell className="text-right font-mono">{money(f.payable)}</TableCell>
                      <TableCell className="text-right font-mono">{money(f.paid)}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${f.due > 0 ? "text-destructive" : ""}`}>{money(f.due)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}


        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold">{selected.size}</span> {tx("invoices selected", "টি ইনভয়েস নির্বাচিত")}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{tx("Clear", "মুছুন")}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={bulkBusy}>
                    <Files className="h-4 w-4 mr-1" />{bulkBusy ? tx("Working…", "প্রস্তুত…") : tx("Download set as PDF", "সেট PDF ডাউনলোড")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => bulkPreview(lastCopy)}>
                    <Eye className="h-4 w-4 mr-2" />{tx("Preview combined PDF", "যৌথ PDF প্রিভিউ")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => bulkDownload("both")}>{tx("Both copies (per page)", "উভয় কপি (প্রতি পেজ)")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkDownload("office")}>{tx("Office copies only", "শুধু অফিস কপি")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkDownload("farmer")}>{tx("Farmer copies only", "শুধু কৃষক কপি")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>{tx("Invoice No", "ইনভয়েস নং")}</TableHead>
                <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setMouzaSort((p) => (p === "asc" ? "desc" : p === "desc" ? "none" : "asc"))}
                  >
                    {tx("Mouza", "মৌজা")}
                    {mouzaSort === "asc" ? <ArrowUp className="h-3 w-3" /> : mouzaSort === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                  </button>
                </TableHead>
                <TableHead>{tx("Land", "জমি")}</TableHead>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
                <TableHead className="text-right">{tx("Paid", "পরিশোধিত")}</TableHead>
                <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
                <TableHead>{tx("Due date", "মেয়াদ")}</TableHead>
                <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => toggleOne(r.id, !!v)} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.farmers?.name_bn ?? r.farmers?.name_en ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.farmers?.farmer_code} {r.is_borga && <span className="ml-1">🤝 {tx("Sharecropper", "বর্গা")}</span>}</div>
                  </TableCell>
                  <TableCell className="text-xs">{mouzaName(r) || "—"}</TableCell>
                  <TableCell className="text-xs">
                    Dag {formatDagNumbers(r.lands?.dag_no) || "—"}<br />
                    {formatLandSize(invoiceLandSize(r), "short")}
                  </TableCell>
                  <TableCell className="text-xs">{r.seasons?.name ?? r.seasons?.type} {r.seasons?.year}</TableCell>
                  <TableCell className="text-right">{money(r.payable_amount)}</TableCell>
                  <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due_amount)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.invoice_status as InvoiceStatus]}>
                      {statusLabel(tx, r.invoice_status as InvoiceStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" title={tx("View", "দেখুন")} onClick={() => setPreviewId(r.id)}><Eye className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" title={tx("Print", "প্রিন্ট")}><Printer className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => previewInvoice(r, lastCopy)}>
                            <Eye className="h-4 w-4 mr-2" />{tx("Preview PDF", "PDF প্রিভিউ")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => downloadInvoice(r, "both")}>
                            {lastCopy === "both" ? "✓ " : ""}{tx("Both copies (A4)", "উভয় কপি (A4)")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadInvoice(r, "office")}>
                            {lastCopy === "office" ? "✓ " : ""}{tx("Office copy", "অফিস কপি")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadInvoice(r, "farmer")}>
                            {lastCopy === "farmer" ? "✓ " : ""}{tx("Farmer copy", "কৃষকের কপি")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => shareInvoice(r)}>
                            <Share2 className="h-4 w-4 mr-2" />{tx("Share PDF…", "PDF শেয়ার…")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shareWhatsApp(r)}>
                            <MessageCircle className="h-4 w-4 mr-2" />{tx("WhatsApp summary", "WhatsApp বার্তা")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shareEmail(r)}>
                            <Mail className="h-4 w-4 mr-2" />{tx("Email summary", "ইমেইল বার্তা")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setPdfSettingsOpen(true)}>
                            <SettingsIcon className="h-4 w-4 mr-2" />{tx("PDF settings", "PDF সেটিংস")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {r.invoice_status !== "cancelled" && r.invoice_status !== "paid" && (
                        <Button size="sm" variant="ghost" title={tx("Edit", "এডিট")} onClick={() => setEditInv(r)}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {r.invoice_status !== "cancelled" && r.invoice_status !== "paid" && (
                        <Button size="sm" variant="ghost" title={tx("Cancel", "বাতিল")} onClick={() => cancelInvoice(r)}><Ban className="h-4 w-4 text-destructive" /></Button>
                      )}
                      {isSuper && (
                        <Button size="sm" variant="ghost" title={tx("Delete", "মুছুন")} onClick={() => deleteInvoice(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">{tx("No invoices", "কোন ইনভয়েস নেই")}</TableCell></TableRow>
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">
                    {tx("Grand total", "সর্বমোট")} ({filtered.length})
                  </TableCell>
                  <TableCell className="text-right font-bold">{money(grandTotals.payable)}</TableCell>
                  <TableCell className="text-right font-bold text-success">{money(grandTotals.paid)}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{money(grandTotals.due)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
        <InvoicePreviewDialog
          invoiceId={previewId}
          onClose={() => setPreviewId(null)}
          allRows={rows}
          onRecalculated={load}
        />
        <InvoiceEditDialog inv={editInv} onClose={() => setEditInv(null)} onSaved={load} />

        <Dialog open={!!pdfPreviewUrl} onOpenChange={(v) => { if (!v) { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); } }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{tx("Invoice PDF preview", "ইনভয়েস PDF প্রিভিউ")}</DialogTitle></DialogHeader>
            {pdfPreviewUrl && (
              <iframe src={pdfPreviewUrl} title="Invoice preview" className="w-full h-[75vh] border rounded-md bg-white" />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}>{tx("Close", "বন্ধ")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pdfSettingsOpen} onOpenChange={setPdfSettingsOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx("Invoice PDF settings", "ইনভয়েস PDF সেটিংস")}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs font-semibold">{tx("Printer preset", "প্রিন্টার প্রিসেট")}</Label>
                <Select onValueChange={applyPreset}>
                  <SelectTrigger><SelectValue placeholder={tx("Choose a preset to apply…", "প্রিসেট বাছাই করুন…")} /></SelectTrigger>
                  <SelectContent>
                    {PRINTER_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{tx(p.labelEn, p.labelBn)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{tx("Quickly set paper size, margins and cut-line for common printers.", "সাধারণ প্রিন্টারের জন্য পেজ সাইজ, মার্জিন ও কাট-লাইন এক ক্লিকে সেট করুন।")}</p>
              </div>

              <p className="text-xs text-muted-foreground">{tx("Adjust paper, margins and the cut-line position so the office and farmer copies fit your printer.", "পেজ, মার্জিন ও কাট-লাইন এর পজিশন এডজাস্ট করুন যাতে অফিস ও কৃষক কপি আপনার প্রিন্টারে ঠিকমতো ফিট করে।")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>{tx("Paper size", "পেজ সাইজ")}</Label>
                  <Select value={pdfSettings.paperFormat} onValueChange={(v) => setPdfSettings({ ...pdfSettings, paperFormat: v as any, cutLineMm: v === "letter" ? 139.7 : v === "a5" ? 105 : v === "a5-landscape" ? 74 : 148.5 })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="a5">A5 (148 × 210 mm)</SelectItem>
                      <SelectItem value="a5-landscape">A5 {tx("Landscape", "ল্যান্ডস্কেপ")} (210 × 148 mm)</SelectItem>
                      <SelectItem value="letter">Letter (216 × 279 mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{tx("Top margin (mm)", "উপরের মার্জিন (mm)")}</Label>
                  <Input type="number" step="0.5" value={pdfSettings.marginTopMm} onChange={(e) => setPdfSettings({ ...pdfSettings, marginTopMm: Number(e.target.value) || 0 })} /></div>
                <div><Label>{tx("Bottom margin (mm)", "নিচের মার্জিন (mm)")}</Label>
                  <Input type="number" step="0.5" value={pdfSettings.marginBottomMm} onChange={(e) => setPdfSettings({ ...pdfSettings, marginBottomMm: Number(e.target.value) || 0 })} /></div>
                <div><Label>{tx("Left margin (mm)", "বাম মার্জিন (mm)")}</Label>
                  <Input type="number" step="0.5" value={pdfSettings.marginLeftMm} onChange={(e) => setPdfSettings({ ...pdfSettings, marginLeftMm: Number(e.target.value) || 0 })} /></div>
                <div><Label>{tx("Right margin (mm)", "ডান মার্জিন (mm)")}</Label>
                  <Input type="number" step="0.5" value={pdfSettings.marginRightMm} onChange={(e) => setPdfSettings({ ...pdfSettings, marginRightMm: Number(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label>{tx("Cut-line position from top (mm)", "কাট-লাইন অবস্থান উপর থেকে (mm)")}</Label>
                  <Input type="number" step="0.5" value={pdfSettings.cutLineMm} onChange={(e) => setPdfSettings({ ...pdfSettings, cutLineMm: Number(e.target.value) || 0 })} />
                  <p className="text-[11px] text-muted-foreground mt-1">{tx("A4 mid = 148.5 · Letter mid = 139.7", "A4 মাঝ = 148.5 · Letter মাঝ = 139.7")}</p>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2">
                <h4 className="text-sm font-semibold">{tx("Signatures", "স্বাক্ষর")}</h4>
                <p className="text-[11px] text-muted-foreground">{tx("Pick a staff member to auto-fill the signature name, or type a custom value.", "স্বাক্ষর নাম অটো-ফিল করতে স্টাফ নির্বাচন করুন, অথবা কাস্টম লিখুন।")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{tx("Farmer sign label", "কৃষকের স্বাক্ষর লেবেল")}</Label>
                    <Input value={pdfSettings.farmerSignTitle} onChange={(e) => setPdfSettings({ ...pdfSettings, farmerSignTitle: e.target.value })} /></div>
                  <div><Label>{tx("Farmer name (optional)", "কৃষকের নাম (ঐচ্ছিক)")}</Label>
                    <Input value={pdfSettings.farmerSignName} onChange={(e) => setPdfSettings({ ...pdfSettings, farmerSignName: e.target.value })} placeholder={tx("Auto from invoice", "ইনভয়েস থেকে অটো")} /></div>
                  <div><Label>{tx("Collector sign label", "আদায়কারীর স্বাক্ষর লেবেল")}</Label>
                    <Input value={pdfSettings.collectorSignTitle} onChange={(e) => setPdfSettings({ ...pdfSettings, collectorSignTitle: e.target.value })} /></div>
                  <div><Label>{tx("Collector — staff list", "আদায়কারী — স্টাফ তালিকা")}</Label>
                    <Select value="" onValueChange={(v) => {
                      const s = staff.find((x) => x.id === v);
                      if (s) setPdfSettings({ ...pdfSettings, collectorSignName: s.full_name ?? s.username ?? "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder={tx("Select staff…", "স্টাফ নির্বাচন…")} /></SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.username ?? s.id.slice(0, 8)}</SelectItem>
                        ))}
                        {!staff.length && <div className="px-3 py-2 text-xs text-muted-foreground">{tx("No staff available", "কোন স্টাফ নেই")}</div>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>{tx("Collector name / title", "আদায়কারীর নাম / পদবি")}</Label>
                    <Input value={pdfSettings.collectorSignName} onChange={(e) => setPdfSettings({ ...pdfSettings, collectorSignName: e.target.value })} placeholder={tx("e.g. Md. Karim — Field Officer", "যেমন: মো. করিম — মাঠ কর্মকর্তা")} /></div>
                  <div><Label>{tx("Farmer — staff list", "কৃষক স্বাক্ষর — স্টাফ তালিকা")}</Label>
                    <Select value="" onValueChange={(v) => {
                      const s = staff.find((x) => x.id === v);
                      if (s) setPdfSettings({ ...pdfSettings, farmerSignName: s.full_name ?? s.username ?? "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder={tx("Select staff…", "স্টাফ নির্বাচন…")} /></SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.username ?? s.id.slice(0, 8)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPdfSettings({ ...DEFAULT_INVOICE_SETTINGS }); }}>{tx("Reset", "রিসেট")}</Button>
              <Button variant="outline" onClick={() => setPdfSettingsOpen(false)}>{tx("Close", "বন্ধ")}</Button>
              <Button onClick={() => { saveInvoiceSettings(pdfSettings); toast.success(tx("Saved", "সংরক্ষণ হয়েছে")); setPdfSettingsOpen(false); }}>{tx("Save", "সংরক্ষণ")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function InvoiceEditDialog({ inv, onClose, onSaved }: any) {
  const { tx } = useLang();
  const { user, roles } = useAuth();
  const [dueDate, setDueDate] = useState("");
  const [otherCharge, setOtherCharge] = useState("0");
  const [delayFee, setDelayFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const perm = inv ? canEditInvoice(roles, inv) : { ok: false as boolean, reason: "no_permission" };

  useEffect(() => {
    if (!inv) return;
    setDueDate(inv.due_date ?? "");
    setOtherCharge(String(inv.other_charge ?? 0));
    setDelayFee(String(inv.delay_fee ?? 0));
    setDiscount(String(inv.discount_amount ?? 0));
    setDiscountReason(inv.discount_reason ?? "");
    setNote(inv.note ?? "");
    // Load discount change history (audit log) for this invoice.
    db.from("audit_logs")
      .select("id, user_id, old_data, new_data, created_at")
      .eq("module", "irrigation_invoice_discount")
      .eq("reference_id", inv.id)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setHistory(data ?? []), () => setHistory([]));
  }, [inv?.id]);

  if (!inv) return null;

  async function notifyAdmins(payload: { old: number; next: number; payable: number; reason: string }) {
    try {
      const { data: admins } = await db
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin", "developer"]);
      const ids = Array.from(new Set((admins ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (!ids.length) return;
      const rows = ids.map((uid: string) => ({
        user_id: uid,
        kind: "invoice_discount",
        title: tx("Invoice discount changed", "ইনভয়েস ডিসকাউন্ট পরিবর্তিত"),
        body: `${inv.invoice_no}: ${payload.old} → ${payload.next} (${tx("payable", "প্রদেয়")} ${payload.payable})${payload.reason ? " — " + payload.reason : ""}`,
        link: "/irrigation/invoices",
      }));
      await db.from("notifications").insert(rows as any).then(() => {}, () => {});
    } catch { /* non-blocking */ }
  }

  async function save() {
    if (!perm.ok) {
      return toast.error(
        perm.reason === "staff_approved_locked"
          ? tx("Staff cannot edit approved invoices", "স্টাফ অনুমোদিত ইনভয়েস এডিট করতে পারবে না")
          : tx("You do not have permission to edit invoices", "ইনভয়েস এডিট করার অনুমতি নেই")
      );
    }
    const oc = Number(otherCharge) || 0;
    const df = Number(delayFee) || 0;
    const disc = Number(discount) || 0;
    if (!dueDate) return toast.error(tx("Enter due date", "মেয়াদ তারিখ দিন"));
    const gross = grossAmount(inv, oc, df);
    const originalDisc = Number(inv.discount_amount ?? 0);
    const v = validateDiscount(gross, disc, discountReason, originalDisc);
    if (!v.ok) {
      const msg =
        v.code === "negative" ? tx("Negative values not allowed", "ঋণাত্মক মান দেওয়া যাবে না") :
        v.code === "exceeds_invoice" ? tx("Discount cannot exceed invoice amount", "ডিসকাউন্ট ইনভয়েসের পরিমাণের বেশি হতে পারে না") :
        tx("Enter a discount reason", "ডিসকাউন্টের কারণ লিখুন");
      return toast.error(msg);
    }
    if (oc < 0 || df < 0) return toast.error(tx("Negative values not allowed", "ঋণাত্মক মান দেওয়া যাবে না"));
    setBusy(true);
    const totals = computeInvoiceTotals(inv, disc, dueDate, oc, df);
    const payable = totals.payable;
    const due = totals.due;
    const newStatus = totals.status;
    const { error } = await db
      .from("irrigation_invoices" as any)
      .update({
        due_date: dueDate,
        other_charge: oc,
        delay_fee: df,
        discount_amount: disc,
        discount_reason: discountReason.trim() || null,
        note: note || null,
        payable_amount: payable,
        due_amount: due,
        invoice_status: newStatus,
      } as any)
      .eq("id", inv.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    const originalFee = Number(inv.delay_fee ?? 0);
    if (df !== originalFee) {
      await db.from("irrigation_delay_fee_audit").insert({
        invoice_id: inv.id, payment_id: null,
        original_amount: originalFee, modified_amount: df,
        reason: note || null,
        changed_by: user?.id, office_id: inv.office_id ?? null,
      }).then(() => {}, () => {});
      logAudit({
        module: "delay_fee_override",
        action_type: "override",
        office_id: inv.office_id ?? null,
        reference_id: inv.id,
        old_data: { delay_fee: originalFee },
        new_data: { delay_fee: df, source: "invoice_edit", reason: note || null },
      });
    }
    if (disc !== originalDisc) {
      logAudit({
        module: "irrigation_invoice_discount",
        action_type: "discount",
        office_id: inv.office_id ?? null,
        reference_id: inv.id,
        old_data: { discount_amount: originalDisc, payable_amount: inv.payable_amount },
        new_data: { discount_amount: disc, payable_amount: payable, reason: discountReason.trim() || null },
      });
      notifyAdmins({ old: originalDisc, next: disc, payable, reason: discountReason.trim() });
      // Chart of accounts: Dr Discount Expense / Cr Irrigation Income for the increase.
      const acc = await checkRequiredAccounts();
      if (!acc.ok) toast.error(acc.message!);
      await postIrrigationDiscount({
        discountDelta: disc - originalDisc,
        invoiceNo: (inv as any).invoice_no ?? null,
        reason: discountReason.trim() || null,
        officeId: inv.office_id ?? null,
        createdBy: user?.id ?? null,
      });
      const imb = takeLastImbalance();
      if (imb) {
        toast.warning(formatImbalance(imb, tx("en", "bn") as "en" | "bn"));
      }
    }
    toast.success(tx("Invoice updated", "ইনভয়েস হালনাগাদ হয়েছে"));
    onSaved?.(); onClose();
  }

  const previewPayable = computeInvoiceTotals(inv, Number(discount) || 0, dueDate, Number(otherCharge) || 0, Number(delayFee) || 0).payable;

  return (
    <Dialog open={!!inv} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx("Edit invoice", "ইনভয়েস এডিট")} — {inv.invoice_no}</DialogTitle></DialogHeader>
        {!perm.ok && (
          <p className="text-xs text-destructive">
            {perm.reason === "staff_approved_locked"
              ? tx("This invoice is already approved/paid; staff cannot edit it.", "এই ইনভয়েস অনুমোদিত/পরিশোধিত; স্টাফ এডিট করতে পারবে না।")
              : tx("You do not have permission to edit invoices.", "ইনভয়েস এডিট করার অনুমতি নেই।")}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <Label>{tx("Due date", "মেয়াদ তারিখ")}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!perm.ok} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tx("Other charge", "অন্যান্য চার্জ")}</Label>
              <Input type="number" min="0" step="0.01" value={otherCharge} onChange={(e) => setOtherCharge(e.target.value)} disabled={!perm.ok} />
            </div>
            <div>
              <Label>{tx("Late fee", "বিলম্ব ফি")}</Label>
              <Input type="number" min="0" step="0.01" value={delayFee} onChange={(e) => setDelayFee(e.target.value)} disabled={!perm.ok} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tx("Discount", "ডিসকাউন্ট")}</Label>
              <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={!perm.ok} />
            </div>
            <div>
              <Label>{tx("Discount reason", "ডিসকাউন্টের কারণ")}</Label>
              <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder={tx("Required when discounting", "ডিসকাউন্ট দিলে আবশ্যক")} disabled={!perm.ok} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {tx("Payable after discount", "ডিসকাউন্টের পর প্রদেয়")}: <span className="font-medium text-foreground">{money(previewPayable)}</span>
          </p>
          <div>
            <Label>{tx("Note", "মন্তব্য")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} disabled={!perm.ok} />
          </div>
          {history.length > 0 && (
            <div className="rounded-md border p-2">
              <p className="text-xs font-medium mb-1">{tx("Discount history", "ডিসকাউন্ট ইতিহাস")}</p>
              <div className="max-h-40 overflow-auto space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="text-[11px] text-muted-foreground border-b pb-1 last:border-0">
                    <span className="text-foreground">
                      {money(Number(h.old_data?.discount_amount ?? 0))} → {money(Number(h.new_data?.discount_amount ?? 0))}
                    </span>
                    {" · "}{tx("payable", "প্রদেয়")} {money(Number(h.new_data?.payable_amount ?? 0))}
                    {h.new_data?.reason ? ` · ${h.new_data.reason}` : ""}
                    {" · "}{h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {tx("Use \"Recalculate\" to change irrigation/maintenance/canal amounts.", "সেচ/রক্ষণাবেক্ষণ/খাল চার্জ পরিবর্তনের জন্য “পুনঃগণনা” ব্যবহার করুন।")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tx("Close", "বন্ধ")}</Button>
          <Button onClick={save} disabled={busy || !perm.ok}>{busy ? tx("Saving…", "সংরক্ষণ…") : tx("Save", "সংরক্ষণ করুন")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function InvoicePreviewDialog({ invoiceId, onClose, allRows, onRecalculated }: any) {
  const { tx } = useLang();
  const { isSuper } = useAuth();
  const inv = allRows.find((r: any) => r.id === invoiceId);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<any[]>([]);
  useEffect(() => {
    if (!invoiceId) { setOverrides([]); return; }
    (db
      .from("irrigation_rate_overrides" as any)
      .select("id,original_rate,overridden_rate,override_reason,created_at,created_by")
      .eq("irrigation_invoice_id", invoiceId)
      .order("created_at", { ascending: false }) as any)
      .then(({ data }: any) => setOverrides((data as any[]) ?? []));
  }, [invoiceId]);
  if (!inv) return null;

  async function recalc() {
    if (reason.trim().length < 3) return toast.error(tx("Enter a reason (at least 3 chars)", "কারণ লিখুন (অন্তত ৩ অক্ষর)"));
    setBusy(true);
    try {
      const { error } = await db.rpc("recalculate_irrigation_invoice" as any, {
        _invoice_id: inv.id, _reason: reason.trim(),
      });
      if (error) throw error;
      toast.success(tx("Invoice recalculated", "ইনভয়েস পুনঃগণনা হয়েছে"));
      setRecalcOpen(false); setReason("");
      onRecalculated?.();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={!!invoiceId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tx("Invoice", "ইনভয়েস")} {inv.invoice_no}
            {(inv.is_manual_rate || inv.rate_source === "MANUAL") && <Badge variant="outline" className="text-xs">{tx("Custom rate", "কাস্টম রেট")}</Badge>}
            {inv.rate_source === "CATEGORY" && inv.irrigation_category_name && <Badge variant="secondary" className="text-xs">{inv.irrigation_category_name}</Badge>}
            <Badge variant="secondary" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" />{tx("Snapshot protected", "স্ন্যাপশট সুরক্ষিত")}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Row k={tx("Farmer", "কৃষক")} v={`${inv.farmers?.name_bn ?? inv.farmers?.name_en} (${inv.farmers?.farmer_code})`} />
          <Row k={tx("Type", "ধরন")} v={inv.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "নিজ মালিক")}`} />
          <Row k={tx("Land", "জমি")} v={`${mouzaName(inv)} • Dag ${formatDagNumbers(inv.lands?.dag_no) || "—"} • ${formatLandSize(invoiceLandSize(inv))}`} />
          <Row k={tx("Land type", "জমির ধরন")} v={inv.land_type_name ?? "—"} />
          <Row k={tx("Season", "সিজন")} v={`${inv.seasons?.name ?? inv.seasons?.type} ${inv.seasons?.year}`} />
          <Row k={tx("Season rate / shotok", "সিজন রেট/শতক")} v={inv.season_rate != null ? money(inv.season_rate) : "—"} />
          <Row k={tx("Due date", "মেয়াদ")} v={fmtDate(inv.due_date)} />
          <hr />
          <Row k={tx("Irrigation charge", "সেচ চার্জ")} v={money(inv.irrigation_amount)} />
          <Row k={tx("Maintenance charge", "রক্ষণাবেক্ষণ চার্জ")} v={money(inv.maintenance_amount)} />
          <Row k={tx("Canal charge", "খাল/নালা চার্জ")} v={money(inv.canal_amount)} />
          <Row k={tx("Other", "অন্যান্য")} v={money(inv.other_charge)} />
          <Row k={tx("Late fee", "বিলম্ব ফি")} v={money(inv.delay_fee)} />
          {Number(inv.discount_amount) > 0 && (
            <Row k={tx("Discount", "ডিসকাউন্ট")} v={`- ${money(inv.discount_amount)}`} />
          )}
          {Number(inv.discount_amount) > 0 && inv.discount_reason && (
            <Row k={tx("Discount reason", "ডিসকাউন্টের কারণ")} v={inv.discount_reason} />
          )}
          <hr />
          <Row k={tx("Total payable", "মোট প্রদেয়")} v={money(inv.payable_amount)} bold />
          <Row k={tx("Paid", "পরিশোধিত")} v={money(inv.paid_amount)} />
          <Row k={tx("Due", "বকেয়া")} v={money(inv.due_amount)} bold />
          <hr />
          <Row k={tx("Status", "স্ট্যাটাস")} v={statusLabel(tx, inv.invoice_status as InvoiceStatus)} />
          <Row k={tx("Created", "তৈরির তারিখ")} v={fmtDate(inv.generated_at)} />
          {inv.recalculated_at && <Row k={tx("Last recalculation", "শেষ পুনঃগণনা")} v={fmtDate(inv.recalculated_at)} />}
          {inv.manual_rate_reason && <Row k={tx("Manual rate reason", "ম্যানুয়াল রেটের কারণ")} v={inv.manual_rate_reason} />}
          {inv.calculation_snapshot && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">{tx("Calculation snapshot (immutable)", "গণনা স্ন্যাপশট (অপরিবর্তনীয়)")}</summary>
              <pre className="text-[10px] bg-muted/40 p-2 rounded mt-1 overflow-auto max-h-40">
{JSON.stringify(inv.calculation_snapshot, null, 2)}
              </pre>
            </details>
          )}
          {overrides.length > 0 && (
            <details className="mt-2" open>
              <summary className="cursor-pointer text-xs font-medium">
                {tx("Rate override audit", "রেট ওভাররাইড অডিট")} ({overrides.length})
              </summary>
              <div className="space-y-2 mt-2">
                {overrides.map((o) => {
                  const diff = Number(o.overridden_rate || 0) - Number(o.original_rate || 0);
                  const diffSign = diff > 0 ? "+" : "";
                  return (
                    <div key={o.id} className="text-[11px] border-l-2 border-primary/40 pl-2 py-1 bg-muted/30 rounded-r">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-mono">{fmtDate(o.created_at)} {new Date(o.created_at).toLocaleTimeString()}</span>
                        <span>
                          <span className="line-through text-muted-foreground">{money(o.original_rate)}</span>
                          {" → "}
                          <span className="font-semibold">{money(o.overridden_rate)}</span>
                          <span className={`ml-1 ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>({diffSign}{money(diff)})</span>
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">{tx("Reason", "কারণ")}: </span>
                        <span>{o.override_reason || <em className="text-muted-foreground">{tx("(none)", "(নেই)")}</em>}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {tx("By", "দ্বারা")}: <span className="font-mono">{o.created_by ? String(o.created_by).slice(0, 8) : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
        <DialogFooter className="gap-2">
          {isSuper && inv.invoice_status !== "cancelled" && (
            <Button variant="outline" onClick={() => setRecalcOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-1" />{tx("Recalculate", "পুনঃগণনা")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{tx("Close", "বন্ধ করুন")}</Button>
        </DialogFooter>

        <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{tx("Recalculate invoice", "ইনভয়েস পুনঃগণনা")}</DialogTitle></DialogHeader>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{tx("Warning", "সতর্কতা")}</AlertTitle>
              <AlertDescription>
                {tx("This invoice will be recalculated using the current season rate. The previous snapshot is preserved in the audit log.", "বর্তমান সিজন রেট ব্যবহার করে এই ইনভয়েস পুনঃগণনা হবে। পুরোনো স্ন্যাপশট অডিট লগে সংরক্ষণ থাকবে।")}
              </AlertDescription>
            </Alert>
            <div>
              <Label>{tx("Reason *", "কারণ *")}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder={tx("e.g. rate was misconfigured", "যেমন: রেট ভুল কনফিগার করা হয়েছিল")} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecalcOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
              <Button onClick={recalc} disabled={busy}>{busy ? "…" : tx("Recalculate", "পুনঃগণনা করুন")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

const Row = ({ k, v, bold }: { k: string; v: any; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""}`}>
    <span className="text-muted-foreground">{k}</span><span>{v}</span>
  </div>
);

function GenerateTab({ seasons, offices, userId, isSuper }: any) {
  const { tx } = useLang();
  const [seasonId, setSeasonId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [rateOverride, setRateOverride] = useState<number>(0);
  const [rateMap, setRateMap] = useState<RateRow[]>([]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [prevDueWarning, setPrevDueWarning] = useState<{ farmers: number; total: number } | null>(null);
  const [skippedNoRate, setSkippedNoRate] = useState(0);
  const [skipExisting, setSkipExisting] = useState(true);
  // Land-type filter — only selected land types are invoiced. Keyed by land_type_id.
  const [landTypeList, setLandTypeList] = useState<Array<{ id: string; code: string | null; name_bn: string | null; name_en: string | null }>>([]);
  const [fieldTypes, setFieldTypes] = useState<Set<string>>(() => new Set());
  const toggleFieldType = (ft: string) =>
    setFieldTypes((prev) => {
      const next = new Set(prev);
      next.has(ft) ? next.delete(ft) : next.add(ft);
      return next;
    });
  // Legacy lands store an elevation enum (field_type) instead of land_type_id.
  const CODE_TO_FIELD_TYPE: Record<string, string> = { HIGH: "high_land", MEDIUM: "medium_land", LOW: "low_land" };

  // Load active land types and select them all by default.
  useEffect(() => {
    db
      .from("land_types" as any)
      .select("id,code,name_bn,name_en")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order")
      .then(({ data }: any) => {
        const list = (data as any[]) ?? [];
        setLandTypeList(list);
        setFieldTypes(new Set(list.map((lt: any) => lt.id)));
      });
  }, []);

  const [manualOpen, setManualOpen] = useState(false);

  // Hybrid rate engine — optional default category for the bulk batch
  const [categories, setCategories] = useState<Array<{ id: string; name_bn: string | null; name_en: string | null; allow_manual_negotiation: boolean }>>([]);
  const [categoryRates, setCategoryRates] = useState<Array<{ irrigation_category_id: string; rate: number; rate_type: string; is_negotiable: boolean }>>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");

  useEffect(() => {
    if (!seasonId) { setRateMap([]); return; }
    loadSeasonRateMap(seasonId, officeId || null).then(setRateMap);
  }, [seasonId, officeId]);

  // Load active categories + their season rates for the current season/office
  useEffect(() => {
    let q = db.from("irrigation_categories" as any)
      .select("id,name_bn,name_en,allow_manual_negotiation")
      .eq("is_active", true).is("deleted_at", null);
    if (officeId) q = q.eq("office_id", officeId);
    (q as any).order("name_bn").then(({ data }: any) => setCategories((data as any) ?? []));
  }, [officeId]);

  useEffect(() => {
    if (!seasonId) { setCategoryRates([]); return; }
    let q = db.from("irrigation_category_rates" as any)
      .select("irrigation_category_id,rate,rate_type,is_negotiable")
      .eq("irrigation_season_id", seasonId);
    if (officeId) q = q.eq("office_id", officeId);
    (q as any).then(({ data }: any) => setCategoryRates((data as any) ?? []));
  }, [seasonId, officeId]);

  function getCategoryInput(): CategoryRateInput | null {
    if (!defaultCategoryId) return null;
    const cat = categories.find((c) => c.id === defaultCategoryId);
    const rate = categoryRates.find((r) => r.irrigation_category_id === defaultCategoryId);
    if (!cat || !rate || !(rate.rate > 0)) return null;
    return {
      irrigation_category_id: cat.id,
      category_name: cat.name_bn || cat.name_en || "",
      rate: Number(rate.rate),
      rate_type: (rate.rate_type as any) || "per_shotok",
      is_negotiable: !!rate.is_negotiable,
    };
  }

  async function preview() {
    if (!seasonId) return toast.error(tx("Select a season", "সিজন বাছাই করুন"));
    setBusy(true);
    setSkippedNoRate(0);
    try {
      let lq = db.from("lands").select("id, farmer_id, owner_farmer_id, land_size, office_id, dag_no, mouza, field_type, land_type_id, notes").is("deleted_at", null);
      if (officeId) lq = lq.eq("office_id", officeId);
      const { data: lands, error: lerr } = await lq;
      if (lerr) throw lerr;

      let skip = new Set<string>();
      if (skipExisting) {
        const { data: existing } = await db
          .from("irrigation_invoices" as any)
          .select("land_id")
          .eq("season_id", seasonId)
          .neq("invoice_status", "cancelled")
          .is("deleted_at", null);
        skip = new Set((existing as any[] | null ?? []).map((r: any) => r.land_id));
      }

      const targetOffice = officeId || (lands?.[0]?.office_id ?? null);
      const rawSettings = await getChargeSettings(targetOffice);
      // Never auto-apply a delay fee (জরিমানা) at generation time. The due of a
      // freshly generated invoice must equal the land's expected charge
      // (irrigation + maintenance + canal + other) and no penalty may carry into
      // a newly generated season. Delay fee is added separately at payment time.
      const settings = { ...rawSettings, auto_apply_delay_fee: false };

      // Fallback elevation enums for legacy lands that have no land_type_id.
      const selectedFieldTypeFallback = new Set(
        landTypeList
          .filter((lt) => fieldTypes.has(lt.id) && lt.code && CODE_TO_FIELD_TYPE[lt.code])
          .map((lt) => CODE_TO_FIELD_TYPE[lt.code as string]),
      );
      const matchesLandTypeFilter = (l: any) => {
        if (fieldTypes.size === 0) return false;
        if (l.land_type_id) return fieldTypes.has(l.land_type_id);
        // Legacy land without land_type_id → match by elevation enum.
        return !l.field_type || selectedFieldTypeFallback.size === 0 || selectedFieldTypeFallback.has(l.field_type);
      };
      const eligible = (lands ?? []).filter(
        (l: any) =>
          Number(l.land_size) > 0 &&
          !skip.has(l.id) &&
          matchesLandTypeFilter(l),
      );


      const previewArr: any[] = [];
      let noRate = 0;
      const categoryInput = getCategoryInput();
      for (const l of eligible) {
        const matched = resolveRateForLand(rateMap, l);
        const landTypeRate = matched && matched.rate_per_shotok > 0
          ? { rate_per_shotok: matched.rate_per_shotok, land_type_id: matched.land_type_id, land_type_code: matched.land_type_code }
          : (rateOverride > 0 ? { rate_per_shotok: rateOverride } : null);
        const resolved = resolveIrrigationRate({
          landTypeRate: landTypeRate ?? undefined,
          categoryRate: categoryInput ?? undefined,
        });
        if (!(resolved.rate > 0)) { noRate++; continue; }
        // Phase 4: split billable area between owner and active sharecroppers
        const splits = await resolveBillingSplits(l.id, dueDate);
        for (const split of splits) {
          const billedArea = split.billed_area > 0 ? split.billed_area : Number(l.land_size);
          const calc = calcInvoice({
            land_size_shotok: billedArea,
            rate_per_shotok: resolved.rate,
            basis: resolved.basis,
            settings,
            due_date: dueDate,
            as_of: new Date().toISOString().slice(0, 10),
          });
          const billed = {
            billed_farmer_id: split.billed_farmer_id,
            owner_farmer_id: split.owner_farmer_id,
            is_borga: split.is_borga,
          };
          previewArr.push({ land: l, billed, billedArea, calc, settings, rate: resolved.rate, rateRow: matched, resolved });
        }
      }

      setPreviewRows(previewArr.map((r) => ({ ...r, manualRate: "", manualReason: "" })));
      setSkippedNoRate(noRate);
      // Fetch previous outstanding for the farmers in this preview
      try {
        const farmerIds = Array.from(new Set(previewArr.map((r) => r.billed.billed_farmer_id).filter(Boolean)));
        if (farmerIds.length) {
          const { data: prev } = await db
            .from("irrigation_invoices" as any)
            .select("farmer_id,due_amount,delay_fee")
            .in("farmer_id", farmerIds)
            .neq("season_id", seasonId)
            .gt("due_amount", 0)
            .is("deleted_at", null)
            .neq("invoice_status", "cancelled");
          const uniq = new Set<string>(); let total = 0;
          for (const r of (prev ?? []) as any[]) {
            const amt = Math.max(0, (Number(r.due_amount) || 0) - (Number(r.delay_fee) || 0));
            if (amt <= 0) continue;
            uniq.add(r.farmer_id); total += amt;
          }
          setPrevDueWarning(uniq.size ? { farmers: uniq.size, total } : null);
        } else setPrevDueWarning(null);
      } catch { setPrevDueWarning(null); }
      toast.success(`${previewArr.length} ${tx("preview", "টি প্রিভিউ")}${noRate ? ` • ${noRate} ${tx("lands have no rate", "টি জমিতে রেট নেই")}` : ""}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function commit() {
    if (!previewRows?.length) return;
    setBusy(true);
    try {
      let success = 0, failed = 0;
      for (const row of previewRows) {
        try {
          const manualRateNum = Number(row.manualRate);
          const hasManual = manualRateNum > 0 && row.manualReason?.trim();
          let appliedRate = row.rate;
          let source: string = row.resolved?.source ?? "STANDARD";
          let calc = row.calc;
          const billedArea = row.billedArea > 0 ? row.billedArea : Number(row.land.land_size);
          if (hasManual) {
            appliedRate = manualRateNum;
            source = "MANUAL";
            calc = calcInvoice({
              land_size_shotok: billedArea,
              rate_per_shotok: appliedRate,
              basis: row.resolved?.basis,
              settings: row.settings,
              due_date: dueDate,
              as_of: new Date().toISOString().slice(0, 10),
            });
          }
          const originalStandardRate = row.resolved?.originalStandardRate ?? row.rate;
          const invoice_no = await generateInvoiceNo();
          const payload: any = {
            invoice_no,
            office_id: row.land.office_id ?? officeId ?? null,
            season_id: seasonId,
            land_id: row.land.id,
            owner_farmer_id: row.billed.owner_farmer_id,
            farmer_id: row.billed.billed_farmer_id,
            is_borga: row.billed.is_borga,
            irrigation_amount: calc.irrigation_amount,
            maintenance_amount: calc.maintenance_amount,
            canal_amount: calc.canal_amount,
            delay_fee: calc.delay_fee,
            other_charge: calc.other_charge,
            payable_amount: calc.payable_amount,
            discount_amount: 0,
            discount_reason: null,
            paid_amount: 0,
            due_date: dueDate,
            invoice_status: "generated",
            generated_by: userId,
            season_rate: appliedRate,
            land_type_id: row.rateRow?.land_type_id ?? null,
            land_type_name: row.rateRow?.land_type_name ?? row.land.field_type ?? null,
            rate_source: source,
            applied_rate: appliedRate,
            original_standard_rate: originalStandardRate,
            irrigation_category_id: row.resolved?.categoryId ?? null,
            irrigation_category_name: row.resolved?.categoryName ?? null,
            is_manual_rate: hasManual,
            manual_rate_reason: hasManual ? row.manualReason.trim() : null,
            note: (row.land.notes ?? "").trim() || null,
            override_reason: hasManual ? row.manualReason.trim() : null,
            calculation_snapshot: {
              rate_per_shotok: appliedRate,
              land_size_shotok: billedArea,
              parcel_size_shotok: Number(row.land.land_size),
              billed_area_shotok: billedArea,
              is_borga_split: !!row.billed.is_borga,
              land_type_code: row.rateRow?.land_type_code ?? row.land.field_type ?? null,
              land_type_name: row.rateRow?.land_type_name ?? null,
              settings: row.settings,
              calc,
              generated_at: new Date().toISOString(),
              rate_source: source,
              applied_rate: appliedRate,
              original_standard_rate: originalStandardRate,
              irrigation_category_id: row.resolved?.categoryId ?? null,
              irrigation_category_name: row.resolved?.categoryName ?? null,
              manual_reason: hasManual ? row.manualReason.trim() : null,
            },
          };
          const { data: ins, error } = await (db.from("irrigation_invoices" as any).insert(payload).select("id").maybeSingle() as any);
          if (error) { failed++; console.error(error); continue; }
          success++;
          if (hasManual && ins?.id) {
            await (db.from("irrigation_rate_overrides" as any).insert({
              irrigation_invoice_id: ins.id,
              office_id: payload.office_id,
              original_rate: originalStandardRate,
              overridden_rate: appliedRate,
              override_reason: row.manualReason.trim(),
              created_by: userId,
            }) as any);
          }
        } catch (e) { failed++; console.error(e); }
      }
      toast.success(`${success} ${tx("created", "টি তৈরি হয়েছে")}${failed ? `, ${failed} ${tx("failed", "ব্যর্থ")}` : ""}`);
      setPreviewRows(null);
    } finally { setBusy(false); }
  }

  async function carryForwardDues() {
    if (!seasonId) return toast.error(tx("Select a season", "সিজন বাছাই করুন"));
    if (!confirm(tx("Carry forward previous unpaid dues into this season? Old invoices will be marked as carried forward.", "পূর্বের অপরিশোধিত বকেয়া এই সিজনে আনা হবে? পুরোনো ইনভয়েস carried-forward হিসেবে চিহ্নিত হবে।"))) return;
    setBusy(true);
    try {
      // Current-season invoices (carry-forward targets)
      let curQ = db.from("irrigation_invoices" as any)
        .select("id,farmer_id,payable_amount,due_amount,previous_due_amount,generated_at")
        .eq("season_id", seasonId).neq("invoice_status", "cancelled").is("deleted_at", null);
      if (officeId) curQ = curQ.eq("office_id", officeId);
      const { data: cur } = await curQ;
      const targetByFarmer = new Map<string, any>();
      for (const inv of ((cur as any[]) ?? []).sort((a, b) => (a.generated_at || "").localeCompare(b.generated_at || ""))) {
        if (!targetByFarmer.has(inv.farmer_id)) targetByFarmer.set(inv.farmer_id, inv);
      }
      if (!targetByFarmer.size) { toast.error(tx("No invoices in this season yet — generate first.", "এই সিজনে কোনো ইনভয়েস নেই — আগে তৈরি করুন।")); return; }

      // Prior-season open dues
      let oldQ = db.from("irrigation_invoices" as any)
        .select("id,farmer_id,due_amount,delay_fee")
        .neq("season_id", seasonId).gt("due_amount", 0).is("deleted_at", null)
        .neq("invoice_status", "cancelled").neq("invoice_status", "carried_forward")
        .in("farmer_id", Array.from(targetByFarmer.keys()));
      if (officeId) oldQ = oldQ.eq("office_id", officeId);
      const { data: old } = await oldQ;

      const totals = new Map<string, number>();
      const oldByFarmer = new Map<string, string[]>();
      for (const r of ((old as any[]) ?? [])) {
        // Carry only principal dues — exclude the late fee (জরিমানা) so it doesn't roll into the new season.
        const carryAmt = Math.max(0, Number(r.due_amount || 0) - Number(r.delay_fee || 0));
        if (carryAmt <= 0) continue;
        totals.set(r.farmer_id, (totals.get(r.farmer_id) || 0) + carryAmt);
        oldByFarmer.set(r.farmer_id, [...(oldByFarmer.get(r.farmer_id) || []), r.id]);
      }
      if (!totals.size) { toast.success(tx("No previous dues to carry forward.", "হস্তান্তরযোগ্য কোনো পূর্ববর্তী বকেয়া নেই।")); return; }


      const now = new Date().toISOString();
      let done = 0;
      for (const [farmerId, total] of totals) {
        const target = targetByFarmer.get(farmerId);
        if (!target || !(total > 0)) continue;
        const { error: e1 } = await db.from("irrigation_invoices" as any).update({
          previous_due_amount: Number(target.previous_due_amount || 0) + total,
          payable_amount: Number(target.payable_amount || 0) + total,
          due_amount: Number(target.due_amount || 0) + total,
          carried_forward_at: now,
        }).eq("id", target.id);
        if (e1) { console.error(e1); continue; }
        await db.from("irrigation_invoices" as any).update({
          invoice_status: "carried_forward", due_amount: 0, carried_forward_to: target.id, carried_forward_at: now,
        }).in("id", oldByFarmer.get(farmerId) || []);
        done++;
      }
      toast.success(`${done} ${tx("farmer(s) — dues carried forward.", "জন কৃষকের বকেয়া হস্তান্তর হয়েছে।")}`);
      setPrevDueWarning(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>{tx("Season *", "সিজন *")}</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isSuper && (
              <div>
                <Label>{tx("Office (optional)", "অফিস (ঐচ্ছিক)")}</Label>
                <Select value={officeId || "all"} onValueChange={(v) => setOfficeId(v === "all" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
                    {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{tx("Fallback rate / shotok", "ফলব্যাক রেট/শতক")} <span className="text-xs text-muted-foreground">{tx("(if type rate missing)", "(ধরনের রেট না থাকলে)")}</span></Label>
              <Input type="number" value={rateOverride} onChange={(e) => setRateOverride(Number(e.target.value))} />
            </div>
            <div>
              <Label>{tx("Due *", "মেয়াদ *")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Default category (optional)", "ডিফল্ট ক্যাটেগরি (ঐচ্ছিক)")}</Label>
              <Select value={defaultCategoryId || "none"} onValueChange={(v) => setDefaultCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx("— None (use land-type rate) —", "— নেই (জমির ধরনের রেট) —")}</SelectItem>
                  {categories.map((c) => {
                    const r = categoryRates.find((x) => x.irrigation_category_id === c.id);
                    return (
                      <SelectItem key={c.id} value={c.id} disabled={!r || !(r.rate > 0)}>
                        {c.name_bn || c.name_en} {r && r.rate > 0 ? `— ${r.rate}/${r.rate_type}` : ` (${tx("no rate", "রেট নেই")})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          {seasonId && (
            <div className="text-xs text-muted-foreground">
              {Object.keys(rateMap).length > 0
                ? `${tx("Configured rates:", "কনফিগার্ড রেট:")} ${Object.entries(rateMap).map(([k, v]) => `${k}=${v}`).join(", ")}`
                : tx("No per-land-type rate for this season — set them on the Seasons page or provide a fallback rate.", "এই সিজনে কোনো জমির ধরনভিত্তিক রেট নেই — Seasons পেজ থেকে রেট সেট করুন বা ফলব্যাক রেট দিন।")}
            </div>
          )}
          {skippedNoRate > 0 && (
            <div className="text-xs text-destructive">{skippedNoRate} {tx("lands had no rate — skipped.", "টি জমিতে রেট পাওয়া যায়নি — বাদ দেওয়া হয়েছে।")}</div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} id="skip" />
            <Label htmlFor="skip">{tx("Skip already-created invoices (prevent duplicates)", "আগে তৈরি হওয়া ইনভয়েস বাদ দিন (ডুপ্লিকেট প্রতিরোধ)")}</Label>
          </div>
          <div className="space-y-1">
            <Label>{tx("Land type filter (only selected are invoiced)", "জমির ধরন ফিল্টার (শুধু নির্বাচিতগুলো ইনভয়েস হবে)")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost"
                onClick={() => setFieldTypes(new Set(landTypeList.map((lt) => lt.id)))}>
                {tx("All", "সব")}
              </Button>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => setFieldTypes(new Set())}>
                {tx("None", "কোনোটি নয়")}
              </Button>
              {landTypeList.map((lt) => (
                <Button
                  key={lt.id}
                  type="button"
                  size="sm"
                  variant={fieldTypes.has(lt.id) ? "default" : "outline"}
                  onClick={() => toggleFieldType(lt.id)}
                >
                  {lt.name_bn || lt.name_en || lt.code}
                </Button>
              ))}
            </div>
            {fieldTypes.size === 0 && (
              <p className="text-xs text-destructive">
                {tx("Select at least one land type to preview.", "প্রিভিউ করতে অন্তত একটি জমির ধরন নির্বাচন করুন।")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={preview} disabled={busy || !seasonId || fieldTypes.size === 0}>
              <Sparkles className="h-4 w-4 mr-1" /> {tx("Preview", "প্রিভিউ")}
            </Button>
            {previewRows && previewRows.length > 0 && (
              <Button variant="default" onClick={commit} disabled={busy}>
                {busy ? tx("Processing…", "প্রক্রিয়াকরণ…") : `${tx("Create", "তৈরি করুন")} ${previewRows.length} ${tx("invoices", "টি ইনভয়েস")}`}
              </Button>
            )}
            <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" /> {tx("Manual", "ম্যানুয়াল")}</Button>
            <Button variant="outline" onClick={carryForwardDues} disabled={busy || !seasonId}>{tx("Carry forward dues", "বকেয়া carry-forward")}</Button>
          </div>
        </CardContent>
      </Card>

      {prevDueWarning && previewRows && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{tx("Previous outstanding detected", "পূর্বের বকেয়া পাওয়া গেছে")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <div>{prevDueWarning.farmers} {tx("farmer(s) have prior unpaid invoices totalling", "জন কৃষকের আগের অপরিশোধিত ইনভয়েস রয়েছে — মোট")} <span className="font-mono font-semibold">{money(prevDueWarning.total)}</span>.</div>
            <Button size="sm" variant="outline" onClick={carryForwardDues} disabled={busy}>
              {tx("Carry forward previous dues (manual)", "পূর্ববর্তী বকেয়া carry-forward করুন (ম্যানুয়াল)")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {previewRows && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">{tx("Preview", "প্রিভিউ")} — {previewRows.length} {tx("invoices", "টি ইনভয়েস")}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                    <TableHead>{tx("Dag No", "দাগ নং")}</TableHead>
                    <TableHead>{tx("Note", "নোট")}</TableHead>
                    <TableHead className="text-right">{tx("Land size", "জমির পরিমাণ")}</TableHead>
                    <TableHead>{tx("Farmer/Owner member", "কৃষক/মালিক সভ্য সদস্য")}</TableHead>
                    <TableHead>{tx("Land type", "জমির ধরন")}</TableHead>
                    <TableHead>{tx("Source", "উৎস")}</TableHead>
                    <TableHead className="text-right">{tx("Rate (acre/bigha)", "রেট (একর/বিঘা)")}</TableHead>
                    <TableHead>{tx("Calculation", "হিসাব")}</TableHead>
                    <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
                    <TableHead>{tx("Manual override", "ম্যানুয়াল ওভাররাইড")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 100).map((r: any, i: number) => {
                    const cat = categories.find((c) => c.id === defaultCategoryId);
                    const allowManual = !cat || cat.allow_manual_negotiation || r.resolved?.isNegotiable !== false;
                    const src = r.resolved?.source ?? "STANDARD";
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.land.mouza || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-normal min-w-[140px]">{formatDagNumbers(r.land.dag_no) || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-normal max-w-[200px] text-muted-foreground">{(r.land.notes ?? "").trim() || "—"}</TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">{formatLandSize(r.billedArea > 0 ? r.billedArea : r.land.land_size, "short")}{r.billedArea > 0 && r.billedArea !== Number(r.land.land_size) ? ` / ${formatLandSize(r.land.land_size, "short")}` : ""}</TableCell>
                        <TableCell className="text-xs">{r.billed.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "মালিক")}`}</TableCell>
                        <TableCell className="text-xs">{r.resolved?.categoryName || r.land.land_type_name || r.land.field_type || "—"}</TableCell>

                        <TableCell>
                          {Number(r.manualRate) > 0 && r.manualReason?.trim()
                            ? <Badge variant="outline" className="text-xs">{tx("Manual", "ম্যানুয়াল")}</Badge>
                            : src === "CATEGORY"
                              ? <Badge variant="secondary" className="text-xs">{r.resolved?.categoryName || tx("Category", "ক্যাটাগরি")}</Badge>
                              : <Badge variant="outline" className="text-xs">{tx("Standard", "স্ট্যান্ডার্ড")}</Badge>}
                        </TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">{money(Number(r.manualRate) > 0 ? Number(r.manualRate) : r.rate)} / {money(((Number(r.manualRate) > 0 ? Number(r.manualRate) : Number(r.rate || 0)) * 33) / 100)}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {(() => {
                            const bd = describeBaseCalculation(
                              r.billedArea > 0 ? r.billedArea : Number(r.land.land_size),
                              Number(r.manualRate) > 0 ? Number(r.manualRate) : r.rate,
                              r.resolved?.basis,
                            );
                            return tx(bd.formula_en, bd.formula_bn);
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{money(r.calc.payable_amount)}</TableCell>
                        <TableCell>
                          {allowManual ? (
                            <div className="flex flex-col gap-1 min-w-[180px]">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={tx("Rate", "রেট")}
                                value={r.manualRate}
                                className="h-7 text-xs"
                                onChange={(e) => setPreviewRows((prev) => prev?.map((p, idx) => idx === i ? { ...p, manualRate: e.target.value } : p) ?? null)}
                              />
                              <Input
                                placeholder={tx("Reason (required)", "কারণ (আবশ্যক)")}
                                value={r.manualReason}
                                className="h-7 text-xs"
                                onChange={(e) => setPreviewRows((prev) => prev?.map((p, idx) => idx === i ? { ...p, manualReason: e.target.value } : p) ?? null)}
                              />
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {previewRows.length > 100 && <p className="text-xs text-muted-foreground mt-2">{tx("Showing first 100 only", "শুধু প্রথম ১০০ টি দেখানো হয়েছে")}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <ManualInvoiceDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        seasons={seasons}
        userId={userId}
      />
    </div>
  );
}

function ManualInvoiceDialog({ open, onOpenChange, seasons, userId }: any) {
  const { tx } = useLang();
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [lands, setLands] = useState<any[]>([]);
  const [landId, setLandId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [rate, setRate] = useState<number>(0);
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); });
  const [otherCharge, setOtherCharge] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!farmerId) { setLands([]); return; }
    (async () => {
      const [{ data: own }, { data: rels }] = await Promise.all([
        db.from("lands").select("id,dag_no,land_size,mouza,owner_farmer_id,office_id,field_type,notes").eq("farmer_id", farmerId).is("deleted_at", null),
        db.from("land_relations").select("land_id, lands(id,dag_no,land_size,mouza,owner_farmer_id,office_id,field_type)").eq("sharecropper_farmer_id", farmerId).is("deleted_at", null),
      ]);
      const ids = new Set((own ?? []).map((l: any) => l.id));
      const sc = (rels ?? []).map((r: any) => r.lands).filter((l: any) => l && !ids.has(l.id));
      setLands([...(own ?? []), ...sc]);
    })();
  }, [farmerId]);

  const [rateRow, setRateRow] = useState<RateRow | null>(null);

  useEffect(() => {
    if (!seasonId || !landId) { setRateRow(null); return; }
    const land = lands.find((l: any) => l.id === landId);
    if (!land) return;
    loadSeasonRateMap(seasonId, land.office_id ?? null).then((rows) => {
      const matched = resolveRateForLand(rows, land);
      setRateRow(matched ?? null);
      if (matched && matched.rate_per_shotok > 0) setRate(matched.rate_per_shotok);
    });
  }, [seasonId, landId, lands]);

  const [manualReason, setManualReason] = useState("");
  const isManualRate = !!seasonId && !!landId && (!rateRow || rateRow.rate_per_shotok <= 0);

  async function save() {
    if (!farmerId || !landId || !seasonId || !rate) return toast.error(tx("Fill all fields", "সব ফিল্ড পূরণ করুন"));
    if (isManualRate && manualReason.trim().length < 3) return toast.error(tx("Enter manual rate reason (at least 3 chars)", "ম্যানুয়াল রেটের কারণ লিখুন (অন্তত ৩ অক্ষর)"));
    setBusy(true);
    try {
      const land = lands.find((l: any) => l.id === landId);
      const billed = await resolveBilledFarmer(landId, dueDate);
      const rawSettings = await getChargeSettings(land?.office_id ?? null);
      // No auto delay fee at generation — penalty is added at payment time only.
      const settings = { ...rawSettings, auto_apply_delay_fee: false };
      const calc = calcInvoice({
        land_size_shotok: Number(land?.land_size ?? 0),
        rate_per_shotok: rate,
        settings,
        due_date: dueDate,
        other_charge: otherCharge,
      });
      const invoice_no = await generateInvoiceNo();
      const standardRate = rateRow?.rate_per_shotok ?? 0;
      const rateSource: "STANDARD" | "MANUAL" = isManualRate ? "MANUAL" : (standardRate > 0 && standardRate === rate ? "STANDARD" : "MANUAL");
      const { data: insertedRows, error } = await db.from("irrigation_invoices" as any).insert({
        invoice_no,
        office_id: land?.office_id ?? null,
        season_id: seasonId,
        land_id: landId,
        owner_farmer_id: billed.owner_farmer_id,
        farmer_id: billed.billed_farmer_id,
        is_borga: billed.is_borga,
        irrigation_amount: calc.irrigation_amount,
        maintenance_amount: calc.maintenance_amount,
        canal_amount: calc.canal_amount,
        delay_fee: calc.delay_fee,
        other_charge: calc.other_charge,
        payable_amount: calc.payable_amount,
        paid_amount: 0,
        due_date: dueDate,
        invoice_status: "generated",
        generated_by: userId,
        season_rate: rate,
        land_type_id: rateRow?.land_type_id ?? null,
        land_type_name: rateRow?.land_type_name ?? land?.field_type ?? null,
        is_manual_rate: isManualRate,
        manual_rate_reason: isManualRate ? manualReason.trim() : null,
        note: (land?.notes ?? "").trim() || null,
        // Phase 4 hybrid engine snapshot
        rate_source: rateSource,
        applied_rate: rate,
        original_standard_rate: standardRate,
        override_reason: rateSource === "MANUAL" ? (manualReason.trim() || null) : null,
        calculation_snapshot: {
          rate_per_shotok: rate,
          land_size_shotok: Number(land?.land_size ?? 0),
          land_type_code: rateRow?.land_type_code ?? land?.field_type ?? null,
          land_type_name: rateRow?.land_type_name ?? null,
          settings,
          calc,
          generated_at: new Date().toISOString(),
          source: "manual",
          rate_source: rateSource,
          applied_rate: rate,
          original_standard_rate: standardRate,
          is_manual_rate: isManualRate,
          manual_rate_reason: isManualRate ? manualReason.trim() : null,
        },
      } as any).select("id").maybeSingle() as any;
      if (error) throw error;
      // Audit row for any MANUAL override
      if (rateSource === "MANUAL" && insertedRows?.id) {
        await db.from("irrigation_rate_overrides" as any).insert({
          irrigation_invoice_id: insertedRows.id,
          original_rate: standardRate,
          overridden_rate: rate,
          override_reason: manualReason.trim() || "Manual invoice",
          created_by: userId,
        } as any);
      }
      toast.success(`${tx("Invoice", "ইনভয়েস")} ${invoice_no} ${tx("created", "তৈরি হয়েছে")}`);
      onOpenChange(false);
      setFarmerId(null); setLandId(""); setSeasonId(""); setRate(0); setOtherCharge(0); setManualReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{tx("Create manual invoice", "ম্যানুয়াল ইনভয়েস তৈরি")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{tx("Farmer", "কৃষক")}</Label>
            <FarmerSearchSelect blockInactive value={farmerId} onChange={(id) => { setFarmerId(id); setLandId(""); }} placeholder={tx("Search farmer", "কৃষক খুঁজুন")} />
          </div>
          <div>
            <Label>{tx("Land", "জমি")}</Label>
            <Select value={landId} onValueChange={setLandId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {lands.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.mouza} • Dag {formatDagNumbers(l.dag_no)} ({formatLandSize(l.land_size, "short")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tx("Season", "সিজন")}</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tx("Due date", "মেয়াদ")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Rate / shotok", "রেট/শতক")}</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
            <div>
              <Label>{tx("Other charge", "অন্যান্য চার্জ")}</Label>
              <Input type="number" value={otherCharge} onChange={(e) => setOtherCharge(Number(e.target.value))} />
            </div>
          </div>
          {seasonId && landId && (
            isManualRate ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tx("Season rate not configured", "সিজন রেট কনফিগার নেই")}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{tx("No irrigation rate is configured for this season and land type. Enter a manual rate and reason below, or configure the season rate first.", "এই সিজন ও জমির ধরনের জন্য কোনো সেচ রেট কনফিগার করা নেই। নিচে ম্যানুয়াল রেট ও কারণ দিন, অথবা প্রথমে সিজন রেট কনফিগার করুন।")}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/seasons" target="_blank">{tx("Go to season rates", "সিজন রেটে যান")}</Link>
                  </Button>
                  <div>
                    <Label>{tx("Manual rate reason *", "ম্যানুয়াল রেটের কারণ *")}</Label>
                    <Textarea rows={2} value={manualReason} onChange={(e) => setManualReason(e.target.value)}
                      placeholder={tx("e.g. one-off pilot invoice", "যেমন: এক-বার পরীক্ষামূলক ইনভয়েস")} />
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                {tx("Auto rate applied:", "স্বয়ংক্রিয় রেট প্রয়োগ:")} {rateRow?.land_type_name} → {money(rateRow?.rate_per_shotok ?? 0)}/{tx("shotok", "শতক")}
              </p>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={busy}>{busy ? "…" : tx("Create", "তৈরি করুন")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab({ offices, userId, isSuper }: any) {
  const { tx } = useLang();
  const [officeId, setOfficeId] = useState<string>("");
  const [s, setS] = useState<ChargeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!officeId) return;
    (async () => {
      setLoading(true);
      const { data } = await db
        .from("irrigation_charge_settings" as any)
        .select("*")
        .eq("office_id", officeId)
        .maybeSingle();
      setS(data ? { ...DEFAULT_SETTINGS, ...(data as any) } : DEFAULT_SETTINGS);
      setLoading(false);
    })();
  }, [officeId]);

  async function save() {
    if (!officeId) return toast.error(tx("Select an office", "একটি অফিস নির্বাচন করুন"));
    const { error } = await db
      .from("irrigation_charge_settings" as any)
      .upsert({
        office_id: officeId,
        delay_fee_percent: s.delay_fee_percent,
        maintenance_percent: s.maintenance_percent,
        canal_percent: s.canal_percent,
        grace_days: s.grace_days,
        auto_apply_delay_fee: s.auto_apply_delay_fee,
        updated_by: userId,
      } as any, { onConflict: "office_id" });
    if (error) return toast.error(error.message);
    toast.success(tx("Settings saved", "সেটিংস সংরক্ষিত হয়েছে"));
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 max-w-xl">
        <div>
          <Label>{tx("Office", "অফিস")}</Label>
          <Select value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger><SelectValue placeholder={tx("Select an office", "অফিস নির্বাচন করুন")} /></SelectTrigger>
            <SelectContent>
              {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {officeId && !loading && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Maintenance % (on irrigation charge)", "রক্ষণাবেক্ষণ % (সেচ চার্জের উপর)")}</Label>
                <Input type="number" step="0.01" value={s.maintenance_percent}
                  onChange={(e) => setS({ ...s, maintenance_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{tx("Canal charge %", "খাল/নালা চার্জ %")}</Label>
                <Input type="number" step="0.01" value={s.canal_percent}
                  onChange={(e) => setS({ ...s, canal_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{tx("Late fee %", "বিলম্ব ফি %")}</Label>
                <Input type="number" step="0.01" value={s.delay_fee_percent}
                  onChange={(e) => setS({ ...s, delay_fee_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{tx("Grace period (days)", "গ্রেস পিরিয়ড (দিন)")}</Label>
                <Input type="number" value={s.grace_days}
                  onChange={(e) => setS({ ...s, grace_days: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={s.auto_apply_delay_fee}
                onCheckedChange={(v) => setS({ ...s, auto_apply_delay_fee: v })} />
              <Label htmlFor="auto">{tx("Apply late fee automatically", "স্বয়ংক্রিয়ভাবে বিলম্ব ফি প্রযোজ্য করুন")}</Label>
            </div>
            <Button onClick={save}>{tx("Save", "সংরক্ষণ করুন")}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
