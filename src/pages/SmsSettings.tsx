import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
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
import { MessageSquare, Send, Eye, CalendarClock, AlertTriangle, RotateCcw, Wand2, FlaskConical, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

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

// Safe sample fillers used by the auto-fill button (kept short so SMS length stays small)
const AUTOFILL_TOKENS: Record<string, string> = {
  "{amount}": "{amount}",
  "{balance}": "{balance}",
  "{payable}": "{payable}",
  "{due}": "{due}",
  "{type}": "{type}",
  "{date}": "{date}",
};

const TPL_VAR_MAP: Record<string, string[]> = {
  tpl_savings_deposit: ["amount", "balance"],
  tpl_savings_withdraw: ["amount", "balance"],
  tpl_loan_approved: ["amount", "payable"],
  tpl_loan_payment: ["amount", "due"],
  tpl_irrigation_payment: ["amount"],
  tpl_due_reminder: ["type", "due", "date"],
};

function renderTpl(tpl: string, vars: Record<string, string>): string {
  let out = tpl ?? "";
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  tpl_savings_deposit: "প্রিয় গ্রাহক, আপনার সঞ্চয়ে ৳{amount} জমা হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}। ধন্যবাদ।",
  tpl_savings_withdraw: "প্রিয় গ্রাহক, আপনার সঞ্চয় থেকে ৳{amount} উত্তোলন হয়েছে। বর্তমান ব্যালেন্স: ৳{balance}।",
  tpl_loan_approved: "অভিনন্দন! আপনার ঋণ ৳{amount} অনুমোদিত হয়েছে। মোট পরিশোধযোগ্য: ৳{payable}।",
  tpl_loan_payment: "আপনার ঋণ পরিশোধ ৳{amount} গৃহীত হয়েছে। অবশিষ্ট বকেয়া: ৳{due}। ধন্যবাদ।",
  tpl_irrigation_payment: "আপনার সেচ ফি ৳{amount} গৃহীত হয়েছে। ধন্যবাদ।",
  tpl_due_reminder: "স্মরণিকা: আপনার {type} বকেয়া ৳{due} পরিশোধের তারিখ {date}। অনুগ্রহ করে যথাসময়ে পরিশোধ করুন।",
  tpl_savings_deposit_en: "Dear member, BDT {amount} has been deposited to your savings. Current balance: BDT {balance}. Thank you.",
  tpl_savings_withdraw_en: "Dear member, BDT {amount} has been withdrawn from your savings. Current balance: BDT {balance}.",
  tpl_loan_approved_en: "Congratulations! Your loan of BDT {amount} has been approved. Total payable: BDT {payable}.",
  tpl_loan_payment_en: "Your loan payment of BDT {amount} has been received. Remaining due: BDT {due}. Thank you.",
  tpl_irrigation_payment_en: "Your irrigation fee of BDT {amount} has been received. Thank you.",
  tpl_due_reminder_en: "Reminder: Your {type} due of BDT {due} is payable on {date}. Please pay on time.",
};

function findMissingPlaceholders(tpl: string, required: string[]): string[] {
  const t = tpl ?? "";
  return required.filter((v) => !t.includes(v));
}

// Localized strings for this page only (kept here to avoid touching the global dictionary).
const I = {
  en: {
    pageTitle: "SMS Settings",
    pageDesc: "Configure GreenWeb Bulk SMS notifications",
    provider: "Provider",
    enableSms: "Enable SMS",
    enableSmsHint: "Master switch for all SMS notifications.",
    senderId: "Sender ID (optional)",
    defaultLanguage: "Default Language",
    defaultLanguageHint: "Used for due reminders.",
    reminderDaysBefore: "Reminder days before due",
    secretsHint: "API token is stored securely in backend secrets and never exposed in the frontend. Reminders run daily and are sent only once per due event.",
    triggers: "Trigger Events",
    trg_savings_deposit: "Savings deposit",
    trg_savings_withdraw: "Savings withdraw",
    trg_loan_approved: "Loan approved",
    trg_loan_payment: "Loan payment received",
    trg_irrigation_payment: "Irrigation payment",
    trg_due_reminder: "Due reminders",
    perOffice: "Per-Office Overrides",
    perOfficeHint: "Disable SMS for a specific office, or use a different Sender ID. Leave Sender ID blank to fall back to the global setting.",
    office: "Office",
    smsEnabled: "SMS Enabled",
    senderIdOverride: "Sender ID (override)",
    noOffices: "No offices configured.",
    templates: "Message Templates",
    templatesHint: "Toggle Bangla / English. Live preview shows the message with sample values substituted for placeholders.",
    sampleValues: "Sample values for preview",
    reset: "Reset",
    sampleHint: "Edit values above and watch the preview below update live. These are not saved — only used to render previews.",
    testPhone: "Test phone number",
    testPhoneHint: "Used by the Test button on each template — sends the rendered preview to this number.",
    bangla: "বাংলা (Bangla)",
    english: "English",
    preview: "Preview",
    chars: "chars",
    emptyTpl: "empty template",
    missing: "Missing placeholder",
    missingPlural: "Missing placeholders",
    missingTail: ". Saving is blocked unless you allow override below.",
    autoFill: "Auto-fill",
    autoFillTitle: "Append missing placeholders to the template",
    resetDefault: "Reset to default",
    alreadyDefault: "Already matches the default",
    restoreWording: "Restore default wording",
    testSend: "Test send",
    sending: "Sending…",
    enterTestPhone: "Enter a test phone number above",
    sendRenderedPreview: "Send rendered preview to test number",
    scheduler: "Manual Due Reminder Scheduler",
    schedulerHint: "Trigger reminder SMS for loans/irrigation dues falling within a custom date window. Duplicate reminders for the same item are skipped automatically.",
    fromDate: "From date",
    toDate: "To date",
    allOffices: "All offices",
    today: "Today",
    runReminders: "Run Reminders Now",
    running: "Running…",
    sendTestCard: "Send Test SMS",
    mobile: "Mobile",
    message: "Message",
    sendTestBtn: "Send Test",
    saveSettings: "Save Settings",
    saving: "Saving…",
    overrideMissing: "Allow saving even if templates are missing required placeholders",
    overrideHint: "Off: saving is blocked when any active template is missing a required tag. On: warnings remain but saving is allowed.",
    blockedSave: "Cannot save: some templates are missing required placeholders. Toggle override to save anyway.",
    saved: "Saved",
    confirmTitle: "Send test SMS?",
    confirmDescPrefix: "A real SMS will be sent to",
    confirmDescTpl: "Template",
    confirmDescPreview: "Preview",
    confirm: "Send SMS",
    cancel: "Cancel",
    invalidPhone: "Enter a valid phone number (10–15 digits)",
    testSent: "Test SMS sent ✓",
    testFailed: "Failed",
    testLogTitle: "Test Result Log",
    testLogHint: "Recent one-click template tests are listed here.",
    clearLog: "Clear",
    noTests: "No tests sent yet.",
    time: "Time",
    template: "Template",
    target: "Target",
    status: "Status",
    success: "Success",
    failed: "Failed",
    autoFilled: "Auto-filled missing placeholders — review and Save",
    nothingToFill: "Nothing to fill — all placeholders are already present",
    resetToastSaved: "Reset to default — remember to Save",
    enterMobile: "Enter mobile",
    enterTestNumberFirst: "Enter a phone number above to test",
    tplEmpty: "Template is empty",
    pickBothDates: "Pick both dates",
    fromBeforeTo: "From date must be before To date",
  },
  bn: {
    pageTitle: "এসএমএস সেটিংস",
    pageDesc: "গ্রিনওয়েব বাল্ক এসএমএস নোটিফিকেশন কনফিগার করুন",
    provider: "প্রোভাইডার",
    enableSms: "এসএমএস সক্রিয় করুন",
    enableSmsHint: "সমস্ত এসএমএস নোটিফিকেশনের প্রধান সুইচ।",
    senderId: "সেন্ডার আইডি (ঐচ্ছিক)",
    defaultLanguage: "ডিফল্ট ভাষা",
    defaultLanguageHint: "বকেয়া স্মরণিকার জন্য ব্যবহৃত।",
    reminderDaysBefore: "বকেয়ার আগে স্মরণিকা (দিন)",
    secretsHint: "API টোকেন ব্যাকএন্ড সিক্রেটে নিরাপদে রাখা আছে এবং ফ্রন্টএন্ডে দেখানো হয় না। স্মরণিকা প্রতিদিন চলে এবং প্রতিটি বকেয়ার জন্য একবারই পাঠানো হয়।",
    triggers: "ট্রিগার ইভেন্ট",
    trg_savings_deposit: "সঞ্চয় জমা",
    trg_savings_withdraw: "সঞ্চয় উত্তোলন",
    trg_loan_approved: "ঋণ অনুমোদিত",
    trg_loan_payment: "ঋণ পরিশোধ গৃহীত",
    trg_irrigation_payment: "সেচ পেমেন্ট",
    trg_due_reminder: "বকেয়া স্মরণিকা",
    perOffice: "অফিস-ভিত্তিক ওভাররাইড",
    perOfficeHint: "নির্দিষ্ট অফিসের জন্য এসএমএস বন্ধ করুন বা ভিন্ন সেন্ডার আইডি ব্যবহার করুন। সেন্ডার আইডি খালি রাখলে গ্লোবাল সেটিং প্রযোজ্য হবে।",
    office: "অফিস",
    smsEnabled: "এসএমএস সক্রিয়",
    senderIdOverride: "সেন্ডার আইডি (ওভাররাইড)",
    noOffices: "কোনো অফিস কনফিগার করা নেই।",
    templates: "মেসেজ টেমপ্লেট",
    templatesHint: "বাংলা / ইংরেজি টগল করুন। লাইভ প্রিভিউ স্যাম্পল ভ্যালু সহ মেসেজ দেখায়।",
    sampleValues: "প্রিভিউয়ের জন্য স্যাম্পল মান",
    reset: "রিসেট",
    sampleHint: "উপরের মান পরিবর্তন করুন এবং নিচে প্রিভিউ লাইভ আপডেট দেখুন। এগুলো সংরক্ষিত হয় না — শুধু প্রিভিউয়ের জন্য।",
    testPhone: "টেস্ট ফোন নম্বর",
    testPhoneHint: "প্রতিটি টেমপ্লেটের টেস্ট বোতাম এই নম্বরে রেন্ডার করা প্রিভিউ পাঠাবে।",
    bangla: "বাংলা",
    english: "English",
    preview: "প্রিভিউ",
    chars: "অক্ষর",
    emptyTpl: "খালি টেমপ্লেট",
    missing: "অনুপস্থিত প্লেসহোল্ডার",
    missingPlural: "অনুপস্থিত প্লেসহোল্ডার",
    missingTail: "। ওভাররাইড চালু না করলে সংরক্ষণ করা যাবে না।",
    autoFill: "অটো-ফিল",
    autoFillTitle: "অনুপস্থিত প্লেসহোল্ডার টেমপ্লেটে যুক্ত করুন",
    resetDefault: "ডিফল্টে ফেরান",
    alreadyDefault: "ইতিমধ্যে ডিফল্ট",
    restoreWording: "ডিফল্ট লেখা ফিরিয়ে আনুন",
    testSend: "টেস্ট পাঠান",
    sending: "পাঠানো হচ্ছে…",
    enterTestPhone: "উপরে টেস্ট ফোন নম্বর দিন",
    sendRenderedPreview: "প্রিভিউ টেস্ট নম্বরে পাঠান",
    scheduler: "ম্যানুয়াল বকেয়া স্মরণিকা শিডিউলার",
    schedulerHint: "নির্দিষ্ট তারিখ পরিসরে ঋণ/সেচ বকেয়ার জন্য স্মরণিকা পাঠান। একই আইটেমের জন্য পুনরাবৃত্ত স্মরণিকা স্বয়ংক্রিয়ভাবে এড়ানো হয়।",
    fromDate: "শুরু তারিখ",
    toDate: "শেষ তারিখ",
    allOffices: "সব অফিস",
    today: "আজ",
    runReminders: "এখন স্মরণিকা চালান",
    running: "চলছে…",
    sendTestCard: "টেস্ট এসএমএস পাঠান",
    mobile: "মোবাইল",
    message: "মেসেজ",
    sendTestBtn: "টেস্ট পাঠান",
    saveSettings: "সেটিংস সংরক্ষণ",
    saving: "সংরক্ষণ হচ্ছে…",
    overrideMissing: "প্রয়োজনীয় প্লেসহোল্ডার অনুপস্থিত থাকলেও সংরক্ষণের অনুমতি দিন",
    overrideHint: "বন্ধ: কোনো সক্রিয় টেমপ্লেটে প্রয়োজনীয় ট্যাগ অনুপস্থিত থাকলে সংরক্ষণ ব্লক হবে। চালু: সতর্কতা থাকবে কিন্তু সংরক্ষণ করা যাবে।",
    blockedSave: "সংরক্ষণ করা যাবে না: কিছু টেমপ্লেটে প্রয়োজনীয় প্লেসহোল্ডার নেই। তবুও সংরক্ষণ করতে ওভাররাইড চালু করুন।",
    saved: "সংরক্ষিত হয়েছে",
    confirmTitle: "টেস্ট এসএমএস পাঠাবেন?",
    confirmDescPrefix: "একটি প্রকৃত এসএমএস পাঠানো হবে",
    confirmDescTpl: "টেমপ্লেট",
    confirmDescPreview: "প্রিভিউ",
    confirm: "এসএমএস পাঠান",
    cancel: "বাতিল",
    invalidPhone: "সঠিক ফোন নম্বর দিন (১০–১৫ ডিজিট)",
    testSent: "টেস্ট এসএমএস পাঠানো হয়েছে ✓",
    testFailed: "ব্যর্থ",
    testLogTitle: "টেস্ট ফলাফল লগ",
    testLogHint: "সাম্প্রতিক ওয়ান-ক্লিক টেস্টগুলো এখানে দেখানো হয়েছে।",
    clearLog: "মুছুন",
    noTests: "এখনো কোনো টেস্ট পাঠানো হয়নি।",
    time: "সময়",
    template: "টেমপ্লেট",
    target: "প্রাপক",
    status: "অবস্থা",
    success: "সফল",
    failed: "ব্যর্থ",
    autoFilled: "অনুপস্থিত প্লেসহোল্ডার যুক্ত হয়েছে — সংরক্ষণ করুন",
    nothingToFill: "যোগ করার কিছু নেই — সব প্লেসহোল্ডার ইতিমধ্যে আছে",
    resetToastSaved: "ডিফল্টে ফেরানো হয়েছে — সংরক্ষণ করতে ভুলবেন না",
    enterMobile: "মোবাইল দিন",
    enterTestNumberFirst: "টেস্টের জন্য উপরে একটি ফোন নম্বর দিন",
    tplEmpty: "টেমপ্লেট খালি",
    pickBothDates: "দুটি তারিখই নির্বাচন করুন",
    fromBeforeTo: "শুরু তারিখ শেষ তারিখের আগে হতে হবে",
  },
} as const;

type Office = { id: string; name: string };
type OfficeOverride = { office_id: string; enabled: boolean; sender_id: string | null };

type TestRecord = {
  id: string;
  at: string;
  templateKey: string;
  target: string;
  preview: string;
  status: "success" | "failed";
  error?: string;
};

const TEST_LOG_KEY = "sms_test_results_v1";
const OVERRIDE_KEY = "sms_save_override_v1";

function loadTestLog(): TestRecord[] {
  try {
    const raw = localStorage.getItem(TEST_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function isValidPhone(p: string): boolean {
  const digits = p.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export default function SmsSettings() {
  const { isSuper, rolesLoaded } = useAuth();
  const { lang } = useLang();
  const L = I[lang === "bn" ? "bn" : "en"];

  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMobile, setTestMobile] = useState("");
  const [testMsg, setTestMsg] = useState("পরীক্ষামূলক বার্তা — Smart Irrigation");
  const [tplTestMobile, setTplTestMobile] = useState("");
  const [tplTestBusy, setTplTestBusy] = useState<string | null>(null);
  const [sampleVars, setSampleVars] = useState<Record<string, string>>(DEFAULT_SAMPLE_VARS);
  const [offices, setOffices] = useState<Office[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OfficeOverride>>({});
  const [allowOverride, setAllowOverride] = useState<boolean>(() => localStorage.getItem(OVERRIDE_KEY) === "1");
  const [testLog, setTestLog] = useState<TestRecord[]>(() => loadTestLog());
  const [confirmTest, setConfirmTest] = useState<{ key: keyof Settings; baseKey: string; preview: string; label: string } | null>(null);

  // Manual scheduler state
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [schedFrom, setSchedFrom] = useState<string>(today);
  const [schedTo, setSchedTo] = useState<string>(in7);
  const [schedOffice, setSchedOffice] = useState<string>("__all__");
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedResult, setSchedResult] = useState<any>(null);

  useEffect(() => {
    document.title = L.pageTitle;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(OVERRIDE_KEY, allowOverride ? "1" : "0");
  }, [allowOverride]);

  function persistTestLog(next: TestRecord[]) {
    setTestLog(next);
    try {
      localStorage.setItem(TEST_LOG_KEY, JSON.stringify(next.slice(0, 50)));
    } catch {
      /* ignore */
    }
  }

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

  // Compute templates with missing placeholders (across both languages, all 6 fields each)
  const missingByKey = useMemo(() => {
    if (!s) return {} as Record<string, string[]>;
    const result: Record<string, string[]> = {};
    for (const baseKey of Object.keys(TEMPLATE_VARS)) {
      const required = TEMPLATE_VARS[baseKey];
      for (const langSuffix of ["", "_en"] as const) {
        const k = (baseKey + langSuffix) as keyof Settings;
        const tpl = ((s as any)[k] ?? "") as string;
        const miss = findMissingPlaceholders(tpl, required);
        if (miss.length) result[String(k)] = miss;
      }
    }
    return result;
  }, [s]);

  const hasMissing = Object.keys(missingByKey).length > 0;

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/" replace />;
  if (!s) return <div className="p-6 text-muted-foreground">Loading…</div>;

  async function save() {
    if (hasMissing && !allowOverride) {
      return toast.error(L.blockedSave);
    }
    setBusy(true);
    const { error } = await supabase
      .from("sms_settings")
      .update({ ...s, updated_at: new Date().toISOString() } as any)
      .eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(L.saved);
  }

  async function sendTest() {
    if (!testMobile.trim()) return toast.error(L.enterMobile);
    if (!isValidPhone(testMobile)) return toast.error(L.invalidPhone);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { mobile: testMobile.trim(), message: testMsg, event_type: "manual" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok) toast.success(L.testSent);
    else toast.error(L.testFailed + ": " + ((data as any)?.response ?? "unknown"));
  }

  function requestTemplateTest(key: keyof Settings, baseKey: string, label: string) {
    if (!tplTestMobile.trim()) return toast.error(L.enterTestNumberFirst);
    if (!isValidPhone(tplTestMobile)) return toast.error(L.invalidPhone);
    const tpl = ((s as any)[key] ?? "") as string;
    if (!tpl.trim()) return toast.error(L.tplEmpty);
    const usedVars = TPL_VAR_MAP[baseKey] ?? [];
    const subset: Record<string, string> = {};
    for (const k of usedVars) subset[k] = sampleVars[k] ?? "";
    const preview = renderTpl(tpl, subset);
    setConfirmTest({ key, baseKey, preview, label });
  }

  async function performTemplateTest() {
    if (!confirmTest) return;
    const { key, preview, label } = confirmTest;
    setConfirmTest(null);
    setTplTestBusy(String(key));
    const target = tplTestMobile.trim();
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { mobile: target, message: preview, event_type: "manual_template_test" },
    });
    setTplTestBusy(null);
    const ok = !error && (data as any)?.ok;
    const errText = error ? error.message : ok ? undefined : ((data as any)?.response ?? "unknown");
    const rec: TestRecord = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      templateKey: `${label} (${String(key)})`,
      target,
      preview,
      status: ok ? "success" : "failed",
      error: errText,
    };
    persistTestLog([rec, ...testLog].slice(0, 50));
    if (ok) toast.success(L.testSent);
    else toast.error(L.testFailed + ": " + (errText ?? "unknown"));
  }

  function resetTemplate(key: keyof Settings) {
    const def = DEFAULT_TEMPLATES[String(key)];
    if (def === undefined) return;
    set(key, def as any);
    toast.success(L.resetToastSaved);
  }

  function autoFillTemplate(key: keyof Settings, baseKey: string) {
    const required = TEMPLATE_VARS[baseKey] ?? [];
    const value = (((s as any)[key] ?? "") as string);
    const missing = findMissingPlaceholders(value, required);
    if (missing.length === 0) {
      toast.message(L.nothingToFill);
      return;
    }
    const appendix = missing.map((v) => AUTOFILL_TOKENS[v] ?? v).join(" ");
    const sep = value.trim().length === 0 ? "" : value.endsWith(" ") ? "" : " ";
    set(key, (value + sep + appendix) as any);
    toast.success(L.autoFilled);
  }

  async function runManualReminders() {
    if (!schedFrom || !schedTo) return toast.error(L.pickBothDates);
    if (schedFrom > schedTo) return toast.error(L.fromBeforeTo);
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
    { key: "tpl_savings_deposit", label: L.trg_savings_deposit },
    { key: "tpl_savings_withdraw", label: L.trg_savings_withdraw },
    { key: "tpl_loan_approved", label: L.trg_loan_approved },
    { key: "tpl_loan_payment", label: L.trg_loan_payment },
    { key: "tpl_irrigation_payment", label: L.trg_irrigation_payment },
    { key: "tpl_due_reminder", label: L.trg_due_reminder },
  ];

  return (
    <>
      <PageHeader title={L.pageTitle} description={L.pageDesc} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {L.provider}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">{L.enableSms}</Label>
                <p className="text-xs text-muted-foreground">{L.enableSmsHint}</p>
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
            <div>
              <Label>{L.senderId}</Label>
              <Input value={s.sender_id ?? ""} onChange={(e) => set("sender_id", e.target.value)} placeholder="e.g. SmartIrri" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{L.defaultLanguage}</Label>
                <Select value={s.language} onValueChange={(v) => set("language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bangla (বাংলা)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">{L.defaultLanguageHint}</p>
              </div>
              <div>
                <Label>{L.reminderDaysBefore}</Label>
                <Input type="number" min={0} max={30} value={s.reminder_days_before}
                  onChange={(e) => set("reminder_days_before", Math.max(0, Number(e.target.value || 0)))} />
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">{L.secretsHint}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{L.triggers}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {([
              ["send_on_savings_deposit", L.trg_savings_deposit],
              ["send_on_savings_withdraw", L.trg_savings_withdraw],
              ["send_on_loan_approved", L.trg_loan_approved],
              ["send_on_loan_payment", L.trg_loan_payment],
              ["send_on_irrigation_payment", L.trg_irrigation_payment],
              ["send_on_due_reminder", L.trg_due_reminder],
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
            <CardTitle className="text-base">{L.perOffice}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{L.perOfficeHint}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="table-responsive">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2">{L.office}</th>
                    <th className="px-3 py-2 w-32">{L.smsEnabled}</th>
                    <th className="px-3 py-2">{L.senderIdOverride}</th>
                  </tr>
                </thead>
                <tbody>
                  {offices.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">{L.noOffices}</td></tr>
                  ) : offices.map((o) => {
                    const ov = overrides[o.id] ?? { office_id: o.id, enabled: true, sender_id: null };
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{o.name}</td>
                        <td className="px-3 py-2">
                          <Switch checked={ov.enabled} onCheckedChange={(v) => saveOfficeOverride(o.id, { enabled: v })} />
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
            <CardTitle className="text-base">{L.templates}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{L.templatesHint}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">{L.sampleValues}</Label>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setSampleVars({ ...DEFAULT_SAMPLE_VARS, date: new Date().toISOString().slice(0, 10) })}>
                  {L.reset}
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
              <p className="text-[10px] text-muted-foreground mt-2">{L.sampleHint}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end border-t pt-3">
                <div>
                  <Label className="text-xs font-medium">{L.testPhone}</Label>
                  <Input
                    value={tplTestMobile}
                    onChange={(e) => setTplTestMobile(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="h-8 text-xs max-w-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{L.testPhoneHint}</p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="bn">
              <TabsList>
                <TabsTrigger value="bn">{L.bangla}</TabsTrigger>
                <TabsTrigger value="en">{L.english}</TabsTrigger>
              </TabsList>

              {(["bn", "en"] as const).map((tabLang) => (
                <TabsContent key={tabLang} value={tabLang} className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tplFields.map((f) => {
                      const key = (tabLang === "en" ? f.key + "_en" : f.key) as keyof Settings;
                      const value = ((s as any)[key] ?? "") as string;
                      const usedVars = TPL_VAR_MAP[f.key] ?? [];
                      const subset: Record<string, string> = {};
                      for (const k of usedVars) subset[k] = sampleVars[k] ?? "";
                      const preview = renderTpl(value, subset);
                      const vars = TEMPLATE_VARS[f.key] ?? [];
                      const missing = findMissingPlaceholders(value, vars);
                      const defaultTpl = DEFAULT_TEMPLATES[String(key)] ?? "";
                      const isDefault = value === defaultTpl;
                      const testingThis = tplTestBusy === String(key);
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
                            dir={tabLang === "bn" ? "auto" : "ltr"}
                          />
                          {missing.length > 0 && (
                            <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>
                                {missing.length > 1 ? L.missingPlural : L.missing}:{" "}
                                <span className="font-mono">{missing.join(", ")}</span>{L.missingTail}
                              </span>
                            </div>
                          )}
                          <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                              <Eye className="h-3 w-3" /> {L.preview}
                              <span className="ml-auto">{preview.length} {L.chars}</span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap break-words">
                              {preview || <span className="italic text-muted-foreground">{L.emptyTpl}</span>}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => autoFillTemplate(key, f.key)}
                              disabled={missing.length === 0}
                              title={L.autoFillTitle}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              {L.autoFill}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => resetTemplate(key)}
                              disabled={isDefault || !defaultTpl}
                              title={isDefault ? L.alreadyDefault : L.restoreWording}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {L.resetDefault}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => requestTemplateTest(key, f.key, f.label)}
                              disabled={testingThis || !tplTestMobile.trim() || !value.trim()}
                              title={!tplTestMobile.trim() ? L.enterTestPhone : L.sendRenderedPreview}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {testingThis ? L.sending : L.testSend}
                            </Button>
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
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              {L.testLogTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{L.testLogHint}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex justify-end px-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                disabled={testLog.length === 0}
                onClick={() => persistTestLog([])}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {L.clearLog}
              </Button>
            </div>
            <div className="table-responsive">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2">{L.time}</th>
                    <th className="px-3 py-2">{L.template}</th>
                    <th className="px-3 py-2">{L.target}</th>
                    <th className="px-3 py-2">{L.preview}</th>
                    <th className="px-3 py-2 w-24">{L.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {testLog.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{L.noTests}</td></tr>
                  ) : testLog.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                        {new Date(r.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
                      </td>
                      <td className="px-3 py-2">{r.templateKey}</td>
                      <td className="px-3 py-2 font-mono">{r.target}</td>
                      <td className="px-3 py-2 max-w-md">
                        <div className="whitespace-pre-wrap break-words">{r.preview}</div>
                        {r.error && <div className="text-destructive text-[11px] mt-1">{r.error}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "success" ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> {L.success}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> {L.failed}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />{L.scheduler}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{L.schedulerHint}</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div>
              <Label>{L.fromDate}</Label>
              <Input type="date" value={schedFrom} onChange={(e) => setSchedFrom(e.target.value)} />
            </div>
            <div>
              <Label>{L.toDate}</Label>
              <Input type="date" value={schedTo} onChange={(e) => setSchedTo(e.target.value)} />
            </div>
            <div>
              <Label>{L.office}</Label>
              <Select value={schedOffice} onValueChange={setSchedOffice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{L.allOffices}</SelectItem>
                  {offices.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(today); }}>{L.today}</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(new Date(Date.now() + 86400000).toISOString().slice(0, 10)); }}>+1d</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)); }}>+3d</Button>
              <Button variant="outline" size="sm" onClick={() => { setSchedFrom(today); setSchedTo(in7); }}>+7d</Button>
            </div>
            <Button onClick={runManualReminders} disabled={schedBusy} className="sm:col-span-4 sm:w-auto">
              {schedBusy ? L.running : L.runReminders}
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />{L.sendTestCard}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <Label>{L.mobile}</Label>
              <Input value={testMobile} onChange={(e) => setTestMobile(e.target.value)} placeholder="017XXXXXXXX" />
            </div>
            <div className="sm:col-span-2">
              <Label>{L.message}</Label>
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
            </div>
            <Button onClick={sendTest} disabled={busy} className="sm:col-span-3 sm:w-auto">{L.sendTestBtn}</Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-end">
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs flex-1">
          <Switch checked={allowOverride} onCheckedChange={setAllowOverride} />
          <div>
            <div className="font-medium">{L.overrideMissing}</div>
            <div className="text-muted-foreground text-[11px]">{L.overrideHint}</div>
          </div>
        </div>
        <Button
          onClick={save}
          disabled={busy || (hasMissing && !allowOverride)}
          className="w-full sm:w-auto"
          title={hasMissing && !allowOverride ? L.blockedSave : undefined}
        >
          {busy ? L.saving : L.saveSettings}
        </Button>
      </div>

      <AlertDialog open={!!confirmTest} onOpenChange={(o) => !o && setConfirmTest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  {L.confirmDescPrefix}{" "}
                  <span className="font-mono font-semibold">{tplTestMobile}</span>.
                </div>
                {confirmTest && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{L.confirmDescTpl}:</span> {confirmTest.label}
                    </div>
                    <div className="rounded-md border bg-muted/40 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">{L.confirmDescPreview}</div>
                      <div className="text-xs whitespace-pre-wrap break-words">{confirmTest.preview}</div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={performTemplateTest}>{L.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
