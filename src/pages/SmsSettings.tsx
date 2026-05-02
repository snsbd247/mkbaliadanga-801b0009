import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";

type Settings = {
  enabled: boolean;
  sender_id: string | null;
  language: string;
  reminder_days_before: number;
  send_on_savings_deposit: boolean;
  send_on_savings_withdraw: boolean;
  send_on_loan_approved: boolean;
  send_on_loan_payment: boolean;
  send_on_irrigation_payment: boolean;
  send_on_due_reminder: boolean;
  tpl_savings_deposit: string;
  tpl_savings_withdraw: string;
  tpl_loan_approved: string;
  tpl_loan_payment: string;
  tpl_irrigation_payment: string;
  tpl_due_reminder: string;
  tpl_savings_deposit_en: string;
  tpl_savings_withdraw_en: string;
  tpl_loan_approved_en: string;
  tpl_loan_payment_en: string;
  tpl_irrigation_payment_en: string;
  tpl_due_reminder_en: string;
};

const TEMPLATE_VARS: Record<string, string[]> = {
  tpl_savings_deposit: ["{amount}", "{balance}"],
  tpl_savings_withdraw: ["{amount}", "{balance}"],
  tpl_loan_approved: ["{amount}", "{payable}"],
  tpl_loan_payment: ["{amount}", "{due}"],
  tpl_irrigation_payment: ["{amount}"],
  tpl_due_reminder: ["{type}", "{due}", "{date}"],
};

export default function SmsSettings() {
  const { isSuper } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMobile, setTestMobile] = useState("");
  const [testMsg, setTestMsg] = useState("পরীক্ষামূলক বার্তা — Smart Irrigation");

  useEffect(() => { document.title = "SMS Settings"; load(); }, []);

  async function load() {
    const { data, error } = await supabase.from("sms_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return toast.error(error.message);
    setS(data as any);
  }

  if (!isSuper) return <Navigate to="/" replace />;
  if (!s) return <div className="p-6 text-muted-foreground">Loading…</div>;

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("sms_settings").update({ ...s, updated_at: new Date().toISOString() } as any).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function sendTest() {
    if (!testMobile.trim()) return toast.error("Enter mobile");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { mobile: testMobile.trim(), message: testMsg, event_type: "manual" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok) toast.success("Sent ✓");
    else toast.error("Failed: " + ((data as any)?.response ?? "unknown"));
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s!, [k]: v });

  const tplFields: { key: keyof Settings; label: string }[] = [
    { key: "tpl_savings_deposit", label: "Savings Deposit" },
    { key: "tpl_savings_withdraw", label: "Savings Withdraw" },
    { key: "tpl_loan_approved", label: "Loan Approved" },
    { key: "tpl_loan_payment", label: "Loan Payment" },
    { key: "tpl_irrigation_payment", label: "Irrigation Payment" },
    { key: "tpl_due_reminder", label: "Due Reminder" },
  ];

  return (
    <>
      <PageHeader title="SMS Settings" description="Configure GreenWeb Bulk SMS notifications" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4"/>Provider</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Enable SMS</Label>
                <p className="text-xs text-muted-foreground">Master switch for all SMS notifications.</p>
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
            <div>
              <Label>Sender ID (optional)</Label>
              <Input value={s.sender_id ?? ""} onChange={(e) => set("sender_id", e.target.value)} placeholder="e.g. SmartIrri" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Default Language</Label>
                <Select value={s.language} onValueChange={(v) => set("language", v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bangla (বাংলা)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Used for due reminders.</p>
              </div>
              <div>
                <Label>Reminder days before due</Label>
                <Input type="number" min={0} max={30} value={s.reminder_days_before}
                  onChange={(e) => set("reminder_days_before", Math.max(0, Number(e.target.value || 0)))} />
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              API token is stored securely as <code>GREENWEB_SMS_TOKEN</code> in backend secrets and never exposed in the frontend.
              Reminders run daily and are sent only once per due event.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Trigger Events</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {([
              ["send_on_savings_deposit", "Savings deposit"],
              ["send_on_savings_withdraw", "Savings withdraw"],
              ["send_on_loan_approved", "Loan approved"],
              ["send_on_loan_payment", "Loan payment received"],
              ["send_on_irrigation_payment", "Irrigation payment"],
              ["send_on_due_reminder", "Due reminders"],
            ] as [keyof Settings, string][]).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{label}</span>
                <Switch checked={!!s[k]} onCheckedChange={(v) => set(k, v as any)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Message Templates (Bangla)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {tplFields.map((f) => (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">{f.label}</Label>
                  <span className="text-[10px] text-muted-foreground">vars: {TEMPLATE_VARS[f.key]?.join(", ")}</span>
                </div>
                <Textarea
                  value={(s as any)[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value as any)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4"/>Send Test SMS</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <Label>Mobile</Label>
              <Input value={testMobile} onChange={(e) => setTestMobile(e.target.value)} placeholder="017XXXXXXXX" />
            </div>
            <div className="sm:col-span-2">
              <Label>Message</Label>
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
            </div>
            <Button onClick={sendTest} disabled={busy} className="sm:col-span-3 sm:w-auto">Send Test</Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </>
  );
}
