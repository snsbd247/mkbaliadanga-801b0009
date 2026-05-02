import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, Wallet, Coins, HandCoins, Droplets, CalendarClock, AlertTriangle, FileText } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface Stat { label: string; value: string; icon: any; tone?: "default" | "danger" | "warn" | "success" }

export default function Dashboard() {
  const { t } = useLang();
  const [stats, setStats] = useState<Stat[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [topDues, setTopDues] = useState<any[]>([]);
  const [composition, setComposition] = useState<any[]>([]);

  useEffect(() => { document.title = `${t("dashboard")} — ${t("appName")}`; load(); }, []);

  const sum = (rows: any[], f: string) => rows.reduce((a, r) => a + Number(r[f] || 0), 0);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const [farmers, savings, shares, loans, irrigations, payments, pendingW, pendingL] = await Promise.all([
      supabase.from("farmers").select("id,status"),
      supabase.from("savings_transactions").select("type,amount,status"),
      supabase.from("shares").select("balance"),
      supabase.from("loans").select("principal,total_payable,status"),
      supabase.from("irrigation_charges").select("total,paid_amount,due_amount"),
      supabase.from("payments").select("amount,kind,created_at,farmer_id,receipt_url,status,farmers(name_en,farmer_code)").order("created_at", { ascending: false }).limit(8),
      supabase.from("savings_transactions").select("id,amount,farmer_id,farmers(name_en,farmer_code)").eq("status", "pending").eq("type", "withdraw"),
      supabase.from("loans").select("id,principal,farmer_id,farmers(name_en,farmer_code)").eq("status", "pending"),
    ]);

    const farmersData = farmers.data ?? [];
    const savingsData = savings.data ?? [];
    const sharesData = shares.data ?? [];
    const loansData = loans.data ?? [];
    const irrData = irrigations.data ?? [];
    const paymentsData = payments.data ?? [];

    const totalSavings = sum(savingsData.filter(s => s.status === "approved" && s.type === "deposit"), "amount") -
                         sum(savingsData.filter(s => s.status === "approved" && s.type === "withdraw"), "amount");
    const totalLoan = sum(loansData.filter(l => l.status === "approved"), "total_payable");
    const irrCollection = sum(irrData, "paid_amount");
    const totalDue = sum(irrData, "due_amount") + sum(loansData.filter(l => l.status === "approved"), "total_payable");
    const todayCollect = sum(paymentsData.filter(p => p.created_at?.slice(0, 10) === today), "amount");

    setStats([
      { label: t("totalFarmers"), value: String(farmersData.length), icon: Users },
      { label: t("activeFarmers"), value: String(farmersData.filter(f => f.status === "active").length), icon: UserCheck, tone: "success" },
      { label: t("totalSavings"), value: money(totalSavings), icon: Wallet },
      { label: t("shareBalance"), value: money(sum(sharesData, "balance")), icon: Coins },
      { label: t("totalLoan"), value: money(totalLoan), icon: HandCoins },
      { label: t("totalIrrigationCollection"), value: money(irrCollection), icon: Droplets },
      { label: t("todayCollection"), value: money(todayCollect), icon: CalendarClock, tone: "success" },
      { label: t("totalDue"), value: money(totalDue), icon: AlertTriangle, tone: "danger" },
    ]);
    setRecent(paymentsData);
    setPending([
      ...((pendingW.data ?? []).map((x: any) => ({ ...x, kind: "withdraw" }))),
      ...((pendingL.data ?? []).map((x: any) => ({ ...x, kind: "loan" }))),
    ]);
  }

  return (
    <>
      <PageHeader title={t("dashboard")} description={t("appName")} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className={`mt-2 text-2xl font-bold ${s.tone === "danger" ? "text-destructive" : s.tone === "success" ? "text-success" : "text-foreground"}`}>{s.value}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-md ${s.tone === "danger" ? "bg-destructive/10 text-destructive" : s.tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">{t("recentTransactions")}</h2>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">{t("noData")}</p> : (
            <div className="divide-y">
              {recent.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {p.farmers?.name_en} <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span>
                      {p.receipt_url && (
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" title="View receipt" className="text-primary hover:text-primary/70">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.status === "pending" && <Badge variant="secondary" className="text-[10px]">pending</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.kind} • {fmtDate(p.created_at)}</div>
                  </div>
                  <div className="font-semibold text-success">{money(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">{t("pendingApprovals")}</h2>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">{t("noData")}</p> : (
            <div className="divide-y">
              {pending.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{p.farmers?.name_en} <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span></div>
                    <Badge variant="outline" className="mt-1 text-[10px]">{p.kind === "loan" ? t("loans") : t("withdraw")}</Badge>
                  </div>
                  <div className="font-semibold text-warning">{money(p.amount ?? p.principal)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
