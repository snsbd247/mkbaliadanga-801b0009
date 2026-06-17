// One-click per-module dummy data seeder for testing.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Building2, Package, Users, Map, CalendarDays, PiggyBank, Landmark, Droplets, Zap, Banknote, CalendarRange, Receipt, UserCog, Sparkles, BookOpen, Wallet, ShieldCheck, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { seedDemoAssets } from "@/lib/assetDemoSeed";
import { fetchCashReportCounts, flagCashMismatches, downloadCashReportBackup, getLastSnapshot, restoreCashReportBackup, type CashCountRow, type CashSnapshot } from "@/lib/cashReportBackup";
import { logDemoRun } from "@/lib/demoOpsAudit";
import { downloadCashReportSummaryPdf, downloadCashReportSummaryCsv } from "@/lib/cashReportSummaryPdf";
import { getBackupSchedule, setBackupSchedule, maybeScheduledBackup, type BackupSchedule } from "@/lib/cashReportSchedule";
import { useRef } from "react";

type ModuleKey = "office" | "asset" | "farmers" | "lands" | "patwari" | "seasons" | "savings" | "loans" | "irrigation" | "expenses" | "bank" | "cashbook" | "cash_only" | "all";

type Status = "idle" | "running" | "ok" | "err";

const MODULES: { key: ModuleKey; title: string; desc: string; icon: any; modules: string[] | "asset" | "all"; monthsBack?: number }[] = [
  { key: "office",     title: "অফিস ও সেটিংস",        desc: "Divisions, districts, upazilas, mouzas + কোম্পানি সেটিংস + চার্ট অফ অ্যাকাউন্টস", icon: Building2,    modules: ["locations", "settings", "accounting"] },
  { key: "asset",      title: "এসেট",                  desc: "ক্যাটাগরি + ডেমো পাম্প/মোটর/কনজিউমেবলস + মুভমেন্ট/মেরামত/ডিসপোজাল",                  icon: Package,      modules: "asset" },
  { key: "farmers",    title: "ফার্মার (সদস্য)",      desc: "৫০ জন ডামি ফার্মার ভোটার নম্বর, মোবাইল, ঠিকানা সহ + পাটোয়ারি + ভোটার অডিট",          icon: Users,        modules: ["locations", "settings", "accounting", "farmers"] },
  { key: "lands",      title: "জমি (Lands)",           desc: "প্রতিটি ফার্মারের জন্য জমি, দাগ নম্বর, জমির ধরন, বর্গা সম্পর্ক + হস্তান্তর ও ইতিহাস",     icon: Map,          modules: ["locations", "settings", "accounting", "farmers"] },
  { key: "patwari",    title: "পাটোয়ারী ওয়ার্কফ্লো",  desc: "১০ জন পাটোয়ারী মৌজার সাথে ম্যাপ + ৩ মাসের সেচ ইনভয়েস (পাটোয়ারী রিপোর্ট টেস্টের জন্য)", icon: UserCog,      modules: ["locations", "settings", "accounting", "farmers", "irrigation"], monthsBack: 3 },
  { key: "seasons",    title: "সিজন",                  desc: "Boro/Aman সিজন + সিজন টাইপ + ক্যাটাগরি রেট",                                                icon: CalendarDays, modules: ["locations", "settings", "accounting", "farmers", "irrigation"] },
  { key: "savings",    title: "সঞ্চয়",                desc: "সঞ্চয় প্ল্যান, ফার্মারভিত্তিক আমানত/উত্তোলন + শেয়ার + Yearly Opening Balance",        icon: PiggyBank,    modules: ["locations", "settings", "accounting", "farmers", "savings"] },
  { key: "loans",      title: "ঋণ",                    desc: "অনুমোদিত ঋণ + কিস্তি শিডিউল + কিছু পরিশোধ + গ্যারান্টর + বিলম্ব ফি সেটিংস",            icon: Landmark,     modules: ["locations", "settings", "accounting", "farmers", "loans"] },
  { key: "irrigation", title: "সেচ",                  desc: "সিজন + রেট + ইনভয়েস + পেমেন্ট (Cash/Hawlat/Bank) + QR verifiable রসিদ",              icon: Droplets,     modules: ["locations", "settings", "accounting", "farmers", "irrigation"] },
  { key: "expenses",   title: "খরচ",                  desc: "মাসিক/বার্ষিক বিভিন্ন ধরনের খরচ এন্ট্রি (অফিস, বেতন, ইউটিলিটি ইত্যাদি)",                     icon: Receipt,      modules: ["settings", "accounting", "expenses"] },
  { key: "bank",       title: "ব্যাংক",               desc: "৩টি ব্যাংক একাউন্ট + ডিপোজিট/উইথড্র লেনদেন",                                                 icon: Banknote,     modules: ["settings", "accounting", "bank"] },
  { key: "cashbook",   title: "ক্যাশ বহি ও রিপোর্ট",  desc: "রসিদ (Cash Book), অফিস আয় (সেচ ও সমিতি), মাসিক ক্যাশ বহি ও হ্যান্ড ক্যাশ সাবমিশন — Cash Book/Hand Cash/Cash Audit/Cash Statement/আয়-ব্যয় ক্যাশ বহি রিপোর্টের জন্য", icon: BookOpen, modules: ["locations", "settings", "accounting", "farmers", "irrigation", "expenses", "bank", "cashbook"] },
  { key: "cash_only",  title: "শুধু ক্যাশ বহি + হ্যান্ড ক্যাশ", desc: "অন্য মডিউল না ছুঁয়ে শুধুমাত্র Cash Book ও Hand Cash সাবমিশন ডেমো ডাটা ইমপোর্ট করে (ন্যূনতম prerequisite সহ)।", icon: Wallet, modules: ["locations", "settings", "accounting", "farmers", "cashbook"] },

];

const ALL_OPS_MODULES = ["locations", "settings", "accounting", "farmers", "irrigation", "loans", "savings", "expenses", "bank", "cashbook"];

export default function QuickSeed() {
  const { officeId, user } = useAuth();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [size, setSize] = useState(50);
  const [backupFirst, setBackupFirst] = useState(true);
  const [schedule, setSchedule] = useState<BackupSchedule>(getBackupSchedule());
  const [cashValidation, setCashValidation] = useState<CashCountRow[] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const CASH_KEYS = ["cashbook", "cash_only", "all", "year_ops", "recent_features"];

  const maybeBackup = async (key: string): Promise<"skipped" | "ok" | "failed"> => {
    if (!CASH_KEYS.includes(key)) return "skipped";
    // Scheduled (daily/weekly) auto-snapshot, independent of the manual toggle.
    const sched = await maybeScheduledBackup(officeId);
    if (sched.status === "ok") toast.success(`নির্ধারিত ব্যাকআপ নেওয়া হয়েছে (${sched.rows} সারি)`);
    if (sched.status === "failed") toast.error(`নির্ধারিত ব্যাকআপ ব্যর্থ: ${sched.error}`);
    if (!backupFirst) return sched.status === "ok" ? "ok" : "skipped";
    try {
      const r = await downloadCashReportBackup(officeId);
      toast.success(`ব্যাকআপ নেওয়া হয়েছে (${r.rows} সারি, ${r.tables} টেবিল)`);
      return "ok";
    } catch (e: any) {
      toast.error(`ব্যাকআপ ব্যর্থ: ${e?.message ?? "Failed"}`);
      return "failed";
    }
  };

  const validateCash = async (key: string): Promise<CashCountRow[] | null> => {
    if (!CASH_KEYS.includes(key)) return null;
    try {
      const rows = await fetchCashReportCounts(officeId);
      setCashValidation(rows);
      const bad = flagCashMismatches(rows);
      if (bad.length) toast.warning(`${bad.length} টি cash-report টেবিল খালি`);
      return rows;
    } catch { return null; }
  };

  const runEdge = async (key: string, modules: string[], monthsBack?: number) => {
    setStatus((s) => ({ ...s, [key]: "running" }));
    setMsg((m) => ({ ...m, [key]: "" }));
    let backupStatus: "skipped" | "ok" | "failed" = "skipped";
    let validation: CashCountRow[] | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in");
      backupStatus = await maybeBackup(key);
      const body: any = { action: "import", modules, size, confirm: "RESET", transactional: true };
      if (monthsBack && monthsBack > 1) body.monthsBack = monthsBack;
      const { data, error } = await supabase.functions.invoke("demo-reset", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const counts = (data as any)?.counts || (data as any)?.summary || {};
      const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ") || "ডাটা যোগ হয়েছে";
      setStatus((s) => ({ ...s, [key]: "ok" }));
      setMsg((m) => ({ ...m, [key]: summary }));
      validation = await validateCash(key);
      await logDemoRun(user, { source: "QuickSeed", action: key, modules, size, success: true, backupStatus, validation });
      toast.success(`${key}: ডামি ডাটা তৈরি হয়েছে`);
    } catch (e: any) {
      setStatus((s) => ({ ...s, [key]: "err" }));
      setMsg((m) => ({ ...m, [key]: e?.message ?? "Failed" }));
      await logDemoRun(user, { source: "QuickSeed", action: key, modules, size, success: false, errorMessage: e?.message, backupStatus, validation });
      toast.error(`${key}: ${e?.message ?? "Failed"}`);
    }
  };

  const doRestore = async (snapshot: CashSnapshot) => {
    setRestoring(true);
    const tid = toast.loading("ব্যাকআপ থেকে restore হচ্ছে…");
    try {
      const r = await restoreCashReportBackup(snapshot);
      setCashValidation(r.verification);
      if (r.verified) toast.success(`Restore সম্পন্ন — ${r.totalRestored} সারি, row-count মিলেছে`, { id: tid });
      else toast.warning(`Restore হয়েছে (${r.totalRestored} সারি) কিন্তু কিছু row-count মেলেনি`, { id: tid });
    } catch (e: any) {
      toast.error(`Restore ব্যর্থ: ${e?.message ?? "Failed"}`, { id: tid });
    } finally {
      setRestoring(false);
    }
  };

  const restoreFromLast = async () => {
    const snap = getLastSnapshot();
    if (!snap) { toast.error("কোনো সাম্প্রতিক ব্যাকআপ snapshot নেই (এই ব্রাউজারে)"); return; }
    await doRestore(snap);
  };

  const restoreFromFile = async (file: File) => {
    try {
      const snap = JSON.parse(await file.text()) as CashSnapshot;
      if (snap?.kind !== "cash-report-backup" || !snap.tables) throw new Error("Invalid backup file");
      await doRestore(snap);
    } catch (e: any) {
      toast.error(`ফাইল পড়া যায়নি: ${e?.message ?? "Invalid"}`);
    }
  };

  const downloadSummary = async () => {
    const tid = toast.loading("PDF সারাংশ তৈরি হচ্ছে…");
    try {
      await downloadCashReportSummaryPdf({ source: "QuickSeed", modules: ["cashbook"], officeId, counts: cashValidation });
      toast.success("PDF ডাউনলোড হয়েছে", { id: tid });
    } catch (e: any) {
      toast.error(`PDF ব্যর্থ: ${e?.message ?? "Failed"}`, { id: tid });
    }
  };

  const downloadSummaryCsv = async () => {
    const tid = toast.loading("CSV সারাংশ তৈরি হচ্ছে…");
    try {
      await downloadCashReportSummaryCsv({ source: "QuickSeed", modules: ["cashbook"], officeId, counts: cashValidation });
      toast.success("CSV ডাউনলোড হয়েছে", { id: tid });
    } catch (e: any) {
      toast.error(`CSV ব্যর্থ: ${e?.message ?? "Failed"}`, { id: tid });
    }
  };




  const runAsset = async (key: string) => {
    setStatus((s) => ({ ...s, [key]: "running" }));
    setMsg((m) => ({ ...m, [key]: "" }));
    try {
      if (!officeId) throw new Error("No office assigned to your profile");
      const r = await seedDemoAssets(officeId, null);
      setStatus((s) => ({ ...s, [key]: "ok" }));
      setMsg((m) => ({ ...m, [key]: r.skipped ? "ইতিমধ্যে seed করা — skipped" : `${r.created} টি এসেট তৈরি` }));
      toast.success(r.skipped ? "Asset demo: skipped (already seeded)" : `Asset demo: ${r.created} created`);
    } catch (e: any) {
      setStatus((s) => ({ ...s, [key]: "err" }));
      setMsg((m) => ({ ...m, [key]: e?.message ?? "Failed" }));
      toast.error(`asset: ${e?.message ?? "Failed"}`);
    }
  };

  const runAll = async () => {
    setStatus((s) => ({ ...s, all: "running" }));
    try {
      await runEdge("all", ALL_OPS_MODULES);
      await runAsset("all_asset");
      setStatus((s) => ({ ...s, all: "ok" }));
      toast.success("সব মডিউলে ডামি ডাটা তৈরি হয়েছে");
    } catch {
      setStatus((s) => ({ ...s, all: "err" }));
    }
  };

  const counts = {
    ok: Object.values(status).filter((s) => s === "ok").length,
    err: Object.values(status).filter((s) => s === "err").length,
    running: Object.values(status).filter((s) => s === "running").length,
  };

  const StatusIcon = ({ s }: { s?: Status }) => {
    if (s === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
    if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === "err") return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <>
      <PageHeader
        title="Quick Seed — ডামি ডাটা জেনারেটর"
        description="প্রতি মডিউলে এক ক্লিকে টেস্ট ডাটা তৈরি করুন। প্রিরিকুইজিট মডিউল (locations/settings/accounting) স্বয়ংক্রিয়ভাবে অন্তর্ভুক্ত।"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" title="ক্যাশ-রিপোর্ট মডিউল seed করার আগে স্বয়ংক্রিয় JSON ব্যাকআপ">
              <input type="checkbox" checked={backupFirst} onChange={(e) => setBackupFirst(e.target.checked)} />
              <ShieldCheck className="h-3.5 w-3.5" /> seed-এর আগে ব্যাকআপ
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="নির্ধারিত সময় পর পর seed-এর আগে স্বয়ংক্রিয় ব্যাকআপ স্ন্যাপশট">
              নির্ধারিত ব্যাকআপ
              <select
                value={schedule}
                onChange={(e) => { const v = e.target.value as BackupSchedule; setSchedule(v); setBackupSchedule(v); }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="off">বন্ধ</option>
                <option value="daily">দৈনিক</option>
                <option value="weekly">সাপ্তাহিক</option>
              </select>
            </label>

            <label className="text-xs text-muted-foreground">Size</label>
            <input
              type="number"
              min={5}
              max={500}
              value={size}
              onChange={(e) => setSize(Math.max(5, Math.min(500, Number(e.target.value) || 50)))}
              className="w-20 h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runEdge("recent_features", ALL_OPS_MODULES, 2)}
              disabled={status.recent_features === "running"}
              title="সাম্প্রতিক ফিচার শোকেস — Hawlat/Bank পেমেন্ট, QR রসিদ, multi-loan"
            >
              {status.recent_features === "running" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              সাম্প্রতিক ফিচার
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runEdge("year_ops", ALL_OPS_MODULES, 12)}
              disabled={status.year_ops === "running"}
              title="১২ মাসের মাসিক সঞ্চয়, পুনরাবৃত্ত খরচ, ব্যাংক লেনদেন, পেমেন্ট ও ঋণ ছড়িয়ে seed করে"
            >
              {status.year_ops === "running" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarRange className="h-4 w-4 mr-1" />}
              ১ বছরের অপারেশনাল ডেমো
            </Button>
            <Button onClick={runAll} disabled={status.all === "running"}>
              {status.all === "running" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
              সব মডিউল একসাথে
            </Button>
          </div>
        }
      />

      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm mb-4 flex flex-wrap items-center justify-between gap-2">
        <span>
          ⚠️ <b>সতর্কতা:</b> এটি শুধু টেস্টিং / ডেমো-এর জন্য। বিদ্যমান ডাটা মুছে ফেলা হবে না, কিন্তু ডুপ্লিকেট কোড এড়াতে চেষ্টা করা হবে।
        </span>
        <div className="flex items-center gap-2 text-xs">
          {counts.ok > 0 && <Badge variant="default" className="bg-green-600">✓ {counts.ok} সফল</Badge>}
          {counts.running > 0 && <Badge variant="secondary">⟳ {counts.running} চলছে</Badge>}
          {counts.err > 0 && <Badge variant="destructive">✕ {counts.err} ত্রুটি</Badge>}
        </div>
        {msg.year_ops && (
          <div className="w-full mt-2 text-xs">
            <b>১ বছরের অপারেশনাল রান:</b>{" "}
            <span className={status.year_ops === "err" ? "text-destructive" : ""}>{msg.year_ops}</span>
          </div>
        )}
        {msg.recent_features && (
          <div className="w-full mt-1 text-xs">
            <b>সাম্প্রতিক ফিচার রান:</b>{" "}
            <span className={status.recent_features === "err" ? "text-destructive" : ""}>{msg.recent_features}</span>
          </div>
        )}
      </div>

      {cashValidation && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Cash-Report Validation (Cash Book / Hand Cash / Cash Statement)
              {flagCashMismatches(cashValidation).length === 0
                ? <Badge className="bg-green-600 ml-auto">সব ঠিক আছে</Badge>
                : <Badge variant="destructive" className="ml-auto">{flagCashMismatches(cashValidation).length} টি mismatch</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {cashValidation.map((r) => (
                <div key={r.table} className="flex items-center justify-between border rounded px-2 py-1">
                  <span className="font-mono">{r.table}{r.required && <span className="text-destructive">*</span>}</span>
                  <Badge variant={r.ok ? "secondary" : "destructive"}>{r.count}</Badge>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">* required টেবিল — খালি হলে mismatch হিসেবে flag হয়।</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={restoreFromLast} disabled={restoring}>
                <ShieldCheck className="h-4 w-4 mr-1" /> শেষ ব্যাকআপ থেকে Restore
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring}>
                <Upload className="h-4 w-4 mr-1" /> ফাইল থেকে Restore
              </Button>
              <Button size="sm" variant="outline" onClick={downloadSummary}>
                <FileText className="h-4 w-4 mr-1" /> PDF সারাংশ
              </Button>
              <Button size="sm" variant="outline" onClick={downloadSummaryCsv}>
                <FileText className="h-4 w-4 mr-1" /> CSV সারাংশ
              </Button>
              <input
                ref={fileRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) restoreFromFile(f); e.currentTarget.value = ""; }}
              />
            </div>
          </CardContent>
        </Card>
      )}





      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const st = status[m.key];
          return (
            <Card key={m.key} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {m.title}
                  <span className="ml-auto"><StatusIcon s={st} /></span>
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">{m.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-2">
                {msg[m.key] && (
                  <Badge variant={st === "err" ? "destructive" : "secondary"} className="text-[10px] whitespace-normal text-left h-auto py-1 px-2 max-w-full">
                    {msg[m.key]}
                  </Badge>
                )}
                <Button
                  className="w-full"
                  size="sm"
                  variant={st === "ok" ? "outline" : "default"}
                  disabled={st === "running"}
                  onClick={() => (m.modules === "asset" ? runAsset(m.key) : runEdge(m.key, m.modules as string[], m.monthsBack))}
                >
                  {st === "running" ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> চলছে…</>
                  ) : st === "ok" ? (
                    "আবার চালান"
                  ) : (
                    "এখন তৈরি করুন"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
