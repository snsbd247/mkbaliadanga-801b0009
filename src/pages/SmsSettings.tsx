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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, Eye, CalendarClock, AlertTriangle, RotateCcw } from "lucide-react";

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

const DEFAULT_SAMPLE_VARS: Record<string, string> = {
  amount: "1,500.00",
  balance: "12,750.00",
  payable: "22,000.00",
  due: "8,000.00",
  type: "Loan / ঋণ",
  date: new Date().toISOString().slice(0, 10),
};

const TPL_VAR_MAP: Record<string, string[]> = {
  tpl_savings_deposit:    ["amount", "balance"],
  tpl_savings_withdraw:   ["amount", "balance"],
  tpl_loan_approved:      ["amount", "payable"],
  tpl_loan_payment:       ["amount", "due"],
  tpl_irrigation_payment: ["amount"],
  tpl_due_reminder:       ["type", "due", "date"],
};

function renderTpl(tpl: string, vars: Record<string, string>): string {
  let out = tpl ?? "";
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  // Bangla
  tpl_savings_deposit:    "প্রিয় গ্রাহক, আপনার সঞ্চয়ে ৳{amount} জমা হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}। ধন্যবাদ।",
  tpl_savings_withdraw:   "প্রিয় গ্রাহক, আপনার সঞ্চয় থেকে ৳{amount} উত্তোলন হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}।",
  tpl_loan_approved:      "অভিনন্দন! আপনার ঋণ ৳{amount} অনুমোদিত হয়েছে। মোট পরিশোধযোগ্য: ৳{payable}।",
  tpl_loan_payment:       "আপনার ঋণ পরিশোধ ৳{amount} গৃহীত হয়েছে। অবশিষ্ট বকেয়া: ৳{due}। ধন্যবাদ।",
  tpl_irrigation_payment: "আপনার সেচ ফি ৳{amount} গৃহীত হয়েছে। ধন্যবাদ।",
  tpl_due_reminder:       "স্মরণিকা: আপনার {type} বকেয়া ৳{due} পরিশোধের তারিখ {date}। অনুগ্রহ করে যথাসময়ে পরিশোধ করুন।",
  // English
  tpl_savings_deposit_en:    "Dear member, BDT {amount} has been deposited to your savings. Current balance: BDT {balance}. Thank you.",
  tpl_savings_withdraw_en:   "Dear member, BDT {amount} has been withdrawn from your savings. Current balance: BDT {balance}.",
  tpl_loan_approved_en:      "Congratulations! Your loan of BDT {amount} has been approved. Total payable: BDT {payable}.",
  tpl_loan_payment_en:       "Your loan payment of BDT {amount} has been received. Remaining due: BDT {due}. Thank you.",
  tpl_irrigation_payment_en: "Your irrigation fee of BDT {amount} has been received. Thank you.",
  tpl_due_reminder_en:       "Reminder: Your {type} due of BDT {due} is payable on {date}. Please pay on time.",
};

function findMissingPlaceholders(tpl: string, required: string[]): string[] {
  const t = tpl ?? "";
  return required.filter((v) => !t.includes(v));
}

type Office = { id: string; name: string };
type OfficeOverride = { office_id: string; enabled: boolean; sender_id: string | null };

export default function SmsSettings() {
  const { isSuper } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMobile, setTestMobile] = useState("");
  const [testMsg, setTestMsg] = useState("পরীক্ষামূলক বার্তা — Smart Irrigation");
  const [tplTestMobile, setTplTestMobile] = useState("");
  const [tplTestBusy, setTplTestBusy] = useState<string | null>(null);
  const [sampleVars, setSampleVars] = useState<Record<string, string>>(DEFAULT_SAMPLE_VARS);
  const [offices, setOffices] = useState<Office[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OfficeOverride>>({});
  // Manual scheduler state
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [schedFrom, setSchedFrom] = useState<string>(today);
  const [schedTo, setSchedTo] = useState<string>(in7);
  const [schedOffice, setSchedOffice] = useState<string>("__all__");
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedResult, setSchedResult] = useState<any>(null);

  useEffect(() => { document.title = "SMS Settings"; load(); }, []);

  async function load() {
    const [settingsRes, officesRes, overridesRes] = await Promise.all([
      supabase.from("sms_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("offices").select("id,name").order("name"),
      supabase.from("sms_office_settings").select("office_id,enabled,sender_id"),
    ]);
    if (settingsRes.error) return toast.error(settingsRes.error.message);
    setS(settingsRes.data as any);
    setOffices(((officesRes.data as any) ?? []) as Office[]);
    const map: Record<string, OfficeOverride> = {};
    for (const o of ((overridesRes.data as any) ?? []) as OfficeOverride[]) map[o.office_id] = o;
    setOverrides(map);
  }

  async function saveOfficeOverride(officeId: string, patch: Partial<OfficeOverride>) {
    const current = overrides[officeId] ?? { office_id: officeId, enabled: true, sender_id: null };
    const next: OfficeOverride = { ...current, ...patch, office_id: officeId };
    setOverrides({ ...overrides, [officeId]: next });
    const { error } = await supabase
      .from("sms_office_settings")
      .upsert(
        { office_id: officeId, enabled: next.enabled, sender_id: next.sender_id, updated_at: new Date().toISOString() } as any,
        { onConflict: "office_id" },
      );
    if (error) toast.error(error.message);
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

  async function sendTemplateTest(key: keyof Settings, baseKey: string) {
    if (!tplTestMobile.trim()) return toast.error("Enter a phone number above to test");
    const tpl = ((s as any)[key] ?? "") as string;
    if (!tpl.trim()) return toast.error("Template is empty");
    const usedVars = TPL_VAR_MAP[baseKey] ?? [];
    const subset: Record<string, string> = {};
    for (const k of usedVars) subset[k] = sampleVars[k] ?? "";
    const rendered = renderTpl(tpl, subset);
    setTplTestBusy(String(key));
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { mobile: tplTestMobile.trim(), message: rendered, event_type: "manual_template_test" },
    });
    setTplTestBusy(null);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok) toast.success("Test SMS sent ✓");
    else toast.error("Failed: " + ((data as any)?.response ?? "unknown"));
  }

  function resetTemplate(key: keyof Settings) {
    const def = DEFAULT_TEMPLATES[String(key)];
    if (def === undefined) return;
    set(key, def as any);
    toast.success("Reset to default — remember to Save");
  }

  async function runManualReminders() {
    if (!schedFrom || !schedTo) return toast.error("Pick both dates");
    if (schedFrom > schedTo) return toast.error("From date must be before To date");
    setSchedBusy(true);
    setSchedResult(null);
    const payload: Record<string, unknown> = { from: schedFrom, to: schedTo };
    if (schedOffice !== "__all__") payload.office_id = schedOffice;
    const { data, error } = await supabase.functions.invoke("sms-due-reminders", { body: payload });
    setSchedBusy(false);
    if (error) return toast.error(error.message);
    setSchedResult(data);
    if ((data as any)?.skipped) toast.warning(String((data as any).skipped));
    else toast.success(`Queued: ${(data as any)?.loan ?? 0} loan, ${(data as any)?.irrigation ?? 0} irrigation`);
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
          <CardHeader>
            <CardTitle className="text-base">Per-Office Overrides</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Disable SMS for a specific office, or use a different Sender ID. Leave Sender ID blank to fall back to the global setting.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-responsive">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2">Office</th>
                    <th className="px-3 py-2 w-32">SMS Enabled</th>
                    <th className="px-3 py-2">Sender ID (override)</th>
                  </tr>
                </thead>
                <tbody>
                  {offices.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No offices configured.</td></tr>
                  ) : offices.map((o) => {
                    const ov = overrides[o.id] ?? { office_id: o.id, enabled: true, sender_id: null };
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{o.name}</td>
                        <td className="px-3 py-2">
                          <Switch
                            checked={ov.enabled}
                            onCheckedChange={(v) => saveOfficeOverride(o.id, { enabled: v })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={ov.sender_id ?? ""}
                            placeholder={s.sender_id ?? "(global)"}
                            onChange={(e) => setOverrides({ ...overrides, [o.id]: { ...ov, sender_id: e.target.value } })}
                            onBlur={(e) => saveOfficeOverride(o.id, { sender_id: e.target.value.trim() || null })}
                            className="h-8 max-w-[220px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Message Templates</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Toggle Bangla / English. Live preview shows the message with sample values substituted for placeholders.
            </p>
          </CardHeader>
          <CardContent>
            {/* Editable sample variables */}
            <div className="rounded-md border bg-muted/30 p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Sample values for preview</Label>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setSampleVars({ ...DEFAULT_SAMPLE_VARS, date: new Date().toISOString().slice(0,10) })}>
                  Reset
                </Button>
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {Object.keys(DEFAULT_SAMPLE_VARS).map((k) => (
                  <div key={k}>
                    <Label className="text-[10px] font-mono text-muted-foreground">{`{${k}}`}</Label>
                    <Input
                      value={sampleVars[k] ?? ""}
                      onChange={(e) => setSampleVars({ ...sampleVars, [k]: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Edit values above and watch the preview below update live. These are not saved — only used to render previews.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end border-t pt-3">
                <div>
                  <Label className="text-xs font-medium">Test phone number</Label>
                  <Input
                    value={tplTestMobile}
                    onChange={(e) => setTplTestMobile(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="h-8 text-xs max-w-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Used by the <strong>Test</strong> button on each template — sends the rendered preview to this number.
                  </p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="bn">
              <TabsList>
                <TabsTrigger value="bn">বাংলা (Bangla)</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
              </TabsList>

              {(["bn", "en"] as const).map((lang) => (
                <TabsContent key={lang} value={lang} className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tplFields.map((f) => {
                      const key = (lang === "en" ? f.key + "_en" : f.key) as keyof Settings;
                      const value = ((s as any)[key] ?? "") as string;
                      const usedVars = TPL_VAR_MAP[f.key] ?? [];
                      const subset: Record<string, string> = {};
                      for (const k of usedVars) subset[k] = sampleVars[k] ?? "";
                      const preview = renderTpl(value, subset);
                      const vars = TEMPLATE_VARS[f.key] ?? [];
                      return (
                        <div key={String(key)} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">{f.label}</Label>
                            <div className="flex flex-wrap gap-1">
                              {vars.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => set(key, ((value ?? "") + " " + v) as any)}
                                  className="text-[10px] rounded bg-muted px-1.5 py-0.5 hover:bg-accent transition-colors font-mono"
                                  title="Click to insert at end"
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Textarea
                            value={value}
                            onChange={(e) => set(key, e.target.value as any)}
                            rows={3}
                            className="text-sm"
                            dir={lang === "bn" ? "auto" : "ltr"}
                          />
                          <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                              <Eye className="h-3 w-3"/> Preview
                              <span className="ml-auto">{preview.length} chars</span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap break-words">
                              {preview || <span className="italic text-muted-foreground">empty template</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4"/>Manual Due Reminder Scheduler</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Trigger reminder SMS for loans/irrigation dues falling within a custom date window. Duplicate reminders for the same item are skipped automatically.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div>
              <Label>From date</Label>
              <Input type="date" value={schedFrom} onChange={(e) => setSchedFrom(e.target.value)} />
            </div>
            <div>
              <Label>To date</Label>
              <Input type="date" value={schedTo} onChange={(e) => setSchedTo(e.target.value)} />
            </div>
            <div>
              <Label>Office</Label>
              <Select value={schedOffice} onValueChange={setSchedOffice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All offices</SelectItem>
                  {offices.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(today); }}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(new Date(Date.now()+86400000).toISOString().slice(0,10)); }}>+1d</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(new Date(Date.now()+3*86400000).toISOString().slice(0,10)); }}>+3d</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(in7); }}>+7d</Button>
            </div>
            <Button onClick={runManualReminders} disabled={schedBusy} className="sm:col-span-4 sm:w-auto">
              {schedBusy ? "Running…" : "Run Reminders Now"}
            </Button>
            {schedResult && (
              <div className="sm:col-span-4 rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                {schedResult.skipped ? (
                  <div className="text-amber-700 dark:text-amber-400">{String(schedResult.skipped)}</div>
                ) : (
                  <>
                    <div>Window: <span className="font-mono">{schedResult.window?.from} → {schedResult.window?.to}</span></div>
                    <div>Loan reminders queued: <strong>{schedResult.loan ?? 0}</strong></div>
                    <div>Irrigation reminders queued: <strong>{schedResult.irrigation ?? 0}</strong></div>
                    <div>Skipped (already sent): <strong>{schedResult.skipped_dup ?? 0}</strong></div>
                    <div>Retried stuck messages: <strong>{schedResult.retried ?? 0}</strong></div>
                    {Array.isArray(schedResult.errors) && schedResult.errors.length > 0 && (
                      <div className="text-destructive">Errors: {schedResult.errors.join("; ")}</div>
                    )}
                  </>
                )}
              </div>
            )}
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
