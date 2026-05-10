import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  calcInvoice, getChargeSettings, generateInvoiceNo, resolveBilledFarmer,
  DEFAULT_SETTINGS, type ChargeSettings, type InvoiceStatus,
} from "@/lib/irrigationInvoice";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";
import { Sparkles, Plus, Eye, Ban, RefreshCw, ShieldCheck, AlertTriangle, FileSpreadsheet, FileDown, Pencil, Trash2, Printer, Settings as SettingsIcon, Share2, MessageCircle, Mail, Files } from "lucide-react";
import { exportInvoicesXLSX, exportInvoicesCSV } from "@/lib/irrigationExports";
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

type Invoice = any;

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

  const [tab, setTab] = useState<"generate" | "list" | "settings">("list");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  useEffect(() => {
    document.title = `${tx("Irrigation Invoices", "সেচ ইনভয়েস")} — ${t("appName")}`;
    Promise.all([
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("offices").select("id,name").order("name"),
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
        </TabsList>

        <TabsContent value="list"><InvoiceListTab seasons={seasons} offices={offices} isSuper={isSuper} /></TabsContent>
        <TabsContent value="generate"><GenerateTab seasons={seasons} offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
        <TabsContent value="settings"><SettingsTab offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
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
  const [seasonId, setSeasonId] = useState("all");
  const [officeId, setOfficeId] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
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
    supabase.from("profiles").select("id,full_name,username").order("full_name").limit(500)
      .then(({ data }) => setStaff((data as any) ?? []));
  }, []);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("irrigation_invoices" as any)
      .select("*, farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn,farmer_code,mobile), lands(dag_no,land_size,mouza), seasons(name,year,type)")
      .is("deleted_at", null)
      .order("generated_at", { ascending: false })
      .limit(500);
    if (seasonId !== "all") q = q.eq("season_id", seasonId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    if (status !== "all") q = q.eq("invoice_status", status);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); }, [seasonId, officeId, status]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) =>
      r.invoice_no?.toLowerCase().includes(s) ||
      r.farmers?.name_en?.toLowerCase().includes(s) ||
      r.farmers?.name_bn?.toLowerCase().includes(s) ||
      r.farmers?.farmer_code?.toLowerCase().includes(s) ||
      r.farmers?.mobile?.includes(s) ||
      matchesDagSearch(r.lands?.dag_no, s) ||
      r.lands?.mouza?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  async function cancelInvoice(inv: any) {
    const ok = await confirm({
      title: tx("Cancel invoice?", "ইনভয়েস বাতিল করুন?"),
      description: `${inv.invoice_no} — ${money(inv.payable_amount)} ${tx("BDT. This cannot be undone.", "টাকা। এটি পুনরুদ্ধার করা যাবে না।")}`,
      destructive: true, confirmText: tx("Cancel it", "বাতিল করুন"),
    });
    if (!ok) return;
    const { error } = await supabase
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
    const { error } = await supabase
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
      invoice_status: inv.invoice_status,
      farmer: {
        name: inv.farmers?.name_bn ?? inv.farmers?.name_en,
        farmer_code: inv.farmers?.farmer_code,
        mobile: inv.farmers?.mobile,
        village: inv.farmers?.village ?? null,
      },
      land: {
        mouza: inv.lands?.mouza,
        dag_no: inv.lands?.dag_no,
        land_size: inv.lands?.land_size,
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

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
            <Label>{tx("Status", "স্ট্যাটাস")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
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
            <Input placeholder={tx("Invoice no / farmer / code / mobile / dag / mouza", "ইনভয়েস নং / কৃষক / কোড / মোবাইল / দাগ / মৌজা")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">{filtered.length} {tx("invoices", "টি ইনভয়েস")} {loading && tx("(loading…)", "(লোড হচ্ছে…)")}</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => exportInvoicesCSV(filtered, "irrigation-invoices.csv", lang)} disabled={!filtered.length}>
              <FileDown className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportInvoicesXLSX(filtered, "irrigation-invoices.xlsx", lang)} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>

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
                  <TableCell className="text-xs">
                    {r.lands?.mouza ? `${r.lands.mouza} • ` : ""}Dag {formatDagNumbers(r.lands?.dag_no) || "—"}<br />
                    {formatLandSize(r.lands?.land_size, "short")}
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
                  <Select value={pdfSettings.paperFormat} onValueChange={(v) => setPdfSettings({ ...pdfSettings, paperFormat: v as any, cutLineMm: v === "letter" ? 139.7 : 148.5 })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
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
  const [dueDate, setDueDate] = useState("");
  const [otherCharge, setOtherCharge] = useState("0");
  const [delayFee, setDelayFee] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inv) return;
    setDueDate(inv.due_date ?? "");
    setOtherCharge(String(inv.other_charge ?? 0));
    setDelayFee(String(inv.delay_fee ?? 0));
    setNote(inv.note ?? "");
  }, [inv?.id]);

  if (!inv) return null;

  async function save() {
    const oc = Number(otherCharge) || 0;
    const df = Number(delayFee) || 0;
    if (oc < 0 || df < 0) return toast.error(tx("Negative values not allowed", "ঋণাত্মক মান দেওয়া যাবে না"));
    if (!dueDate) return toast.error(tx("Enter due date", "মেয়াদ তারিখ দিন"));
    setBusy(true);
    const payable = Number(inv.irrigation_amount) + Number(inv.maintenance_amount) + Number(inv.canal_amount) + oc + df;
    const due = Math.max(0, payable - Number(inv.paid_amount ?? 0));
    const newStatus =
      inv.invoice_status === "cancelled" ? inv.invoice_status :
      due === 0 ? "paid" :
      Number(inv.paid_amount ?? 0) > 0 ? "partial_paid" :
      new Date(dueDate) < new Date() ? "overdue" : "generated";
    const { error } = await supabase
      .from("irrigation_invoices" as any)
      .update({
        due_date: dueDate,
        other_charge: oc,
        delay_fee: df,
        note: note || null,
        payable_amount: payable,
        due_amount: due,
        invoice_status: newStatus,
      } as any)
      .eq("id", inv.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(tx("Invoice updated", "ইনভয়েস হালনাগাদ হয়েছে"));
    onSaved?.(); onClose();
  }

  return (
    <Dialog open={!!inv} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx("Edit invoice", "ইনভয়েস এডিট")} — {inv.invoice_no}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{tx("Due date", "মেয়াদ তারিখ")}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tx("Other charge", "অন্যান্য চার্জ")}</Label>
              <Input type="number" min="0" step="0.01" value={otherCharge} onChange={(e) => setOtherCharge(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Late fee", "বিলম্ব ফি")}</Label>
              <Input type="number" min="0" step="0.01" value={delayFee} onChange={(e) => setDelayFee(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{tx("Note", "মন্তব্য")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-muted-foreground">
            {tx("Use \"Recalculate\" to change irrigation/maintenance/canal amounts.", "সেচ/রক্ষণাবেক্ষণ/খাল চার্জ পরিবর্তনের জন্য “পুনঃগণনা” ব্যবহার করুন।")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tx("Close", "বন্ধ")}</Button>
          <Button onClick={save} disabled={busy}>{busy ? tx("Saving…", "সংরক্ষণ…") : tx("Save", "সংরক্ষণ করুন")}</Button>
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
  if (!inv) return null;

  async function recalc() {
    if (reason.trim().length < 3) return toast.error(tx("Enter a reason (at least 3 chars)", "কারণ লিখুন (অন্তত ৩ অক্ষর)"));
    setBusy(true);
    try {
      const { error } = await supabase.rpc("recalculate_irrigation_invoice" as any, {
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
            {inv.is_manual_rate && <Badge variant="outline" className="text-xs">{tx("Manual rate", "ম্যানুয়াল রেট")}</Badge>}
            <Badge variant="secondary" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" />{tx("Snapshot protected", "স্ন্যাপশট সুরক্ষিত")}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Row k={tx("Farmer", "কৃষক")} v={`${inv.farmers?.name_bn ?? inv.farmers?.name_en} (${inv.farmers?.farmer_code})`} />
          <Row k={tx("Type", "ধরন")} v={inv.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "নিজ মালিক")}`} />
          <Row k={tx("Land", "জমি")} v={`${inv.lands?.mouza ?? ""} • Dag ${formatDagNumbers(inv.lands?.dag_no) || "—"} • ${formatLandSize(inv.lands?.land_size)}`} />
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
  const [skippedNoRate, setSkippedNoRate] = useState(0);
  const [skipExisting, setSkipExisting] = useState(true);

  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!seasonId) { setRateMap([]); return; }
    loadSeasonRateMap(seasonId, officeId || null).then(setRateMap);
  }, [seasonId, officeId]);

  async function preview() {
    if (!seasonId) return toast.error(tx("Select a season", "সিজন বাছাই করুন"));
    setBusy(true);
    setSkippedNoRate(0);
    try {
      let lq = supabase.from("lands").select("id, farmer_id, owner_farmer_id, land_size, office_id, dag_no, mouza, field_type, land_type_id").is("deleted_at", null);
      if (officeId) lq = lq.eq("office_id", officeId);
      const { data: lands, error: lerr } = await lq;
      if (lerr) throw lerr;

      let skip = new Set<string>();
      if (skipExisting) {
        const { data: existing } = await supabase
          .from("irrigation_invoices" as any)
          .select("land_id")
          .eq("season_id", seasonId)
          .neq("invoice_status", "cancelled")
          .is("deleted_at", null);
        skip = new Set((existing as any[] | null ?? []).map((r: any) => r.land_id));
      }

      const targetOffice = officeId || (lands?.[0]?.office_id ?? null);
      const settings = await getChargeSettings(targetOffice);

      const eligible = (lands ?? []).filter((l: any) => Number(l.land_size) > 0 && !skip.has(l.id));

      const previewArr: any[] = [];
      let noRate = 0;
      for (const l of eligible) {
        const matched = resolveRateForLand(rateMap, l);
        const rate = matched && matched.rate_per_shotok > 0 ? matched.rate_per_shotok : rateOverride;
        if (!(rate > 0)) { noRate++; continue; }
        const billed = await resolveBilledFarmer(l.id, dueDate);
        const calc = calcInvoice({
          land_size_shotok: Number(l.land_size),
          rate_per_shotok: rate,
          settings,
          due_date: dueDate,
          as_of: new Date().toISOString().slice(0, 10),
        });
        previewArr.push({ land: l, billed, calc, settings, rate, rateRow: matched });
      }
      setPreviewRows(previewArr);
      setSkippedNoRate(noRate);
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
          const invoice_no = await generateInvoiceNo();
          const payload: any = {
            invoice_no,
            office_id: row.land.office_id ?? officeId ?? null,
            season_id: seasonId,
            land_id: row.land.id,
            owner_farmer_id: row.billed.owner_farmer_id,
            farmer_id: row.billed.billed_farmer_id,
            is_borga: row.billed.is_borga,
            irrigation_amount: row.calc.irrigation_amount,
            maintenance_amount: row.calc.maintenance_amount,
            canal_amount: row.calc.canal_amount,
            delay_fee: row.calc.delay_fee,
            other_charge: row.calc.other_charge,
            payable_amount: row.calc.payable_amount,
            paid_amount: 0,
            due_date: dueDate,
            invoice_status: "generated",
            generated_by: userId,
            season_rate: row.rate,
            land_type_id: row.rateRow?.land_type_id ?? null,
            land_type_name: row.rateRow?.land_type_name ?? row.land.field_type ?? null,
            calculation_snapshot: {
              rate_per_shotok: row.rate,
              land_size_shotok: Number(row.land.land_size),
              land_type_code: row.rateRow?.land_type_code ?? row.land.field_type ?? null,
              land_type_name: row.rateRow?.land_type_name ?? null,
              settings: row.settings,
              calc: row.calc,
              generated_at: new Date().toISOString(),
            },
          };
          // Hybrid rate engine snapshot fields (Phase 4)
          payload.rate_source = "STANDARD";
          payload.applied_rate = row.rate;
          payload.original_standard_rate = row.rate;
          const { error } = await supabase.from("irrigation_invoices" as any).insert(payload);
          if (error) { failed++; console.error(error); } else success++;
        } catch (e) { failed++; console.error(e); }
      }
      toast.success(`${success} ${tx("created", "টি তৈরি হয়েছে")}${failed ? `, ${failed} ${tx("failed", "ব্যর্থ")}` : ""}`);
      setPreviewRows(null);
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
          <div className="flex gap-2">
            <Button onClick={preview} disabled={busy || !seasonId}>
              <Sparkles className="h-4 w-4 mr-1" /> {tx("Preview", "প্রিভিউ")}
            </Button>
            {previewRows && previewRows.length > 0 && (
              <Button variant="default" onClick={commit} disabled={busy}>
                {busy ? tx("Processing…", "প্রক্রিয়াকরণ…") : `${tx("Create", "তৈরি করুন")} ${previewRows.length} ${tx("invoices", "টি ইনভয়েস")}`}
              </Button>
            )}
            <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" /> {tx("Manual", "ম্যানুয়াল")}</Button>
          </div>
        </CardContent>
      </Card>

      {previewRows && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">{tx("Preview", "প্রিভিউ")} — {previewRows.length} {tx("invoices", "টি ইনভয়েস")}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Land", "জমি")}</TableHead>
                    <TableHead>{tx("Billed to", "বিল প্রাপক")}</TableHead>
                    <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
                    <TableHead className="text-right">{tx("Maint.", "রক্ষণা.")}</TableHead>
                    <TableHead className="text-right">{tx("Canal", "খাল")}</TableHead>
                    <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 100).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.land.mouza} • Dag {formatDagNumbers(r.land.dag_no)}<br />{formatLandSize(r.land.land_size, "short")}</TableCell>
                      <TableCell className="text-xs">{r.billed.is_borga ? `🤝 ${tx("Sharecropper", "বর্গাদার")}` : `🏠 ${tx("Owner", "মালিক")}`}</TableCell>
                      <TableCell className="text-right">{money(r.calc.irrigation_amount)}</TableCell>
                      <TableCell className="text-right">{money(r.calc.maintenance_amount)}</TableCell>
                      <TableCell className="text-right">{money(r.calc.canal_amount)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.calc.payable_amount)}</TableCell>
                    </TableRow>
                  ))}
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
        supabase.from("lands").select("id,dag_no,land_size,mouza,owner_farmer_id,office_id,field_type").eq("farmer_id", farmerId).is("deleted_at", null),
        supabase.from("land_relations").select("land_id, lands(id,dag_no,land_size,mouza,owner_farmer_id,office_id,field_type)").eq("sharecropper_farmer_id", farmerId).is("deleted_at", null),
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
      const settings = await getChargeSettings(land?.office_id ?? null);
      const calc = calcInvoice({
        land_size_shotok: Number(land?.land_size ?? 0),
        rate_per_shotok: rate,
        settings,
        due_date: dueDate,
        other_charge: otherCharge,
      });
      const invoice_no = await generateInvoiceNo();
      const { error } = await supabase.from("irrigation_invoices" as any).insert({
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
        calculation_snapshot: {
          rate_per_shotok: rate,
          land_size_shotok: Number(land?.land_size ?? 0),
          land_type_code: rateRow?.land_type_code ?? land?.field_type ?? null,
          land_type_name: rateRow?.land_type_name ?? null,
          settings,
          calc,
          generated_at: new Date().toISOString(),
          source: "manual",
          is_manual_rate: isManualRate,
          manual_rate_reason: isManualRate ? manualReason.trim() : null,
        },
      } as any);
      if (error) throw error;
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
            <FarmerSearchSelect value={farmerId} onChange={(id) => { setFarmerId(id); setLandId(""); }} placeholder={tx("Search farmer", "কৃষক খুঁজুন")} />
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
      const { data } = await supabase
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
    const { error } = await supabase
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
