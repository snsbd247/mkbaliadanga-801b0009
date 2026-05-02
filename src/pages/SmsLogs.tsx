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
import { RefreshCw, Send, Megaphone, Bell, Eye, Loader2 } from "lucide-react";

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
    toast.success("Retried");
    load();
  }

  async function retryAllFailed() {
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-sms", { body: { retry: true } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Retry batch sent");
    load();
  }

  async function runDueReminders() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("sms-due-reminders", { body: { source: "manual" } });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(`Reminders queued — loan: ${r?.loan ?? 0}, irrigation: ${r?.irrigation ?? 0}, dedup-skipped: ${r?.skipped_dup ?? 0}`);
    load();
  }

  async function openDetails(l: Log) {
    let kind: "loan" | "irrigation" | null = null;
    if (l.reference_type === "loan" || l.event_type === "due_reminder_loan") kind = "loan";
    else if (l.reference_type === "irrigation" || l.event_type === "due_reminder_irrigation") kind = "irrigation";

    setDrawer({ log: l, loading: true, kind, record: null, paid: 0, due: 0 });

    if (!kind || !l.reference_id) {
      setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: "No underlying reference recorded for this SMS." });
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
          setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: loanRes.error?.message ?? "Loan not found (may be deleted)." });
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
          setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: irrRes.error?.message ?? "Irrigation charge not found (may be deleted)." });
          return;
        }
        const paid = Number(irrRes.data.paid_amount || 0);
        const due = Number(irrRes.data.due_amount || 0);
        setDrawer({ log: l, loading: false, kind, record: irrRes.data, paid, due, farmer: (farmerRes as any).data });
      }
    } catch (e: any) {
      setDrawer({ log: l, loading: false, kind, record: null, paid: 0, due: 0, error: e?.message ?? "Failed to load details" });
    }
  }

  async function sendBulk() {
    const mobiles = bulkMobiles.split(/[\s,;\n]+/).map((m) => m.trim()).filter(Boolean);
    if (!mobiles.length) return toast.error("Enter at least one mobile");
    if (!bulkMessage.trim()) return toast.error("Enter a message");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-sms", { body: { mobiles, message: bulkMessage } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Queued ${(data as any)?.queued ?? mobiles.length} messages`);
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
        title="SMS Logs"
        description="Delivery history, due reminders, and bulk announcements"
        actions={
          <div className="btn-group-responsive">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4"/>Refresh</Button>
            <Button variant="outline" size="sm" onClick={runDueReminders} disabled={busy}><Bell className="mr-1 h-4 w-4"/>Run Reminders</Button>
            <Button size="sm" onClick={retryAllFailed} disabled={busy}><Send className="mr-1 h-4 w-4"/>Retry failed</Button>
          </div>
        }
      />

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
          <TabsTrigger value="bulk"><Megaphone className="mr-1 h-3.5 w-3.5"/>Bulk Send</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4 space-y-3">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {["all","sent","failed","queued"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Event</Label>
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Office</Label>
                  <Select value={officeFilter} onValueChange={setOfficeFilter}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All offices</SelectItem>
                      {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Mobile / Farmer</Label>
                  <Input placeholder="search…" value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No SMS logs</TableCell></TableRow>
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
                              <Button size="sm" variant="ghost" onClick={() => openDetails(l)} title="View underlying record">
                                <Eye className="h-4 w-4"/>
                              </Button>
                            )}
                            {l.status !== "sent" && (
                              <Button size="sm" variant="ghost" onClick={() => retryOne(l.id)} disabled={busy}>Retry</Button>
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
            <CardHeader><CardTitle className="text-base">Bulk Announcement</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Mobile numbers</Label>
                <Textarea
                  rows={4}
                  placeholder="017XXXXXXXX, 018XXXXXXXX  (or one per line)"
                  value={bulkMobiles}
                  onChange={(e) => setBulkMobiles(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Comma, space, or newline separated.</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Message</Label>
                <Textarea rows={4} value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} placeholder="Announcement text…" />
              </div>
              <Button onClick={sendBulk} disabled={busy} className="w-full sm:w-auto">
                <Send className="mr-1 h-4 w-4"/>Send Bulk
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
