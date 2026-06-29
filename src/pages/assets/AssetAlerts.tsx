import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, RefreshCw, BellRing, Check, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Alert = {
  id: string; office_id: string | null; asset_id: string;
  alert_type: "low_stock" | "warranty_expiring" | "warranty_expired";
  severity: "info" | "warning" | "critical";
  message_en: string; message_bn: string | null;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  sms_sent_count: number; last_sms_at: string | null;
  created_at: string;
  assets?: { asset_code: string; name_en: string; name_bn: string | null } | null;
};

export default function AssetAlerts() {
  const { tx, lang } = useLang();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recipientsText, setRecipientsText] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    document.title = tx("Asset Alerts", "এসেট সতর্কতা");
    load();
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  async function load() {
    setLoading(true);
    let q = db
      .from("asset_alerts" as any)
      .select("*,assets(asset_code,name_en,name_bn)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (typeFilter !== "all") q = q.eq("alert_type", typeFilter);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  }

  async function loadRecipients() {
    const { data } = await db.from("sms_settings").select("config").eq("id", 1).maybeSingle();
    const arr = ((data?.config as any)?.asset_alert_recipients ?? []) as string[];
    setRecipientsText(arr.join(", "));
  }

  async function runScan() {
    setRunning(true);
    try {
      const { data, error } = await db.functions.invoke("asset-alerts-scan", { body: {} });
      if (error) throw error;
      toast.success(
        tx(`Scan done — ${data?.created ?? 0} new, ${data?.smsSent ?? 0} SMS sent`,
          `স্ক্যান শেষ — নতুন ${data?.created ?? 0}, SMS ${data?.smsSent ?? 0}`)
      );
      load();
    } catch (e: any) { toast.error(e.message); } finally { setRunning(false); }
  }

  async function updateStatus(id: string, status: Alert["status"]) {
    const patch: any = { status };
    if (status === "acknowledged") { patch.acknowledged_at = new Date().toISOString(); }
    if (status === "resolved") { patch.resolved_at = new Date().toISOString(); }
    const { error } = await db.from("asset_alerts" as any).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(tx("Updated", "আপডেট হয়েছে"));
    load();
  }

  async function saveRecipients() {
    setSavingSettings(true);
    try {
      const list = recipientsText.split(/[,\s\n]+/).map((s) => s.trim()).filter(Boolean);
      const { data: cur } = await db.from("sms_settings").select("config").eq("id", 1).maybeSingle();
      const config = { ...((cur?.config as any) ?? {}), asset_alert_recipients: list };
      const { error } = await db.from("sms_settings").update({ config }).eq("id", 1);
      if (error) throw error;
      toast.success(tx("Saved", "সংরক্ষিত"));
      setSettingsOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setSavingSettings(false); }
  }

  const counts = useMemo(() => {
    const m = { open: 0, critical: 0, low_stock: 0, warranty: 0 };
    rows.forEach((r) => {
      if (r.status === "open") m.open++;
      if (r.severity === "critical") m.critical++;
      if (r.alert_type === "low_stock") m.low_stock++;
      if (r.alert_type.startsWith("warranty")) m.warranty++;
    });
    return m;
  }, [rows]);

  const typeLabel = (t: string) =>
    t === "low_stock" ? tx("Low stock", "স্টক কম")
    : t === "warranty_expiring" ? tx("Warranty expiring", "ওয়ারেন্টি শেষের পথে")
    : t === "warranty_expired" ? tx("Warranty expired", "ওয়ারেন্টি শেষ")
    : t === "maintenance_due" ? tx("Maintenance due", "মেরামত বকেয়া") : t;

  const sevColor = (s: string) =>
    s === "critical" ? "destructive" : s === "warning" ? "default" : "secondary";

  return (
    <>
      <PageHeader
        title={tx("Asset Alerts", "এসেট সতর্কতা")}
        description={tx(
          "Low-stock and warranty expiry alerts. Run scan manually or via daily cron.",
          "স্টক কম ও ওয়ারেন্টি শেষের সতর্কতা। ম্যানুয়ালি বা দৈনিক cron-এ স্ক্যান চালান।",
        )}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" />{tx("SMS recipients", "SMS গ্রাহক")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{tx("Alert SMS recipients", "সতর্কতা SMS গ্রাহক")}</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Label>{tx("Mobile numbers (comma or newline separated)", "মোবাইল নম্বর (কমা বা newline দিয়ে আলাদা)")}</Label>
                    <Textarea rows={5} value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} placeholder="017xxxxxxxx, 018xxxxxxxx" />
                    <p className="text-xs text-muted-foreground">
                      {tx("These numbers receive low-stock and warranty alerts in Bangla.",
                          "এই নম্বরগুলো স্টক কম ও ওয়ারেন্টি সতর্কতা বাংলায় পাবে।")}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={savingSettings}>{tx("Cancel", "বাতিল")}</Button>
                    <Button onClick={saveRecipients} disabled={savingSettings}>{savingSettings ? "…" : tx("Save", "সংরক্ষণ")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button size="sm" onClick={runScan} disabled={running}>
              <RefreshCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} />
              {tx("Run scan", "স্ক্যান চালান")}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {[
          { label: tx("Open", "চলমান"), value: counts.open, tone: "default" },
          { label: tx("Critical", "জরুরি"), value: counts.critical, tone: "destructive" },
          { label: tx("Low stock", "স্টক কম"), value: counts.low_stock, tone: "default" },
          { label: tx("Warranty", "ওয়ারেন্টি"), value: counts.warranty, tone: "default" },
        ].map((c) => (
          <Card key={c.label} className="p-3">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-xl font-semibold ${c.tone === "destructive" ? "text-destructive" : ""}`}>{c.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{tx("Status", "স্ট্যাটাস")}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="open">{tx("Open", "চলমান")}</SelectItem>
                <SelectItem value="acknowledged">{tx("Acknowledged", "স্বীকৃত")}</SelectItem>
                <SelectItem value="resolved">{tx("Resolved", "সমাধান")}</SelectItem>
                <SelectItem value="dismissed">{tx("Dismissed", "বাতিল")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tx("Type", "টাইপ")}</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="low_stock">{typeLabel("low_stock")}</SelectItem>
                <SelectItem value="warranty_expiring">{typeLabel("warranty_expiring")}</SelectItem>
                <SelectItem value="warranty_expired">{typeLabel("warranty_expired")}</SelectItem>
                <SelectItem value="maintenance_due">{typeLabel("maintenance_due")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Asset", "এসেট")}</TableHead>
              <TableHead>{tx("Type", "টাইপ")}</TableHead>
              <TableHead>{tx("Severity", "মাত্রা")}</TableHead>
              <TableHead>{tx("Message", "বার্তা")}</TableHead>
              <TableHead>{tx("SMS", "SMS")}</TableHead>
              <TableHead>{tx("Created", "তৈরি")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-mono text-xs">{r.assets?.asset_code ?? "—"}</div>
                  <div className="text-sm">{r.assets?.name_bn || r.assets?.name_en || "—"}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{typeLabel(r.alert_type)}</Badge></TableCell>
                <TableCell><Badge variant={sevColor(r.severity) as any}>{r.severity}</Badge></TableCell>
                <TableCell className="text-sm max-w-md">{lang === "bn" ? (r.message_bn || r.message_en) : r.message_en}</TableCell>
                <TableCell className="text-xs">{r.sms_sent_count > 0 ? `${r.sms_sent_count} ✓` : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && r.status === "open" && (
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" title={tx("Acknowledge", "স্বীকার")} onClick={() => updateStatus(r.id, "acknowledged")}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title={tx("Resolve", "সমাধান")} onClick={() => updateStatus(r.id, "resolved")}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" title={tx("Dismiss", "বাতিল")} onClick={() => updateStatus(r.id, "dismissed")}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && !rows.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No alerts", "কোনো সতর্কতা নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
