import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Download, FileText, IdCard, Languages, Search, ExternalLink } from "lucide-react";

type Lang = "bn" | "en";

type Step = { bn: string; en: string; img?: string };
type Module = {
  id: string;
  title: { bn: string; en: string };
  intro: { bn: string; en: string };
  add?: Step[];
  edit?: Step[];
  remove?: Step[];
  extra?: { title: { bn: string; en: string }; steps: Step[] };
};

const MODULES: Module[] = [
  {
    id: "dashboard",
    title: { bn: "১. ড্যাশবোর্ড ও লগইন", en: "1. Dashboard & Login" },
    intro: {
      bn: "লগইন পেজে ইমেইল/পাসওয়ার্ড দিয়ে প্রবেশ করুন। সফল লগইনের পর প্রধান ড্যাশবোর্ডে কালেকশন, বকেয়া ও সাম্প্রতিক কার্যকলাপের সারসংক্ষেপ দেখা যাবে।",
      en: "Sign in with email/password. After login the main dashboard shows collections, dues and recent activity at a glance.",
    },
    add: [
      { bn: "/auth পেজে ইমেইল ও পাসওয়ার্ড দিন।", en: "Open /auth, enter email and password." },
      { bn: "Sign In বোতামে ক্লিক করলে ড্যাশবোর্ডে চলে যাবে।", en: "Click Sign In to land on the dashboard.", img: "01_dashboard_bn.png" },
    ],
  },
  {
    id: "farmers",
    title: { bn: "২. ফার্মার (সদস্য) ব্যবস্থাপনা", en: "2. Farmers (Members)" },
    intro: {
      bn: "ফার্মার মডিউল থেকে নতুন সদস্য যোগ, বিদ্যমান সদস্যের তথ্য আপডেট ও অপ্রয়োজনীয় রেকর্ড ডিলিট করা যায়।",
      en: "Use the Farmers module to add new members, update existing records and remove obsolete ones.",
    },
    add: [
      { bn: "সাইডবার → Members → Farmers এ যান।", en: "Sidebar → Members → Farmers.", img: "02_farmers_list_bn.png" },
      { bn: "উপরের ডানে \"+ Add Farmer\" ক্লিক করুন।", en: "Click \"+ Add Farmer\" at top right." },
      { bn: "নাম, পিতার নাম, NID, মোবাইল, ঠিকানা পূরণ করুন।", en: "Fill name, father's name, NID, mobile, address.", img: "03_farmer_add_dialog.png" },
      { bn: "Save চাপলে নতুন ফার্মার তালিকায় যুক্ত হবে।", en: "Click Save — the new farmer appears in the list." },
    ],
    edit: [
      { bn: "তালিকা থেকে কাঙ্খিত ফার্মারের সারিতে Edit (পেন্সিল) আইকনে ক্লিক করুন।", en: "Click the Edit (pencil) icon on the row." },
      { bn: "ডায়লগে তথ্য পরিবর্তন করে Update চাপুন।", en: "Modify fields in the dialog and click Update.", img: "21_farmer_edit_dialog.png" },
    ],
    remove: [
      { bn: "ফার্মার রো-তে তিন ডট মেনু → Delete নির্বাচন করুন।", en: "Open the row's three-dot menu → Delete." },
      { bn: "নিশ্চিতকরণ ডায়লগে \"হ্যাঁ\" দিন। সফট-ডিলিট হয়ে যাবে।", en: "Confirm in the dialog — record is soft-deleted." },
    ],
  },
  {
    id: "savings",
    title: { bn: "৩. সঞ্চয় (Savings)", en: "3. Savings" },
    intro: {
      bn: "সঞ্চয় মডিউলে সদস্যের জমা/উত্তোলন এন্ট্রি রাখা হয় এবং স্টেটমেন্ট তৈরি করা যায়।",
      en: "Track member deposits/withdrawals and generate statements.",
    },
    add: [
      { bn: "সাইডবার → Savings & Loans → Savings।", en: "Sidebar → Savings & Loans → Savings.", img: "09_savings_bn.png" },
      { bn: "\"+ New Deposit\" বোতাম চাপুন।", en: "Click \"+ New Deposit\"." },
      { bn: "ফার্মার সিলেক্ট, পরিমাণ ও তারিখ দিন।", en: "Pick farmer, enter amount and date.", img: "25_savings_add_dialog.png" },
      { bn: "Save করলে রসিদ তৈরি হবে।", en: "Save to generate a receipt." },
    ],
    edit: [{ bn: "এন্ট্রি রো-তে Edit আইকন → তথ্য পরিবর্তন → Update।", en: "Row Edit icon → modify → Update." }],
    remove: [{ bn: "Edit/অনুমোদিত ব্যবহারকারী রো-র Delete আইকন থেকে মুছে ফেলতে পারবেন।", en: "Authorized user can delete via the row's Delete icon." }],
  },
  {
    id: "loans",
    title: { bn: "৪. ঋণ (Loans)", en: "4. Loans" },
    intro: {
      bn: "ঋণ ইস্যু, কিস্তি আদায়, প্ল্যান নির্ধারণ ও বিলম্ব জরিমানা সবকিছু এই মডিউলে।",
      en: "Issue loans, collect installments, configure plans and late penalties.",
    },
    add: [
      { bn: "সাইডবার → Loans।", en: "Sidebar → Loans.", img: "07_loans_bn.png" },
      { bn: "\"+ New Loan\" চাপুন।", en: "Click \"+ New Loan\"." },
      { bn: "ফার্মার, প্ল্যান, পরিমাণ ও মেয়াদ পূরণ করুন।", en: "Choose farmer, plan, amount and tenure.", img: "24_loan_add_dialog.png" },
      { bn: "Save → Loan ID তৈরি হবে।", en: "Save — a Loan ID is generated." },
    ],
    edit: [{ bn: "Loan তালিকা → কাঙ্ক্ষিত ঋণ → Edit।", en: "Loan list → select loan → Edit." }],
    remove: [{ bn: "শুধু খসড়া (draft) ঋণ ডিলিট হয়; অনুমোদিত ঋণ ক্যান্সেল করতে হবে।", en: "Only draft loans are deletable; approved loans must be cancelled." }],
  },
  {
    id: "irrigation",
    title: { bn: "৫. সেচ ইনভয়েস", en: "5. Irrigation Invoices" },
    intro: {
      bn: "মৌসুম ভিত্তিক সেচ চার্জ তৈরি, ইনভয়েস ইস্যু ও পরিশোধের হিসাব রাখা।",
      en: "Generate season-wise irrigation invoices and track payments.",
    },
    add: [
      { bn: "সাইডবার → Irrigation → Invoices।", en: "Sidebar → Irrigation → Invoices.", img: "30_irrigation_invoices.png" },
      { bn: "\"+ Create Invoice\" → ফার্মার/জমি/মৌসুম নির্বাচন।", en: "\"+ Create Invoice\" → choose farmer/land/season.", img: "31_irrigation_create.png" },
      { bn: "রেট ও পরিমাণ যাচাই করে Save।", en: "Verify rate & amount, then Save." },
    ],
    edit: [{ bn: "ইনভয়েস রো → Edit → পরিবর্তন → Save।", en: "Invoice row → Edit → modify → Save." }],
    remove: [{ bn: "শুধু অপরিশোধিত খসড়া ইনভয়েস ডিলিট সম্ভব।", en: "Only unpaid draft invoices can be deleted." }],
  },
  {
    id: "payments",
    title: { bn: "৬. পেমেন্ট/আদায়", en: "6. Payments / Collections" },
    intro: {
      bn: "নগদ, মোবাইল ব্যাংকিং বা ব্যাংকের মাধ্যমে আদায় এন্ট্রি ও রসিদ ছাপানো।",
      en: "Record cash/MFS/bank collections and print receipts.",
    },
    add: [
      { bn: "সাইডবার → Cash & Payments → Payments।", en: "Sidebar → Cash & Payments → Payments." },
      { bn: "\"+ New Payment\" → ফার্মার, পরিমাণ, কারণ (বকেয়া/সঞ্চয়/ঋণ)।", en: "\"+ New Payment\" → farmer, amount, kind.", img: "26_payments_form.png" },
      { bn: "Save করার পর রসিদ প্রিন্ট/PDF করুন।", en: "After Save, print or export receipt as PDF." },
    ],
  },
  {
    id: "assets",
    title: { bn: "৭. এসেট ব্যবস্থাপনা", en: "7. Asset Management" },
    intro: {
      bn: "অফিসের যন্ত্রপাতি, পাম্প ইত্যাদির রেজিস্ট্রি, স্থানান্তর, মেরামত ও ডিপ্রেসিয়েশন।",
      en: "Manage equipment registry, movements, maintenance and depreciation.",
    },
    add: [
      { bn: "সাইডবার → Assets → Asset Registry।", en: "Sidebar → Assets → Asset Registry.", img: "14_asset_registry.png" },
      { bn: "\"+ Add Asset\" → ক্যাটাগরি, নাম, সিরিয়াল, ক্রয়মূল্য ইত্যাদি।", en: "\"+ Add Asset\" → category, name, serial, cost.", img: "28_asset_add_dialog.png" },
      { bn: "Save → QR কোড স্বয়ংক্রিয়ভাবে তৈরি হবে।", en: "Save — a QR code is generated automatically." },
    ],
    edit: [{ bn: "Asset detail → Edit → পরিবর্তন → Save।", en: "Asset detail → Edit → modify → Save." }],
    remove: [{ bn: "Disposal পেজ থেকে Asset কে \"Disposed\" চিহ্নিত করুন।", en: "Mark asset as Disposed via the Disposal page." }],
  },
  {
    id: "shareCollection",
    title: { bn: "৮. শেয়ার সংগ্রহ", en: "8. Share Collection" },
    intro: {
      bn: "সদস্যের শেয়ার কালেকশন এন্ট্রি ও সমন্বয়।",
      en: "Record member share collections and reconciliations.",
    },
    add: [
      { bn: "সাইডবার → Share Collection।", en: "Sidebar → Share Collection.", img: "08_share_collection_bn.png" },
      { bn: "\"+ New Share\" → ফার্মার, পরিমাণ → Save।", en: "\"+ New Share\" → farmer, amount → Save." },
    ],
  },
  {
    id: "voter",
    title: { bn: "৯. ভোটার তালিকা ও অডিট", en: "9. Voter List & Audit" },
    intro: {
      bn: "যোগ্য ভোটার তালিকা ও পরিবর্তনের ইতিহাস দেখুন।",
      en: "View eligible voter list and change history.",
    },
    add: [
      { bn: "Members → Voter List → তালিকা যাচাই।", en: "Members → Voter List — verify list.", img: "04_voter_list_bn.png" },
      { bn: "Voter Audit → পরিবর্তন/অসঙ্গতি যাচাই।", en: "Voter Audit → review changes.", img: "05_voter_audit_bn.png" },
    ],
  },
  {
    id: "settings",
    title: { bn: "১০. সেটিংস ও কমিটি অডিট", en: "10. Settings & Committee Audit" },
    intro: {
      bn: "অফিস তথ্য, কমিটি, রসিদ টেমপ্লেট ও SMS কনফিগারেশন।",
      en: "Office info, committee, receipt templates and SMS configuration.",
    },
    add: [
      { bn: "সাইডবার → Settings।", en: "Sidebar → Settings." },
      { bn: "Committee ট্যাব → \"Add Member\" → তথ্য → Save।", en: "Committee tab → Add Member → fill → Save." },
    ],
    edit: [{ bn: "সদস্য রো → Edit → আপডেট → Save।", en: "Member row → Edit → update → Save." }],
    remove: [{ bn: "সদস্য রো → Remove। পরিবর্তন কমিটি অডিটে লগ হয়।", en: "Member row → Remove — change is logged in committee audit." }],
  },
  {
    id: "recent",
    title: { bn: "১১. সাম্প্রতিক আপডেট (২০২৬ মে)", en: "11. Recent Updates (May 2026)" },
    intro: {
      bn: "সাম্প্রতিক রিলিজে যুক্ত হওয়া নতুন ফিচার ও ফিক্স — Loan No unique, Hawlat/Bank category, QR receipt verify, draft restore, tab-return refresh fix, ও প্রোফাইল-ইডিট রিটার্ন।",
      en: "New features and fixes in the latest release — Loan No uniqueness, Hawlat/Bank irrigation category, QR receipt verify, draft restore, tab-return refresh fix, and profile-edit return.",
    },
    add: [
      { bn: "Loan No এখন একই অফিসে ইউনিক — duplicate দিলে error দেখাবে।", en: "Loan No is now unique within each office — duplicates show an error." },
      { bn: "Loans পেজে \"Member-wise Loan Summary\" কার্ড নতুন সংযোজন।", en: "New \"Member-wise Loan Summary\" card on the Loans page." },
      { bn: "Irrigation Payment এ Hawlat / Bank / Mobile Banking ক্যাটাগরি যোগ — রসিদে দেখা যাবে।", en: "Hawlat / Bank / Mobile Banking categories added to Irrigation Payment — shown on receipt." },
      { bn: "Combined Payment-এ ফার্মার select করলেই বকেয়া সারাংশ ও Auto-download receipt চেকবক্স পাওয়া যায়।", en: "Selecting a farmer in Combined Payment now shows outstanding summary + Auto-download receipt option." },
      { bn: "প্রতিটি রসিদে QR কোড — স্ক্যান করলে /r/{token} verify পেজ খুলবে (mobile masked)।", en: "Every receipt has a QR — scanning opens /r/{token} verify page (mobile masked)." },
      { bn: "ফার্মার/লোন/পেমেন্ট ফর্মে accidental refresh হলে draft restore toast আসে — Continue / Discard বাটন।", en: "Farmer/Loan/Payment forms now show a draft restore toast after accidental refresh — Continue / Discard." },
      { bn: "অন্য ট্যাবে গিয়ে ফিরে এলে আর পেজ refresh হবে না (window-focus refetch বন্ধ)।", en: "Returning from another browser tab no longer reloads the page (window-focus refetch disabled)." },
      { bn: "ফার্মার প্রোফাইল থেকে Edit করে Save করলে এখন প্রোফাইলেই ফিরবে — list-এ যাবে না।", en: "Editing a farmer from their profile now returns to the profile after Save — not the list." },
      { bn: "Lands ফর্মে village/ward/union ছাড়াই Save করা যায় (validation শিথিল)।", en: "Lands form now saves without village/ward/union (validation relaxed)." },
    ],
  },
];


const REPORTS_GUIDE = {
  bn: {
    intro: "রিপোর্টস মডিউলে যেকোনো রিপোর্ট খুললে উপরের অংশে ফিল্টার বার থাকে। সাধারণ ধাপ:",
    steps: [
      "তারিখ পরিসর (From / To) নির্বাচন করুন।",
      "প্রয়োজনে অফিস / ফার্মার / মৌসুম / ক্যাটাগরি ফিল্টার সেট করুন।",
      "\"Apply\" বা \"Generate\" বোতামে ক্লিক করুন — টেবিলে ফলাফল আসবে।",
      "ডানদিকে \"Export PDF\" বা \"Export Excel\" বোতাম থেকে ফাইল ডাউনলোড করুন।",
    ],
    example: "উদাহরণ: কালেকশন রিপোর্টে গত মাসের তারিখ ও নির্দিষ্ট অফিস দিয়ে Apply করলে নিচে দিনভিত্তিক আদায়ের সারণী এবং সর্বমোট সারিযুক্ত একটি প্রিন্টযোগ্য PDF পাবেন।",
  },
  en: {
    intro: "Every report screen has a filter bar at the top. Common flow:",
    steps: [
      "Pick date range (From / To).",
      "Set office / farmer / season / category filters as needed.",
      "Click Apply or Generate — results load in the table below.",
      "Use Export PDF / Export Excel buttons (top-right) to download.",
    ],
    example: "Example: in the Collection Report, set last month's range and a specific office, click Apply — you get a day-wise table with grand totals and a printable PDF.",
  },
};

export default function Help() {
  const [lang, setLang] = useState<Lang>("bn");
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => MODULES.filter((m) => (m.title[lang] + m.intro[lang]).toLowerCase().includes(q.toLowerCase())),
    [q, lang]
  );

  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{tx("সাহায্য ও ইউজার ম্যানুয়াল", "Help & User Manual")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tx(
              "প্রতিটি মডিউলের জন্য Add / Edit / Delete ধাপ, রিপোর্ট ফিল্টার এবং ফার্মার কার্ড ডাউনলোড করার পদ্ধতি।",
              "Add / Edit / Delete steps for each module, report filters and farmer card download tutorial."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={lang === "bn" ? "default" : "outline"}
            size="sm"
            onClick={() => setLang("bn")}
          >
            <Languages className="h-4 w-4 mr-1" /> বাংলা
          </Button>
          <Button
            variant={lang === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLang("en")}
          >
            <Languages className="h-4 w-4 mr-1" /> English
          </Button>
          <Button asChild size="sm">
            <a href="/help/user-manual-v3.pdf" download>
              <Download className="h-4 w-4 mr-1" /> {tx("PDF ডাউনলোড", "Download PDF")}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/help/user-manual-v3.pdf" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> {tx("PDF দেখুন", "View PDF")}
            </a>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" /> {tx("পূর্ণ ম্যানুয়াল (v3)", "Full Manual (v3)")}
          </CardTitle>
          <CardDescription>
            {tx(
              "১২ টি মডিউল, স্ক্রিনশটসহ স্টেপ-বাই-স্টেপ গাইড। ব্রাউজারে ইনলাইন প্রিভিউ:",
              "12 modules with step-by-step screenshots. Inline browser preview:"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <object
            data="/help/user-manual-v3.pdf#toolbar=1"
            type="application/pdf"
            className="w-full h-[500px] rounded border"
          >
            <p className="text-sm text-muted-foreground p-4">
              {tx("আপনার ব্রাউজার PDF প্রিভিউ সমর্থন করছে না। উপরের ডাউনলোড বোতাম ব্যবহার করুন।",
                "Your browser doesn't support inline PDF preview. Please use the download button above.")}
            </p>
          </object>
        </CardContent>
      </Card>

      <Tabs defaultValue="quick">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="quick">{tx("কুইক গাইড", "Quick Guide")}</TabsTrigger>
          <TabsTrigger value="reports">{tx("রিপোর্ট", "Reports")}</TabsTrigger>
          <TabsTrigger value="card">{tx("ফার্মার কার্ড", "Farmer Card")}</TabsTrigger>
        </TabsList>

        {/* ── QUICK GUIDE ── */}
        <TabsContent value="quick" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={tx("মডিউল খুঁজুন…", "Search modules…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Accordion type="multiple" className="space-y-2">
            {filtered.map((m) => (
              <AccordionItem key={m.id} value={m.id} className="border rounded-lg px-3 bg-card">
                <AccordionTrigger className="text-left">
                  <span className="font-medium">{m.title[lang]}</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{m.intro[lang]}</p>

                  {m.add && (
                    <Section title={tx("যোগ করুন (Add)", "Add")} badge="add" steps={m.add} lang={lang} />
                  )}
                  {m.edit && (
                    <Section title={tx("সম্পাদনা (Edit)", "Edit")} badge="edit" steps={m.edit} lang={lang} />
                  )}
                  {m.remove && (
                    <Section title={tx("মুছে ফেলুন (Delete)", "Delete")} badge="delete" steps={m.remove} lang={lang} />
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ── REPORTS ── */}
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{tx("রিপোর্ট জেনারেট ও ফিল্টার", "Generate & Filter Reports")}</CardTitle>
              <CardDescription>{REPORTS_GUIDE[lang].intro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {REPORTS_GUIDE[lang].steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-medium">{tx("ফিল্টার বারের উদাহরণ", "Filter bar example")}</p>
                <img
                  src="/help/screens/27_reports_filter.png"
                  alt={tx("রিপোর্ট ফিল্টার", "Report filter")}
                  className="rounded border w-full"
                  loading="lazy"
                />
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{tx("উদাহরণ আউটপুট", "Example output")}</p>
                <p className="text-sm text-muted-foreground">{REPORTS_GUIDE[lang].example}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <a href="/help/screens/30_irrigation_invoices.png" target="_blank" rel="noreferrer">
                    <img src="/help/screens/30_irrigation_invoices.png" alt="Invoice example" className="rounded border w-full" loading="lazy" />
                  </a>
                  <a href="/help/screens/17_asset_reports.png" target="_blank" rel="noreferrer">
                    <img src="/help/screens/17_asset_reports.png" alt="Asset report example" className="rounded border w-full" loading="lazy" />
                  </a>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button asChild variant="outline" size="sm"><Link to="/reports">{tx("রিপোর্টস পেজ", "Open Reports")}</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/reports/collections">{tx("কালেকশন রিপোর্ট", "Collection Report")}</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/financial-reports">{tx("আর্থিক রিপোর্ট", "Financial Reports")}</Link></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FARMER CARD shortcut ── */}
        <TabsContent value="card" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><IdCard className="h-5 w-5" /> {tx("ফার্মার কার্ড ডাউনলোড", "Download Farmer Card")}</CardTitle>
              <CardDescription>
                {tx("সংক্ষেপে ধাপ। বিস্তারিত আলাদা টিউটোরিয়াল পৃষ্ঠায় দেখুন।", "Quick steps. Full tutorial on a separate page.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal pl-5 text-sm space-y-1">
                <li>{tx("সাইডবার → Members → Farmers।", "Sidebar → Members → Farmers.")}</li>
                <li>{tx("কাঙ্ক্ষিত ফার্মারের নামে ক্লিক করে Detail পেজে যান।", "Click farmer name to open Detail page.")}</li>
                <li>{tx("\"Membership Card\" বোতামে ক্লিক করুন → প্রিন্ট/PDF সংরক্ষণ।", "Click Membership Card → Print or Save as PDF.")}</li>
              </ol>
              <Button asChild>
                <Link to="/help/farmer-card">{tx("পূর্ণ টিউটোরিয়াল দেখুন", "Open full tutorial")}</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({
  title, badge, steps, lang,
}: { title: string; badge: "add" | "edit" | "delete"; steps: Step[]; lang: Lang }) {
  const variant = badge === "add" ? "default" : badge === "edit" ? "secondary" : "destructive";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={variant as any}>{title}</Badge>
      </div>
      <ol className="list-decimal pl-5 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="space-y-2">
            <span>{s[lang]}</span>
            {s.img && (
              <a href={`/help/screens/${s.img}`} target="_blank" rel="noreferrer" className="block">
                <img
                  src={`/help/screens/${s.img}`}
                  alt=""
                  className="rounded border max-w-full md:max-w-md"
                  loading="lazy"
                />
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
