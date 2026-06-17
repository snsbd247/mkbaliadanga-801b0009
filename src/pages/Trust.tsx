import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Lock,
  Database,
  Users,
  FileText,
  Mail,
  Languages,
  ArrowLeft,
} from "lucide-react";

type Lang = "bn" | "en";

type Section = {
  icon: typeof ShieldCheck;
  title: { bn: string; en: string };
  points: { bn: string; en: string }[];
};

const APP_NAME = { bn: "এমকে বালিয়াডাঙ্গা ব্যবস্থাপনা সফটওয়্যার", en: "MK Baliadanga Management Software" };
const SECURITY_CONTACT = "support@syncsolutionbd.com";

const SECTIONS: Section[] = [
  {
    icon: Lock,
    title: { bn: "অ্যাক্সেস ও অথেন্টিকেশন", en: "Access & Authentication" },
    points: [
      {
        bn: "ব্যবহারকারীরা ইমেইল ও পাসওয়ার্ড দিয়ে নিরাপদে লগইন করেন; সেশন টোকেন নিরাপদভাবে পরিচালিত হয়।",
        en: "Users sign in securely with email and password; session tokens are managed safely.",
      },
      {
        bn: "ভূমিকা-ভিত্তিক অ্যাক্সেস (developer, super admin, admin, committee, staff) ব্যবহার করে কাজের অনুমতি নিয়ন্ত্রণ করা হয়।",
        en: "Role-based access (developer, super admin, admin, committee, staff) controls what each user can do.",
      },
    ],
  },
  {
    icon: Database,
    title: { bn: "ডেটা সুরক্ষা ও অফিস বিচ্ছিন্নতা", en: "Data Protection & Office Isolation" },
    points: [
      {
        bn: "ডেটাবেস সারি-স্তরের নিরাপত্তা (Row-Level Security) দিয়ে সুরক্ষিত, তাই ব্যবহারকারীরা শুধু তাদের নিজের অফিসের তথ্য দেখতে ও সম্পাদনা করতে পারেন।",
        en: "The database is protected with Row-Level Security, so users can only view and edit data belonging to their own office.",
      },
      {
        bn: "ব্যাকআপ ও পুনরুদ্ধারের সুবিধা শুধুমাত্র অনুমোদিত ডেভেলপার ভূমিকার জন্য সীমাবদ্ধ।",
        en: "Backup and restore tools are restricted to authorized developer roles only.",
      },
    ],
  },
  {
    icon: FileText,
    title: { bn: "অডিট ও জবাবদিহিতা", en: "Audit & Accountability" },
    points: [
      {
        bn: "সংবেদনশীল কাজ (রিসিট, রপ্তানি, ডেমো ডেটা অপারেশন) অডিট লগে রেকর্ড করা হয়।",
        en: "Sensitive actions (receipts, exports, demo data operations) are recorded in audit logs.",
      },
      {
        bn: "ক্যাশ বুক রপ্তানি অডিট ব্যবহারকারী, অফিস, তারিখ ও ফরম্যাট অনুযায়ী ট্র্যাক করা হয়।",
        en: "Cash book export audits are tracked by user, office, date and format.",
      },
    ],
  },
  {
    icon: Users,
    title: { bn: "ডেটা সংগ্রহ ও ব্যবহার", en: "Data Collection & Use" },
    points: [
      {
        bn: "শুধুমাত্র সমিতি পরিচালনার জন্য প্রয়োজনীয় তথ্য সংগ্রহ করা হয় এবং অভ্যন্তরীণভাবে ব্যবহৃত হয়।",
        en: "Only data needed to operate the cooperative is collected and used internally.",
      },
      {
        bn: "ডেটা তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।",
        en: "Data is not sold to third parties.",
      },
    ],
  },
];

export default function Trust() {
  const [lang, setLang] = useState<Lang>("bn");
  const t = (o: { bn: string; en: string }) => o[lang];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {lang === "bn" ? "ফিরে যান" : "Back"}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang((p) => (p === "bn" ? "en" : "bn"))}
          >
            <Languages className="mr-1 h-4 w-4" />
            {lang === "bn" ? "English" : "বাংলা"}
          </Button>
        </div>

        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <span className="rounded-full bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-8 w-8" />
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {lang === "bn" ? "নিরাপত্তা ও গোপনীয়তা" : "Security & Privacy"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "bn"
              ? `এই পৃষ্ঠাটি ${APP_NAME.bn} সম্পর্কে সাধারণ নিরাপত্তা ও গোপনীয়তা প্রশ্নের উত্তর দিতে অ্যাপ মালিক দ্বারা পরিচালিত হয়।`
              : `This page is maintained by the app owner to answer common security and privacy questions about ${APP_NAME.en}.`}
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <Card key={s.title.en}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <s.icon className="h-5 w-5 text-primary" />
                  {t(s.title)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {s.points.map((p, i) => (
                    <li key={i}>{t(p)}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                {lang === "bn" ? "নিরাপত্তা যোগাযোগ" : "Security Contact"}
              </CardTitle>
              <CardDescription>
                {lang === "bn"
                  ? "নিরাপত্তা সংক্রান্ত উদ্বেগ বা দুর্বলতা রিপোর্ট করতে যোগাযোগ করুন।"
                  : "Contact us to report a security concern or vulnerability."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={`mailto:${SECURITY_CONTACT}`}
                className="text-sm font-medium text-primary underline"
              >
                {SECURITY_CONTACT}
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 rounded-lg border border-dashed p-4">
          <Badge variant="secondary" className="mb-2">
            {lang === "bn" ? "দ্রষ্টব্য" : "Note"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {lang === "bn"
              ? "এই পৃষ্ঠাটি অ্যাপ মালিক দ্বারা পরিচালিত সম্পাদনাযোগ্য বিষয়বস্তু এবং স্বাধীনভাবে যাচাইকৃত বা সার্টিফায়েড নয়। অ্যান্ডারলাইং প্ল্যাটফর্ম সুবিধা ও অ্যাপ মালিকের অনুশীলনের মধ্যে দায়িত্ব ভাগাভাগি করা হয়।"
              : "This page is app-owned editable content and is not independently verified or certified. Responsibility is shared between underlying platform features and the app owner's own practices."}
          </p>
        </div>
      </div>
    </div>
  );
}
