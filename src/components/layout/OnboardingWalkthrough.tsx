// Lightweight first-run onboarding walkthrough.
// Highlights the cash-book exports, saved filter presets, demo/backup tools and
// audit logs, each linking to the relevant screen + manual section.
// Shows automatically on first visit (per-browser flag) and can be relaunched
// by dispatching window event "open-onboarding".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { FileDown, BookmarkCheck, Database, ScrollText } from "lucide-react";

const SEEN_KEY = "onboarding_walkthrough_seen_v1";

type Step = {
  icon: any;
  title: [string, string];
  body: [string, string];
  to: string;
  cta: [string, string];
};

const STEPS: Step[] = [
  {
    icon: FileDown,
    title: ["Cash Book Exports", "ক্যাশ বহি এক্সপোর্ট"],
    body: [
      "Export the Irrigation Income-Expense Cash Book to PDF, Excel or CSV — every format keeps identical columns and totals, with a Bangla/English toggle.",
      "সেচ আয়-ব্যয় ক্যাশ বহি PDF, Excel বা CSV-তে এক্সপোর্ট করুন — সব ফরম্যাটে একই কলাম ও মোট, বাংলা/English টোগলসহ।",
    ],
    to: "/reports/irrigation-cashbook",
    cta: ["Open Cash Book", "ক্যাশ বহি খুলুন"],
  },
  {
    icon: BookmarkCheck,
    title: ["Saved Filter Presets", "সেভড ফিল্টার প্রিসেট"],
    body: [
      "Save a date range + office as a preset that syncs across your devices, then re-run and export the same ledger period in one click.",
      "তারিখ পরিসর + অফিস প্রিসেট হিসেবে সংরক্ষণ করুন (ডিভাইসজুড়ে সিঙ্ক) এবং এক ক্লিকে একই লেজার পিরিয়ড পুনরায় চালান ও এক্সপোর্ট করুন।",
    ],
    to: "/reports/irrigation-cashbook",
    cta: ["Try Presets", "প্রিসেট দেখুন"],
  },
  {
    icon: Database,
    title: ["Demo Data & Backup", "ডেমো ডাটা ও ব্যাকআপ"],
    body: [
      "Seed Cash Book / Hand Cash demo data, take automatic or scheduled backups before seeding, validate row counts and download a PDF/CSV summary.",
      "Cash Book / Hand Cash ডেমো ডাটা সিড করুন, সিডের আগে স্বয়ংক্রিয় বা নির্ধারিত ব্যাকআপ নিন, রো-কাউন্ট যাচাই করুন ও PDF/CSV সারাংশ নামান।",
    ],
    to: "/admin/quick-seed",
    cta: ["Open Quick Seed", "Quick Seed খুলুন"],
  },
  {
    icon: ScrollText,
    title: ["Audit Logs", "অডিট লগ"],
    body: [
      "Every export and every demo/backup run is logged. Filter the audit logs by user, office, module, date range and format.",
      "প্রতিটি এক্সপোর্ট ও ডেমো/ব্যাকআপ রান লগ হয়। ইউজার, অফিস, মডিউল, তারিখ পরিসর ও ফরম্যাট দিয়ে অডিট লগ ফিল্টার করুন।",
    ],
    to: "/reports/irrigation-cashbook-audit",
    cta: ["Open Audit Log", "অডিট লগ খুলুন"],
  },
];

export function OnboardingWalkthrough() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const i = lang === "bn" ? 1 : 0;
  const tx = (pair: [string, string]) => pair[i];

  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true); } catch { /* ignore */ }
    const relaunch = () => { setStep(0); setOpen(true); };
    window.addEventListener("open-onboarding", relaunch);
    return () => window.removeEventListener("open-onboarding", relaunch);
  }, []);

  const finish = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span>
            <DialogTitle>{tx(s.title)}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm leading-relaxed">{tx(s.body)}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-1">
          {STEPS.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => { finish(); navigate(s.to); }}
        >
          {tx(s.cta)}
        </Button>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            {tx(["Skip", "এড়িয়ে যান"])}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((p) => p - 1)}>
                {tx(["Back", "পূর্ববর্তী"])}
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finish}>{tx(["Done", "সম্পন্ন"])}</Button>
            ) : (
              <Button size="sm" onClick={() => setStep((p) => p + 1)}>{tx(["Next", "পরবর্তী"])}</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
