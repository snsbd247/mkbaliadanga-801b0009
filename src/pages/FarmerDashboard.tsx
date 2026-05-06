import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, LogOut, Loader2, Wallet, HandCoins, Droplets, User, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBranding } from "@/lib/branding";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface PortalData {
  farmer: { id: string; name: string; name_en?: string; mobile_masked?: string | null; farmer_code?: string; member_no?: string; village?: string; address?: string; photo_url?: string };
  summary: { savings_balance: number; loan_due: number; irrigation_due: number };
  savings: Array<{ id: string; type: "deposit" | "withdraw"; amount: number; status: string; txn_date: string; note?: string }>;
  loans: Array<{ id: string; principal: number; interest_rate: number; total_payable: number; status: string; issued_on: string; next_due_on?: string; paid: number; due: number; note?: string }>;
  loan_payments: Array<{ id: string; loan_id: string; amount: number; paid_on: string; status: string }>;
  irrigation: Array<{ id: string; entry_date: string; total: number; paid_amount: number; due_amount: number; note?: string }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export default function FarmerDashboard() {
  const nav = useNavigate();
  const brand = useBranding();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  const token = useMemo(() => localStorage.getItem("farmer_portal_token") ?? "", []);
  const expiresAt = useMemo(() => localStorage.getItem("farmer_portal_expires") ?? "", []);

  function logout(reason?: string) {
    localStorage.removeItem("farmer_portal_token");
    localStorage.removeItem("farmer_portal_expires");
    localStorage.removeItem("farmer_portal_name");
    if (reason) toast.error(reason);
    nav("/", { replace: true });
  }

  function isExpired(): boolean {
    if (!expiresAt) return false;
    const t = Date.parse(expiresAt);
    return Number.isFinite(t) && t < Date.now();
  }

  async function load() {
    if (!token) { nav("/", { replace: true }); return; }
    if (isExpired()) { logout(t("p5b_sessionExpiredSignIn")); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FN_BASE}/farmer-portal-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast.error(t("p5b_sessionExpiredSignIn"));
        logout();
        return;
      }
      if (!res.ok) {
        setError(json?.error || t("p5b_failedToLoadData"));
        return;
      }
      setData(json);
    } catch {
      setError(t("p5b_networkError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-surface">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-surface">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6">
            <Alert variant="destructive"><AlertDescription>{error || t("p5b_noData")}</AlertDescription></Alert>
            <div className="mt-4 flex gap-2">
              <Button onClick={load} variant="outline" className="flex-1"><RefreshCw className="h-4 w-4" />{t("p5b_retry")}</Button>
              <Button onClick={() => logout()} className="flex-1">{t("p5b_signOut")}</Button>
            </div>
          </Card>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const f = data.farmer;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-surface">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-gradient-primary text-primary-foreground flex items-center justify-center"><Sprout className="h-4 w-4" /></div>
            )}
            <span className="text-sm font-medium truncate">{t("p5b_farmerPortal")}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            <LogOut className="h-4 w-4" /> {t("p5b_signOut")}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* Profile */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {f.photo_url ? <img src={f.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base truncate">{f.name}</div>
              <div className="text-xs text-muted-foreground">
                {f.farmer_code && <span>ID: {f.farmer_code}</span>}
                {f.member_no && <span className="ml-2">Member: {f.member_no}</span>}
              </div>
              {f.mobile_masked && <div className="text-xs text-muted-foreground">📱 {f.mobile_masked}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard icon={Wallet} label={t("p5b_savingsBalance")} value={data.summary.savings_balance} tone="primary" />
          <SummaryCard icon={HandCoins} label={t("p5b_loanDue")} value={data.summary.loan_due} tone="warning" />
          <SummaryCard icon={Droplets} label={t("p5b_irrigationDue")} value={data.summary.irrigation_due} tone="info" />
        </div>

        <Tabs defaultValue="savings" className="w-full">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="savings">{t("p5b_savings")}</TabsTrigger>
            <TabsTrigger value="loans">{t("p5b_loans")}</TabsTrigger>
            <TabsTrigger value="irrigation">{t("p5b_irrigation")}</TabsTrigger>
          </TabsList>

          <TabsContent value="savings">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("p5b_savingsTransactions")}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead><TableHead>{t("type")}</TableHead>
                      <TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.savings.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">{t("p5b_noTransactions")}</TableCell></TableRow>
                    ) : data.savings.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{s.txn_date}</TableCell>
                        <TableCell><Badge variant={s.type === "deposit" ? "default" : "secondary"}>{s.type}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(s.amount))}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loans" className="space-y-3">
            {data.loans.length === 0 ? (
              <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No loans.</CardContent></Card>
            ) : data.loans.map((l) => (
              <Card key={l.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Loan • {l.issued_on}</CardTitle>
                    <Badge variant={l.status === "paid" ? "secondary" : "default"}>{l.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Principal" value={fmt(Number(l.principal))} />
                    <Stat label="Interest %" value={String(l.interest_rate)} />
                    <Stat label="Total Payable" value={fmt(Number(l.total_payable))} />
                    <Stat label="Paid" value={fmt(Number(l.paid))} />
                  </div>
                  <div className="text-sm">Remaining: <span className="font-semibold font-mono">{fmt(Number(l.due))}</span></div>
                  {data.loan_payments.filter((p) => p.loan_id === l.id).length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {data.loan_payments.filter((p) => p.loan_id === l.id).map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.paid_on}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(Number(p.amount))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="irrigation">
            <Card>
              <CardHeader><CardTitle className="text-base">Irrigation Charges</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.irrigation.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No charges.</TableCell></TableRow>
                    ) : data.irrigation.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="whitespace-nowrap">{i.entry_date}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(i.total))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(i.paid_amount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(i.due_amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[11px] text-muted-foreground py-4">
          Session is valid for 2 hours. Sign out when finished on a shared device.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary" | "warning" | "info" }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "warning" ? "text-orange-600" : "text-blue-600";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${toneClass}`} />{label}</div>
        <div className={`mt-1 text-2xl font-semibold font-mono ${toneClass}`}>{fmt(value)}</div>
      </CardContent>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (<div><div className="text-muted-foreground">{label}</div><div className="font-mono font-medium">{value}</div></div>);
}
