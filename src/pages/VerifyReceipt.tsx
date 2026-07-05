import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Ban } from "lucide-react";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Lang = "en" | "bn";

const STR = {
  en: {
    title: "Receipt Verification",
    verifying: "Verifying…",
    failed: "Verification failed",
    notFound: "Receipt not found",
    voided: "This receipt has been voided / cancelled",
    rateLimited: "Too many requests. Please wait and try again.",
    network: "Network error",
    genuine: "This receipt is genuine.",
    pending: "This receipt is pending approval.",
    rejected: "This receipt was rejected.",
    company: "Company",
    office: "Office",
    receiptNo: "Receipt No",
    date: "Date",
    type: "Type",
    status: "Status",
    amount: "Amount",
    method: "Method",
    note: "Note",
    farmer: "Farmer",
    name: "Name",
    memberNo: "Member No",
    village: "Village",
    mobile: "Mobile",
    voidedOn: "Voided on",
    retry: "Try again",
  },
  bn: {
    title: "রসিদ যাচাইকরণ",
    verifying: "যাচাই করা হচ্ছে…",
    failed: "যাচাই ব্যর্থ",
    notFound: "রসিদ পাওয়া যায়নি",
    voided: "এই রসিদ বাতিল / void করা হয়েছে",
    rateLimited: "অনেক বেশি অনুরোধ। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    network: "নেটওয়ার্ক ত্রুটি",
    genuine: "এই রসিদটি বৈধ।",
    pending: "এই রসিদ অনুমোদনের অপেক্ষায় আছে।",
    rejected: "এই রসিদ বাতিল হয়েছে।",
    company: "প্রতিষ্ঠান",
    office: "অফিস",
    receiptNo: "রসিদ নং",
    date: "তারিখ",
    type: "ধরন",
    status: "অবস্থা",
    amount: "পরিমাণ",
    method: "মাধ্যম",
    note: "নোট",
    farmer: "ফার্মার",
    name: "নাম",
    memberNo: "সদস্য নং",
    village: "গ্রাম",
    mobile: "মোবাইল",
    voidedOn: "Void করা হয়েছে",
    retry: "আবার চেষ্টা করুন",
  },
} as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function VerifyReceipt() {
  const { token = "" } = useParams();
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem("lang") as Lang) === "bn" ? "bn" : "en"
  );
  const T = STR[lang];

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [voided, setVoided] = useState<{ at: string | null } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  async function verifyLegacy(receiptNo: string) {
    setLoading(true); setError(null); setData(null); setVoided(null); setRateLimited(false);
    try {
      const res = await fetch(`/api/legacy-irrigation/verify/${encodeURIComponent(receiptNo)}`, {
        headers: { Accept: "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError(j?.error || T.notFound);
      } else {
        setData(j);
      }
    } catch {
      setError(T.network);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    // Legacy irrigation receipts are stored in the app's own API DB, not in Cloud.
    if (token.startsWith("legacy-")) {
      return verifyLegacy(token.slice("legacy-".length));
    }
    setLoading(true); setError(null); setData(null); setVoided(null); setRateLimited(false);
    try {
      const res = await fetch(`${FN}/receipt-verify?token=${encodeURIComponent(token)}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setRateLimited(true);
        setError(T.rateLimited);
      } else if (!res.ok || !j?.ok) {
        if (j?.voided) setVoided({ at: j?.voided_at ?? null });
        setError(j?.voided ? T.voided : (j?.error || T.notFound));
      } else {
        setData(j);
      }
    } catch {
      setError(T.network);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = T.title;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { localStorage.setItem("lang", lang); }, [lang]);

  const status = data?.receipt?.status as string | undefined;
  const statusInfo = useMemo(() => {
    if (!status) return null;
    if (status === "approved") return { tone: "ok", icon: CheckCircle2, msg: T.genuine };
    if (status === "pending") return { tone: "warn", icon: AlertTriangle, msg: T.pending };
    if (status === "rejected") return { tone: "bad", icon: Ban, msg: T.rejected };
    return null;
  }, [status, T]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6" />
            <h1 className="text-xl font-semibold">{T.title}</h1>
          </div>
          <div className="flex gap-1 text-xs">
            <Button size="sm" variant={lang === "en" ? "default" : "outline"} className="h-7 px-2" onClick={() => setLang("en")}>EN</Button>
            <Button size="sm" variant={lang === "bn" ? "default" : "outline"} className="h-7 px-2" onClick={() => setLang("bn")}>বাংলা</Button>
          </div>
        </div>

        {loading && (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> {T.verifying}
          </div>
        )}

        {!loading && (error || voided) && (
          <div className="py-8 text-center">
            {voided ? (
              <Ban className="h-12 w-12 text-destructive mx-auto mb-2" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            )}
            <div className="font-semibold">{voided ? T.voided : T.failed}</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
            {voided?.at && (
              <div className="text-xs text-muted-foreground mt-1">
                {T.voidedOn}: {new Date(voided.at).toLocaleString()}
              </div>
            )}
            {rateLimited && (
              <Button size="sm" variant="outline" className="mt-4" onClick={verify}>{T.retry}</Button>
            )}
          </div>
        )}

        {!loading && data && (
          <>
            {statusInfo && (
              <div className={`flex items-center gap-2 mb-4 ${
                statusInfo.tone === "ok" ? "text-success" :
                statusInfo.tone === "warn" ? "text-amber-600" : "text-destructive"
              }`}>
                <statusInfo.icon className="h-5 w-5" />
                <span className="font-medium">{statusInfo.msg}</span>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <Row k={T.company} v={(lang === "bn" ? data.company?.name_bn : data.company?.name) || data.company?.name || data.company?.name_bn || "—"} />
              {data.office && <Row k={T.office} v={data.office} />}
              <Row k={T.receiptNo} v={data.receipt?.receipt_no || "—"} mono />
              <Row k={T.date} v={new Date(data.receipt.date).toLocaleString()} />
              <Row k={T.type} v={String(data.receipt.kind).toUpperCase()} />
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{T.status}</span>
                <Badge variant={status === "approved" ? "default" : status === "pending" ? "secondary" : "destructive"}>
                  {String(data.receipt.status).toUpperCase()}
                </Badge>
              </div>
              <Row k={T.amount} v={`৳ ${fmt(data.receipt.amount)}`} mono />
              {data.receipt.method && <Row k={T.method} v={data.receipt.method} />}
              {data.receipt.note && <Row k={T.note} v={data.receipt.note} />}
              <div className="border-t pt-3 mt-3">
                <div className="text-xs text-muted-foreground mb-1">{T.farmer}</div>
                <Row k={T.name} v={data.farmer?.name || "—"} />
                {data.farmer?.member_no && <Row k={T.memberNo} v={data.farmer.member_no} mono />}
                {data.farmer?.village && <Row k={T.village} v={data.farmer.village} />}
                {data.farmer?.mobile_masked && <Row k={T.mobile} v={data.farmer.mobile_masked} />}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono text-right" : "text-right"}>{v}</span>
    </div>
  );
}
