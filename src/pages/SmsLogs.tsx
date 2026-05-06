import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { RefreshCw, Send, Megaphone, Bell, Eye, Loader2, FileDown, FileSpreadsheet } from "lucide-react";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";

type Log = {
  id: string;
  mobile: string;
  message: string;
  status: string;
  event_type: string | null;
  provider_response: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
  farmer_id: string | null;
  office_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  farmer_name?: string | null;
  office_name?: string | null;
};
type DrawerData = {
  log: Log;
  loading: boolean;
  kind: "loan" | "irrigation" | null;
  record: any | null;
  paid: number;
  due: number;
  payments?: any[];
  farmer?: any | null;
  error?: string | null;
};
type Office = { id: string; name: string };

const EVENT_TYPES = [
  "all",
  "savings_deposit",
  "savings_withdraw",
  "loan_approved",
  "loan_payment",
  "irrigation_payment",
  "due_reminder_loan",
  "due_reminder_irrigation",
  "bulk",
  "manual",
];

export default function SmsLogs() {
  const { t } = useLang();
  const { isAdmin, isSuper } = useAuth();
  const allowed = isAdmin || isSuper;
  const [logs, setLogs] = useState<Log[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<DrawerData | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [farmerSearch, setFarmerSearch] = useState<string>(""); // mobile or farmer code text match
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Bulk
  const [bulkMobiles, setBulkMobiles] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  useEffect(() => {
    document.title = "SMS Logs";
    if (!allowed) return;
    supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices((data as any) ?? []));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, statusFilter, eventFilter, officeFilter, fromDate, toDate]);

  async function load() {
    setLoading(true);
    let q = supabase.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
    if (officeFilter !== "all") q = q.eq("office_id", officeFilter);
    if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const end = new Date(toDate); end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    const rows = (data as any[]) ?? [];

    // Enrich with farmer + office names (sms_logs has no FK so we batch-fetch)
    const farmerIds = Array.from(new Set(rows.map((r) => r.farmer_id).filter(Boolean)));
    const officeIds = Array.from(new Set(rows.map((r) => r.office_id).filter(Boolean)));
    const [farmersRes, officesRes] = await Promise.all([
      farmerIds.length
        ? supabase.from("farmers").select("id,name_en,name_bn,farmer_code").in("id", farmerIds)
        : Promise.resolve({ data: [] as any[] }),
      officeIds.length
        ? supabase.from("offices").select("id,name").in("id", officeIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const fmap = new Map<string, any>(((farmersRes as any).data ?? []).map((f: any) => [f.id, f]));
    const omap = new Map<string, string>(((officesRes as any).data ?? []).map((o: any) => [o.id, o.name]));
    setLogs(rows.map((r) => {
      const f = r.farmer_id ? fmap.get(r.farmer_id) : null;
      return {
        ...r,
        farmer_name: f ? (f.name_en || f.name_bn || f.farmer_code) : null,
        office_name: r.office_id ? omap.get(r.office_id) ?? null : null,
      };
    }));
  }

  const filtered = useMemo(() => {
    if (!farmerSearch.trim()) return logs;
    const q = farmerSearch.trim().toLowerCase();
    return logs.filter((l) =>
      l.mobile?.toLowerCase().includes(q) ||
      (l.farmer_name ?? "").toLowerCase().includes(q) ||
      (l.office_name ?? "").toLowerCase().includes(q) ||
      (l.farmer_id ?? "").toLowerCase().includes(q)
    );
  }, [logs, farmerSearch]);

  if (!allowed) return <Navigate to="/" replace />;

  async function retryOne(id: string) {
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-sms", { body: { retry: true, ids: [id] } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("retried"));
    load();
  }

  async function retryAllFailed() {
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-sms", { body: { retry: true } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("retryBatchSent"));
    load();
  }

  async function runDueReminders() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("sms-due-reminders", { body: { source: "manual" } });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(t("remindersQueued").replace("{l}", String(r?.loan ?? 0)).replace("{i}", String(r?.irrigation ?? 0)).replace("{s}", String(r?.skipped_dup ?? 0)));
    load();
  }

  async function openDetails(l: Log) {
    let kind: "loan" | "irrigation" | null = null;
    if (l.reference_type === "loan" || l.event_type === "due_reminder_loan") kind = "loan";
    else if (l.reference_type === "irrigation" || l.event_type === "due_reminder_irrigation") kind = "irrigation";

    setDrawer({ log: l, loading: true, kind, record: null, paid: 0, due: 0 });

    if (!kind || !l.reference_id) {
      setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: t("noUnderlyingRef") });
      return;
    }

    try {
      const farmerPromise = l.farmer_id
        ? supabase.from("farmers").select("id,name_en,name_bn,farmer_code,mobile,village").eq("id", l.farmer_id).maybeSingle()
        : Promise.resolve({ data: null } as any);

      if (kind === "loan") {
        const [loanRes, paySumRes, farmerRes] = await Promise.all([
          supabase.from("loans").select("*").eq("id", l.reference_id).maybeSingle(),
          supabase.from("loan_payments").select("amount,paid_on,status").eq("loan_id", l.reference_id).eq("status", "approved"),
          farmerPromise,
        ]);
        if (loanRes.error || !loanRes.data) {
          setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: loanRes.error?.message ?? t("loanNotFound") });
          return;
        }
        const paid = (paySumRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const due = Math.max(0, Number(loanRes.data.total_payable || 0) - paid);
        setDrawer({ log: l, loading: false, kind, record: loanRes.data, paid, due, payments: paySumRes.data ?? [], farmer: (farmerRes as any).data });
      } else {
        const [irrRes, farmerRes] = await Promise.all([
          supabase.from("irrigation_charges").select("*").eq("id", l.reference_id).maybeSingle(),
          farmerPromise,
        ]);
        if (irrRes.error || !irrRes.data) {
          setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: irrRes.error?.message ?? t("irrChargeNotFound") });
          return;
        }
        const paid = Number(irrRes.data.paid_amount || 0);
        const due = Number(irrRes.data.due_amount || 0);
        setDrawer({ log: l, loading: false, kind, record: irrRes.data, paid, due, farmer: (farmerRes as any).data });
      }
    } catch (e: any) {
      setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: e?.message ?? t("failedLoadDetails") });
    }
  }

  async function sendBulk() {
    const mobiles = bulkMobiles.split(/[\s,;\n]+/).map((m) => m.trim()).filter(Boolean);
    if (!mobiles.length) return toast.error(t("enterAtLeastOneMobile"));
    if (!bulkMessage.trim()) return toast.error(t("enterMessage"));
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-sms", { body: { mobiles, message: bulkMessage } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("queuedMsgs").replace("{n}", String((data as any)?.queued ?? mobiles.length)));
    setBulkMobiles(""); setBulkMessage("");
    load();
  }

  const statusBadge = (s: string) => {
    if (s === "sent") return <Badge className="bg-success text-success-foreground">sent</Badge>;
    if (s === "failed") return <Badge variant="destructive">failed</Badge>;
    return <Badge variant="secondary">queued</Badge>;
  };

  function clearFilters() {
    setStatusFilter("all"); setEventFilter("all"); setOfficeFilter("all");
    setFarmerSearch(""); setFromDate(""); setToDate("");
  }

  return (
    <>
      <PageHeader
        title={t("smsLogs")}
        description={t("smsLogsDesc")}
        actions={
          <div className="btn-group-responsive">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4"/>{t("refresh")}</Button>
            <Button variant="outline" size="sm" onClick={runDueReminders} disabled={busy}><Bell className="mr-1 h-4 w-4"/>{t("runReminders")}</Button>
            <Button size="sm" onClick={retryAllFailed} disabled={busy}><Send className="mr-1 h-4 w-4"/>{t("retryFailed")}</Button>
          </div>
        }
      />

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">{t("deliveryLogs")}</TabsTrigger>
          <TabsTrigger value="bulk"><Megaphone className="mr-1 h-3.5 w-3.5"/>{t("bulkSend")}</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4 space-y-3">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <Label className="text-xs">{t("status")}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {["all","sent","failed","queued"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("event")}</Label>
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("office")}</Label>
                  <Select value={officeFilter} onValueChange={setOfficeFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allOffices")}</SelectItem>
                      {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("from")}</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t("to")}</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t("mobileFarmer")}</Label>
                  <Input placeholder={t("searchPlaceholder")} value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!filtered.length}
                    onClick={() =>
                      exportTablePDF(
                        "SMS Logs",
                        ["Time", "Farmer", "Mobile", "Office", "Event", "Message", "Status", "Retries"],
                        filtered.map((l) => [
                          new Date(l.created_at).toLocaleString(),
                          l.farmer_name ?? "—",
                          l.mobile,
                          l.office_name ?? "—",
                          l.event_type ?? "-",
                          l.message,
                          l.status,
                          l.retry_count,
                        ]),
                        { from: fromDate || undefined, to: toDate || undefined },
                      )
                    }
                  >
                    <FileDown className="mr-1 h-4 w-4" />PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!filtered.length}
                    onClick={() =>
                      exportExcel(
                        "sms-logs",
                        "SMS Logs",
                        filtered.map((l) => ({
                          Time: new Date(l.created_at).toLocaleString(),
                          Farmer: l.farmer_name ?? "",
                          Mobile: l.mobile,
                          Office: l.office_name ?? "",
                          Event: l.event_type ?? "",
                          Message: l.message,
                          Status: l.status,
                          Retries: l.retry_count,
                          "Sent At": l.sent_at ? new Date(l.sent_at).toLocaleString() : "",
                          "Provider Response": l.provider_response ?? "",
                        })),
                        { from: fromDate || undefined, to: toDate || undefined },
                      )
                    }
                  >
                    <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>{t("clearFilters")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("time")}</TableHead>
                      <TableHead>{t("farmer")}</TableHead>
                      <TableHead>{t("mobile")}</TableHead>
                      <TableHead>{t("office")}</TableHead>
                      <TableHead>{t("event")}</TableHead>
                      <TableHead>{t("message")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("retries")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{t("loading")}</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{t("noSmsLogs")}</TableCell></TableRow>
                    ) : filtered.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="max-w-[160px] truncate" title={l.farmer_name ?? ""}>{l.farmer_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="font-mono text-xs">{l.mobile}</TableCell>
                        <TableCell className="max-w-[140px] truncate" title={l.office_name ?? ""}>{l.office_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{l.event_type ?? "-"}</Badge></TableCell>
                        <TableCell className="max-w-[280px] truncate" title={l.message}>{l.message}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell>{l.retry_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(l.event_type === "due_reminder_loan" || l.event_type === "due_reminder_irrigation") && (
                              <Button size="sm" variant="ghost" onClick={() => openDetails(l)} title={t("viewReceipt")}>
                                <Eye className="h-4 w-4"/>
                              </Button>
                            )}
                            {l.status !== "sent" && (
                              <Button size="sm" variant="ghost" onClick={() => retryOne(l.id)} disabled={busy}>{t("retryBtn")}</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("bulkAnnouncement")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">{t("mobileNumbers")}</Label>
                <Textarea
                  rows={4}
                  placeholder={t("mobilesPh")}
                  value={bulkMobiles}
                  onChange={(e) => setBulkMobiles(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">{t("mobilesSeparated")}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">{t("message")}</Label>
                <Textarea rows={4} value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} placeholder={t("announcementPh")} />
              </div>
              <Button onClick={sendBulk} disabled={busy} className="w-full sm:w-auto">
                <Send className="mr-1 h-4 w-4"/>{t("sendBulkBtn")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!drawer} onOpenChange={(o) => { if (!o) setDrawer(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("reminderDetails")}</SheetTitle>
            <SheetDescription>
              {drawer?.kind === "loan" ? t("underlyingLoan") : drawer?.kind === "irrigation" ? t("underlyingIrrigation") : t("smsLogDetails")}
            </SheetDescription>
          </SheetHeader>

          {drawer && (
            <div className="mt-4 space-y-4 text-sm">
              {/* SMS info */}
              <div className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">SMS</span>
                  {statusBadge(drawer.log.status)}
                </div>
                <div><span className="text-muted-foreground">{t("sentTo")}</span> <span className="font-mono">{drawer.log.mobile}</span></div>
                <div><span className="text-muted-foreground">{t("time")}:</span> {new Date(drawer.log.created_at).toLocaleString()}</div>
                <div><span className="text-muted-foreground">{t("event")}:</span> <Badge variant="outline" className="text-[10px]">{drawer.log.event_type ?? "-"}</Badge></div>
                <div className="text-xs bg-muted/40 rounded p-2 mt-2 whitespace-pre-wrap break-words">{drawer.log.message}</div>
                {drawer.log.provider_response && (
                  <div className="text-xs text-muted-foreground"><span className="font-medium">{t("providerLabel")}</span> {drawer.log.provider_response}</div>
                )}
              </div>

              {drawer.loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2"/>{t("loadingRecord")}
                </div>
              ) : drawer.error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-xs">
                  {drawer.error}
                </div>
              ) : drawer.record && (
                <>
                  {/* Farmer */}
                  {drawer.farmer && (
                    <div className="rounded-md border p-3 space-y-1">
                      <div className="text-xs text-muted-foreground">{t("farmer")}</div>
                      <div className="font-medium">{drawer.farmer.name_en || drawer.farmer.name_bn}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("farmerCode")}: <span className="font-mono">{drawer.farmer.farmer_code}</span>
                        {drawer.farmer.village ? <> · {drawer.farmer.village}</> : null}
                      </div>
                      {drawer.farmer.mobile && <div className="text-xs font-mono">{drawer.farmer.mobile}</div>}
                    </div>
                  )}

                  {/* Computed due summary */}
                  <div className="rounded-md border p-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">{t("total")}</div>
                      <div className="font-semibold">
                        {drawer.kind === "loan"
                          ? Number(drawer.record.total_payable || 0).toLocaleString()
                          : Number(drawer.record.total || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">{t("paidLabel")}</div>
                      <div className="font-semibold text-success">{drawer.paid.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">{t("dueLabel")}</div>
                      <div className="font-semibold text-destructive">{drawer.due.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Record specifics */}
                  {drawer.kind === "loan" ? (
                    <div className="rounded-md border p-3 space-y-1.5">
                      <div className="text-xs text-muted-foreground mb-1">{t("loanRecordLabel")}</div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs">
                        <div className="text-muted-foreground">{t("principal")}</div><div>{Number(drawer.record.principal || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("interestRate")}</div><div>{drawer.record.interest_rate}% {drawer.record.interest_enabled ? "" : "(off)"}</div>
                        <div className="text-muted-foreground">{t("totalPayable")}</div><div>{Number(drawer.record.total_payable || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("issuedOn")}</div><div>{drawer.record.issued_on}</div>
                        <div className="text-muted-foreground">{t("nextDueOn")}</div><div className="font-medium">{drawer.record.next_due_on ?? "—"}</div>
                        <div className="text-muted-foreground">{t("status")}</div><div><Badge variant="outline" className="text-[10px]">{drawer.record.status}</Badge></div>
                      </div>
                      {drawer.payments && drawer.payments.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground mb-1">{t("approvedPayments")} ({drawer.payments.length})</div>
                          <div className="max-h-32 overflow-y-auto text-xs space-y-0.5">
                            {drawer.payments.map((p, i) => (
                              <div key={i} className="flex justify-between border-b last:border-0 py-0.5">
                                <span>{p.paid_on}</span>
                                <span className="font-mono">{Number(p.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border p-3 space-y-1.5">
                      <div className="text-xs text-muted-foreground mb-1">{t("irrigationChargeLabel")}</div>
                      <div className="grid grid-cols-2 gap-y-1 text-xs">
                        <div className="text-muted-foreground">{t("entryDate")}</div><div>{drawer.record.entry_date}</div>
                        <div className="text-muted-foreground">{t("basis")}</div><div>{drawer.record.basis}</div>
                        <div className="text-muted-foreground">{t("quantity")}</div><div>{drawer.record.quantity}</div>
                        <div className="text-muted-foreground">{t("baseCharge")}</div><div>{Number(drawer.record.base_charge || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("canalChargeLabel")}</div><div>{Number(drawer.record.canal_charge || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("maintenanceCharge")}</div><div>{Number(drawer.record.maintenance_charge || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("other")}</div><div>{Number(drawer.record.other_charge || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("penalty")}</div><div>{Number(drawer.record.penalty_amount || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("previousDue")}</div><div>{Number(drawer.record.previous_due_brought || 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">{t("total")}</div><div className="font-medium">{Number(drawer.record.total || 0).toLocaleString()}</div>
                      </div>
                      {drawer.record.note && <div className="text-xs text-muted-foreground italic">"{drawer.record.note}"</div>}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground font-mono break-all">
                    Ref: {drawer.kind}/{drawer.record.id}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
