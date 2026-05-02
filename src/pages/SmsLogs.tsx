import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Send, Megaphone } from "lucide-react";

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
};

export default function SmsLogs() {
  const { isAdmin, isSuper } = useAuth();
  const allowed = isAdmin || isSuper;
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bulkMobiles, setBulkMobiles] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "SMS Logs"; if (allowed) load(); }, [allowed, statusFilter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setLogs((data as any) ?? []);
  }

  if (!allowed) return <Navigate to="/" replace />;

  async function retryOne(id: string) {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-sms", { body: { retry: true, ids: [id] } });
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

  return (
    <>
      <PageHeader
        title="SMS Logs"
        description="Delivery history and bulk announcements"
        actions={
          <div className="btn-group-responsive">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4"/>Refresh</Button>
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
          <div className="flex flex-wrap gap-2">
            {["all", "sent", "failed", "queued"].map((s) => (
              <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
                {s}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No SMS logs</TableCell></TableRow>
                    ) : logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{l.mobile}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{l.event_type ?? "-"}</Badge></TableCell>
                        <TableCell className="max-w-[280px] truncate" title={l.message}>{l.message}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell>{l.retry_count}</TableCell>
                        <TableCell>
                          {l.status !== "sent" && (
                            <Button size="sm" variant="ghost" onClick={() => retryOne(l.id)} disabled={busy}>Retry</Button>
                          )}
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
                <label className="text-sm font-medium">Mobile numbers</label>
                <Textarea
                  rows={4}
                  placeholder="017XXXXXXXX, 018XXXXXXXX  (or one per line)"
                  value={bulkMobiles}
                  onChange={(e) => setBulkMobiles(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Comma, space, or newline separated.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
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
