import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function VerifyReceipt() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Verify Receipt";
    (async () => {
      try {
        const res = await fetch(`${FN}/receipt-verify?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) {
          setError(j?.error || "Receipt not found");
        } else {
          setData(j);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center gap-2 mb-4 text-primary">
          <ShieldCheck className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Receipt Verification</h1>
        </div>

        {loading && (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Verifying…
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <div className="font-semibold">Verification failed</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="flex items-center gap-2 text-success mb-4">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">This receipt is genuine.</span>
            </div>

            <div className="space-y-3 text-sm">
              <Row k="Company" v={data.company?.name_bn || data.company?.name || "—"} />
              {data.office && <Row k="Office" v={data.office} />}
              <Row k="Receipt No" v={data.receipt?.receipt_no || "—"} mono />
              <Row k="Date" v={new Date(data.receipt.date).toLocaleString()} />
              <Row k="Type" v={String(data.receipt.kind).toUpperCase()} />
              <Row k="Status" v={String(data.receipt.status).toUpperCase()} />
              <Row k="Amount" v={`৳ ${fmt(data.receipt.amount)}`} mono />
              {data.receipt.method && <Row k="Method" v={data.receipt.method} />}
              {data.receipt.note && <Row k="Note" v={data.receipt.note} />}
              <div className="border-t pt-3 mt-3">
                <div className="text-xs text-muted-foreground mb-1">Farmer</div>
                <Row k="Name" v={data.farmer?.name || "—"} />
                {data.farmer?.member_no && <Row k="Member No" v={data.farmer.member_no} mono />}
                {data.farmer?.village && <Row k="Village" v={data.farmer.village} />}
                {data.farmer?.mobile_masked && <Row k="Mobile" v={data.farmer.mobile_masked} />}
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
