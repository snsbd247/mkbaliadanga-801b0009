import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

/**
 * Admin diagnostic: how many irrigation invoices still have a NULL/empty
 * invoice_status (which would otherwise be at risk of being hidden by
 * server-side filters). After the backfill migration this should be 0.
 */
export function InvoiceStatusCheckCard() {
  const { lang } = useLang();
  const tx = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const [loading, setLoading] = useState(true);
  const [nullCount, setNullCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const [nullRes, totalRes] = await Promise.all([
        db.from("irrigation_invoices").select("id", { count: "exact", head: true }).is("invoice_status", null),
        db.from("irrigation_invoices").select("id", { count: "exact", head: true }).is("deleted_at", null),
      ]);
      if (nullRes.error) throw nullRes.error;
      setNullCount(nullRes.count ?? 0);
      setTotal(totalRes.count ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "check failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  const ok = nullCount === 0;

  return (
    <Card data-testid="invoice-status-check-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{tx("Invoice status backfill", "ইনভয়েস স্ট্যাটাস ব্যাকফিল")}</CardTitle>
        <Button variant="outline" size="sm" onClick={check} disabled={loading} aria-label={tx("Re-check", "পুনরায় যাচাই")}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Badge variant="secondary" className="gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {tx("Checking…", "যাচাই হচ্ছে…")}</Badge>
        ) : error ? (
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {error}</Badge>
        ) : (
          <div className="flex items-center gap-2" data-testid="invoice-status-null-count" data-null-count={nullCount ?? ""}>
            {ok ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {tx("All invoices have a status", "সব ইনভয়েসে স্ট্যাটাস আছে")}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {nullCount} {tx("invoice(s) missing status", "টি ইনভয়েসে স্ট্যাটাস নেই")}
              </Badge>
            )}
          </div>
        )}
        {!loading && !error && (
          <p className="text-xs text-muted-foreground">
            {tx(
              `${nullCount ?? 0} of ${total ?? 0} active invoices have no status. Backfill sets these to "generated".`,
              `${total ?? 0} টি সক্রিয় ইনভয়েসের মধ্যে ${nullCount ?? 0} টির স্ট্যাটাস নেই। ব্যাকফিল এগুলোকে "generated" করে।`,
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
