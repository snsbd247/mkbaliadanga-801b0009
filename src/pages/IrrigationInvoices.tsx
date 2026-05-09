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
import {
  calcInvoice, getChargeSettings, generateInvoiceNo, resolveBilledFarmer,
  DEFAULT_SETTINGS, type ChargeSettings, type InvoiceStatus,
} from "@/lib/irrigationInvoice";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";
import { Sparkles, Plus, Eye, Ban, RefreshCw, ShieldCheck, AlertTriangle, FileSpreadsheet, FileDown, Pencil, Trash2, Printer } from "lucide-react";
import { exportInvoicesXLSX, exportInvoicesCSV } from "@/lib/irrigationExports";
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

const STATUS_LABEL_BN: Record<InvoiceStatus, string> = {
  draft: "খসড়া",
  generated: "ইস্যু",
  partial_paid: "আংশিক",
  paid: "পরিশোধিত",
  overdue: "মেয়াদোত্তীর্ণ",
  cancelled: "বাতিল",
};

export default function IrrigationInvoices() {
  const { t } = useLang();
  const { user, isSuper } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [tab, setTab] = useState<"generate" | "list" | "settings">("list");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  useEffect(() => {
    document.title = `সেচ ইনভয়েস — ${t("appName")}`;
    Promise.all([
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("offices").select("id,name").order("name"),
    ]).then(([s, o]) => { setSeasons(s.data ?? []); setOffices(o.data ?? []); });
  }, []);

  return (
    <>
      <PageHeader title="সেচ ইনভয়েস" description="ইনভয়েস তৈরি, তালিকা ও সেটিংস। অর্থ গ্রহণ পেমেন্ট পেজ থেকে করুন।" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="list">ইনভয়েস তালিকা</TabsTrigger>
          <TabsTrigger value="generate">ইনভয়েস তৈরি</TabsTrigger>
          <TabsTrigger value="settings">সেটিংস</TabsTrigger>
        </TabsList>

        <TabsContent value="list"><InvoiceListTab seasons={seasons} offices={offices} isSuper={isSuper} /></TabsContent>
        <TabsContent value="generate"><GenerateTab seasons={seasons} offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
        <TabsContent value="settings"><SettingsTab offices={offices} userId={user?.id} isSuper={isSuper} /></TabsContent>
      </Tabs>
      {confirmDialog}
    </>
  );
}

// ============================================================
// LIST TAB
// ============================================================
function InvoiceListTab({ seasons, offices, isSuper }: any) {
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [seasonId, setSeasonId] = useState("all");
  const [officeId, setOfficeId] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);

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
      r.farmers?.farmer_code?.toLowerCase().includes(s) ||
      r.farmers?.mobile?.includes(s)
    );
  }, [rows, search]);

  async function cancelInvoice(inv: any) {
    const ok = await confirm({
      title: "ইনভয়েস বাতিল করুন?",
      description: `${inv.invoice_no} — ${money(inv.payable_amount)} টাকা। এটি পুনরুদ্ধার করা যাবে না।`,
      destructive: true, confirmText: "বাতিল করুন",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("irrigation_invoices" as any)
      .update({ invoice_status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Manually cancelled" } as any)
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("ইনভয়েস বাতিল করা হয়েছে"); load();
  }

  async function deleteInvoice(inv: any) {
    const ok = await confirm({
      title: "ইনভয়েস মুছে ফেলবেন?",
      description: `${inv.invoice_no} — মুছে ফেলা ইনভয়েস তালিকায় দেখাবে না।`,
      destructive: true, confirmText: "মুছুন",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("irrigation_invoices" as any)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("ইনভয়েস মুছে ফেলা হয়েছে"); load();
  }

  function printInvoice(inv: any) {
    const farmer = inv.farmers?.name_bn ?? inv.farmers?.name_en ?? "—";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoice_no}</title>
<style>
  body{font-family:'Noto Sans Bengali',system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:0 0 16px;color:#555;font-weight:500}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  td,th{border:1px solid #ddd;padding:6px 10px;font-size:13px;text-align:left}
  th{background:#f6f6f6}
  .right{text-align:right} .total{font-weight:700;background:#fafafa}
  .meta td{border:none;padding:2px 0}
  @media print{button{display:none}}
</style></head><body>
  <h1>সেচ ইনভয়েস — ${inv.invoice_no}</h1>
  <h2>${inv.seasons?.name ?? inv.seasons?.type ?? ""} ${inv.seasons?.year ?? ""}</h2>
  <table class="meta">
    <tr><td><b>কৃষক:</b></td><td>${farmer} (${inv.farmers?.farmer_code ?? ""})</td></tr>
    <tr><td><b>মোবাইল:</b></td><td>${inv.farmers?.mobile ?? "—"}</td></tr>
    <tr><td><b>জমি:</b></td><td>${inv.lands?.mouza ?? ""} • Dag ${inv.lands?.dag_no ?? "—"} • ${formatLandSize(inv.lands?.land_size) ?? ""}</td></tr>
    <tr><td><b>ধরন:</b></td><td>${inv.is_borga ? "বর্গাদার" : "নিজ মালিক"}</td></tr>
    <tr><td><b>ইস্যু তারিখ:</b></td><td>${fmtDate(inv.generated_at)}</td></tr>
    <tr><td><b>মেয়াদ:</b></td><td>${fmtDate(inv.due_date)}</td></tr>
  </table>
  <table>
    <thead><tr><th>বিবরণ</th><th class="right">টাকা</th></tr></thead>
    <tbody>
      <tr><td>সেচ চার্জ</td><td class="right">${money(inv.irrigation_amount)}</td></tr>
      <tr><td>রক্ষণাবেক্ষণ</td><td class="right">${money(inv.maintenance_amount)}</td></tr>
      <tr><td>খাল/নালা</td><td class="right">${money(inv.canal_amount)}</td></tr>
      <tr><td>অন্যান্য</td><td class="right">${money(inv.other_charge)}</td></tr>
      <tr><td>বিলম্ব ফি</td><td class="right">${money(inv.delay_fee)}</td></tr>
      <tr class="total"><td>মোট প্রদেয়</td><td class="right">${money(inv.payable_amount)}</td></tr>
      <tr><td>পরিশোধিত</td><td class="right">${money(inv.paid_amount)}</td></tr>
      <tr class="total"><td>বকেয়া</td><td class="right">${money(inv.due_amount)}</td></tr>
    </tbody>
  </table>
  ${inv.note ? `<p><b>মন্তব্য:</b> ${inv.note}</p>` : ""}
  <p style="margin-top:24px;font-size:11px;color:#777">প্রিন্ট: ${new Date().toLocaleString("bn-BD")}</p>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast.error("পপআপ অনুমতি দিন");
    w.document.write(html); w.document.close();
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>সিজন</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব</SelectItem>
                {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isSuper && (
            <div>
              <Label>অফিস</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>স্ট্যাটাস</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব</SelectItem>
                <SelectItem value="generated">ইস্যু</SelectItem>
                <SelectItem value="partial_paid">আংশিক</SelectItem>
                <SelectItem value="paid">পরিশোধিত</SelectItem>
                <SelectItem value="overdue">মেয়াদোত্তীর্ণ</SelectItem>
                <SelectItem value="cancelled">বাতিল</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>খুঁজুন</Label>
            <Input placeholder="ইনভয়েস নং / কৃষক নাম / কোড / মোবাইল" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{filtered.length} টি ইনভয়েস {loading && "(লোড হচ্ছে…)"}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportInvoicesCSV(filtered)} disabled={!filtered.length}>
              <FileDown className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportInvoicesXLSX(filtered)} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ইনভয়েস নং</TableHead>
                <TableHead>কৃষক</TableHead>
                <TableHead>জমি</TableHead>
                <TableHead>সিজন</TableHead>
                <TableHead className="text-right">প্রদেয়</TableHead>
                <TableHead className="text-right">পরিশোধিত</TableHead>
                <TableHead className="text-right">বকেয়া</TableHead>
                <TableHead>মেয়াদ</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.farmers?.name_bn ?? r.farmers?.name_en ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.farmers?.farmer_code} {r.is_borga && <span className="ml-1">🤝 বর্গা</span>}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.lands?.mouza ? `${r.lands.mouza} • ` : ""}Dag {r.lands?.dag_no ?? "—"}<br />
                    {formatLandSize(r.lands?.land_size, "short")}
                  </TableCell>
                  <TableCell className="text-xs">{r.seasons?.name ?? r.seasons?.type} {r.seasons?.year}</TableCell>
                  <TableCell className="text-right">{money(r.payable_amount)}</TableCell>
                  <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due_amount)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.invoice_status as InvoiceStatus]}>
                      {STATUS_LABEL_BN[r.invoice_status as InvoiceStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewId(r.id)}><Eye className="h-4 w-4" /></Button>
                      {r.invoice_status !== "cancelled" && r.invoice_status !== "paid" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelInvoice(r)}><Ban className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">কোন ইনভয়েস নেই</TableCell></TableRow>
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
      </CardContent>
    </Card>
  );
}

// ============================================================
// PREVIEW DIALOG
// ============================================================
function InvoicePreviewDialog({ invoiceId, onClose, allRows, onRecalculated }: any) {
  const { isSuper } = useAuth();
  const inv = allRows.find((r: any) => r.id === invoiceId);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!inv) return null;

  async function recalc() {
    if (reason.trim().length < 3) return toast.error("কারণ লিখুন (অন্তত ৩ অক্ষর)");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("recalculate_irrigation_invoice" as any, {
        _invoice_id: inv.id, _reason: reason.trim(),
      });
      if (error) throw error;
      toast.success("ইনভয়েস পুনঃগণনা হয়েছে");
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
            ইনভয়েস {inv.invoice_no}
            {inv.is_manual_rate && <Badge variant="outline" className="text-xs">ম্যানুয়াল রেট</Badge>}
            <Badge variant="secondary" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" />স্ন্যাপশট সুরক্ষিত</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Row k="কৃষক" v={`${inv.farmers?.name_bn ?? inv.farmers?.name_en} (${inv.farmers?.farmer_code})`} />
          <Row k="ধরন" v={inv.is_borga ? "🤝 বর্গাদার" : "🏠 নিজ মালিক"} />
          <Row k="জমি" v={`${inv.lands?.mouza ?? ""} • Dag ${inv.lands?.dag_no} • ${formatLandSize(inv.lands?.land_size)}`} />
          <Row k="জমির ধরন" v={inv.land_type_name ?? "—"} />
          <Row k="সিজন" v={`${inv.seasons?.name ?? inv.seasons?.type} ${inv.seasons?.year}`} />
          <Row k="সিজন রেট/শতক" v={inv.season_rate != null ? money(inv.season_rate) : "—"} />
          <Row k="মেয়াদ" v={fmtDate(inv.due_date)} />
          <hr />
          <Row k="সেচ চার্জ" v={money(inv.irrigation_amount)} />
          <Row k="রক্ষণাবেক্ষণ চার্জ" v={money(inv.maintenance_amount)} />
          <Row k="খাল/নালা চার্জ" v={money(inv.canal_amount)} />
          <Row k="অন্যান্য" v={money(inv.other_charge)} />
          <Row k="বিলম্ব ফি" v={money(inv.delay_fee)} />
          <hr />
          <Row k="মোট প্রদেয়" v={money(inv.payable_amount)} bold />
          <Row k="পরিশোধিত" v={money(inv.paid_amount)} />
          <Row k="বকেয়া" v={money(inv.due_amount)} bold />
          <hr />
          <Row k="স্ট্যাটাস" v={STATUS_LABEL_BN[inv.invoice_status as InvoiceStatus]} />
          <Row k="তৈরির তারিখ" v={fmtDate(inv.generated_at)} />
          {inv.recalculated_at && <Row k="শেষ পুনঃগণনা" v={fmtDate(inv.recalculated_at)} />}
          {inv.manual_rate_reason && <Row k="ম্যানুয়াল রেটের কারণ" v={inv.manual_rate_reason} />}
          {inv.calculation_snapshot && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">গণনা স্ন্যাপশট (অপরিবর্তনীয়)</summary>
              <pre className="text-[10px] bg-muted/40 p-2 rounded mt-1 overflow-auto max-h-40">
{JSON.stringify(inv.calculation_snapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
        <DialogFooter className="gap-2">
          {isSuper && inv.invoice_status !== "cancelled" && (
            <Button variant="outline" onClick={() => setRecalcOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-1" />পুনঃগণনা
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>বন্ধ করুন</Button>
        </DialogFooter>

        <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>ইনভয়েস পুনঃগণনা</DialogTitle></DialogHeader>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>সতর্কতা</AlertTitle>
              <AlertDescription>
                বর্তমান সিজন রেট ব্যবহার করে এই ইনভয়েস পুনঃগণনা হবে। পুরোনো স্ন্যাপশট অডিট লগে সংরক্ষণ থাকবে।
              </AlertDescription>
            </Alert>
            <div>
              <Label>কারণ *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="যেমন: রেট ভুল কনফিগার করা হয়েছিল" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecalcOpen(false)}>বাতিল</Button>
              <Button onClick={recalc} disabled={busy}>{busy ? "…" : "পুনঃগণনা করুন"}</Button>
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

// ============================================================
// GENERATE TAB
// ============================================================
function GenerateTab({ seasons, offices, userId, isSuper }: any) {
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

  // Load per-land-type rate matrix when season/office changes.
  useEffect(() => {
    if (!seasonId) { setRateMap([]); return; }
    loadSeasonRateMap(seasonId, officeId || null).then(setRateMap);
  }, [seasonId, officeId]);

  async function preview() {
    if (!seasonId) return toast.error("সিজন বাছাই করুন");
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
      toast.success(`${previewArr.length} টি প্রিভিউ${noRate ? ` • ${noRate} টি জমিতে রেট নেই` : ""}`);
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
          const { error } = await supabase.from("irrigation_invoices" as any).insert(payload);
          if (error) { failed++; console.error(error); } else success++;
        } catch (e) { failed++; console.error(e); }
      }
      toast.success(`${success} টি তৈরি হয়েছে${failed ? `, ${failed} ব্যর্থ` : ""}`);
      setPreviewRows(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>সিজন *</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isSuper && (
              <div>
                <Label>অফিস (ঐচ্ছিক)</Label>
                <Select value={officeId || "all"} onValueChange={(v) => setOfficeId(v === "all" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব অফিস</SelectItem>
                    {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>ফলব্যাক রেট/শতক <span className="text-xs text-muted-foreground">(ধরনের রেট না থাকলে)</span></Label>
              <Input type="number" value={rateOverride} onChange={(e) => setRateOverride(Number(e.target.value))} />
            </div>
            <div>
              <Label>মেয়াদ *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {seasonId && (
            <div className="text-xs text-muted-foreground">
              {Object.keys(rateMap).length > 0
                ? `কনফিগার্ড রেট: ${Object.entries(rateMap).map(([k, v]) => `${k}=${v}`).join(", ")}`
                : "এই সিজনে কোনো জমির ধরনভিত্তিক রেট নেই — Seasons পেজ থেকে রেট সেট করুন বা ফলব্যাক রেট দিন।"}
            </div>
          )}
          {skippedNoRate > 0 && (
            <div className="text-xs text-destructive">{skippedNoRate} টি জমিতে রেট পাওয়া যায়নি — বাদ দেওয়া হয়েছে।</div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} id="skip" />
            <Label htmlFor="skip">আগে তৈরি হওয়া ইনভয়েস বাদ দিন (ডুপ্লিকেট প্রতিরোধ)</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={preview} disabled={busy || !seasonId}>
              <Sparkles className="h-4 w-4 mr-1" /> প্রিভিউ
            </Button>
            {previewRows && previewRows.length > 0 && (
              <Button variant="default" onClick={commit} disabled={busy}>
                {busy ? "প্রক্রিয়াকরণ…" : `${previewRows.length} টি ইনভয়েস তৈরি করুন`}
              </Button>
            )}
            <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" /> ম্যানুয়াল</Button>
          </div>
        </CardContent>
      </Card>

      {previewRows && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">প্রিভিউ — {previewRows.length} টি ইনভয়েস</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>জমি</TableHead>
                    <TableHead>বিল প্রাপক</TableHead>
                    <TableHead className="text-right">সেচ</TableHead>
                    <TableHead className="text-right">রক্ষণা.</TableHead>
                    <TableHead className="text-right">খাল</TableHead>
                    <TableHead className="text-right">প্রদেয়</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 100).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.land.mouza} • Dag {r.land.dag_no}<br />{formatLandSize(r.land.land_size, "short")}</TableCell>
                      <TableCell className="text-xs">{r.billed.is_borga ? "🤝 বর্গাদার" : "🏠 মালিক"}</TableCell>
                      <TableCell className="text-right">{money(r.calc.irrigation_amount)}</TableCell>
                      <TableCell className="text-right">{money(r.calc.maintenance_amount)}</TableCell>
                      <TableCell className="text-right">{money(r.calc.canal_amount)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.calc.payable_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewRows.length > 100 && <p className="text-xs text-muted-foreground mt-2">শুধু প্রথম ১০০ টি দেখানো হয়েছে</p>}
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

// ============================================================
// MANUAL CREATE DIALOG
// ============================================================
function ManualInvoiceDialog({ open, onOpenChange, seasons, userId }: any) {
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

  // Auto-fill rate from season matrix based on selected land's field_type
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
    if (!farmerId || !landId || !seasonId || !rate) return toast.error("সব ফিল্ড পূরণ করুন");
    if (isManualRate && manualReason.trim().length < 3) return toast.error("ম্যানুয়াল রেটের কারণ লিখুন (অন্তত ৩ অক্ষর)");
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
      toast.success(`ইনভয়েস ${invoice_no} তৈরি হয়েছে`);
      onOpenChange(false);
      setFarmerId(null); setLandId(""); setSeasonId(""); setRate(0); setOtherCharge(0); setManualReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>ম্যানুয়াল ইনভয়েস তৈরি</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>কৃষক</Label>
            <FarmerSearchSelect value={farmerId} onChange={(id) => { setFarmerId(id); setLandId(""); }} placeholder="কৃষক খুঁজুন" />
          </div>
          <div>
            <Label>জমি</Label>
            <Select value={landId} onValueChange={setLandId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {lands.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.mouza} • Dag {l.dag_no} ({formatLandSize(l.land_size, "short")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>সিজন</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>মেয়াদ</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>রেট/শতক</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
            <div>
              <Label>অন্যান্য চার্জ</Label>
              <Input type="number" value={otherCharge} onChange={(e) => setOtherCharge(Number(e.target.value))} />
            </div>
          </div>
          {seasonId && landId && (
            isManualRate ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>সিজন রেট কনফিগার নেই</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>এই সিজন ও জমির ধরনের জন্য কোনো সেচ রেট কনফিগার করা নেই। নিচে ম্যানুয়াল রেট ও কারণ দিন, অথবা প্রথমে সিজন রেট কনফিগার করুন।</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/seasons" target="_blank">সিজন রেটে যান</Link>
                  </Button>
                  <div>
                    <Label>ম্যানুয়াল রেটের কারণ *</Label>
                    <Textarea rows={2} value={manualReason} onChange={(e) => setManualReason(e.target.value)}
                      placeholder="যেমন: এক-বার পরীক্ষামূলক ইনভয়েস" />
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                স্বয়ংক্রিয় রেট প্রয়োগ: {rateRow?.land_type_name} → {money(rateRow?.rate_per_shotok ?? 0)}/শতক
              </p>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={save} disabled={busy}>{busy ? "…" : "তৈরি করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SETTINGS TAB
// ============================================================
function SettingsTab({ offices, userId, isSuper }: any) {
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
    if (!officeId) return toast.error("একটি অফিস নির্বাচন করুন");
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
    toast.success("সেটিংস সংরক্ষিত হয়েছে");
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 max-w-xl">
        <div>
          <Label>অফিস</Label>
          <Select value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger><SelectValue placeholder="অফিস নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {officeId && !loading && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>রক্ষণাবেক্ষণ % (সেচ চার্জের উপর)</Label>
                <Input type="number" step="0.01" value={s.maintenance_percent}
                  onChange={(e) => setS({ ...s, maintenance_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>খাল/নালা চার্জ %</Label>
                <Input type="number" step="0.01" value={s.canal_percent}
                  onChange={(e) => setS({ ...s, canal_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>বিলম্ব ফি %</Label>
                <Input type="number" step="0.01" value={s.delay_fee_percent}
                  onChange={(e) => setS({ ...s, delay_fee_percent: Number(e.target.value) })} />
              </div>
              <div>
                <Label>গ্রেস পিরিয়ড (দিন)</Label>
                <Input type="number" value={s.grace_days}
                  onChange={(e) => setS({ ...s, grace_days: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={s.auto_apply_delay_fee}
                onCheckedChange={(v) => setS({ ...s, auto_apply_delay_fee: v })} />
              <Label htmlFor="auto">স্বয়ংক্রিয়ভাবে বিলম্ব ফি প্রযোজ্য করুন</Label>
            </div>
            <Button onClick={save}>সংরক্ষণ করুন</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
