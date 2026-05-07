import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, Wallet, Coins, HandCoins, Droplets, CalendarClock, AlertTriangle, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useAuth } from "@/auth/AuthProvider";
import { NoOfficeBanner } from "@/components/layout/NoOfficeBanner";
import { SmsProviderStatusCard } from "@/components/dashboard/SmsProviderStatusCard";

interface Stat { label: string; value: string; icon: any; tone?: "default" | "danger" | "warn" | "success" }

export default function Dashboard() {
  const { t } = useLang();
  const { isSuper, isAdmin, officeId } = useAuth();
  const [officeName, setOfficeName] = useState<string>("");
  const [stats, setStats] = useState<Stat[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [topDues, setTopDues] = useState<any[]>([]);
  const [composition, setComposition] = useState<any[]>([]);

  const [votersOnly, setVotersOnly] = useState(false);

  useEffect(() => { document.title = `${t("dashboard")} — ${t("appName")}`; load(); }, [votersOnly]);

  useEffect(() => {
    if (!officeId) { setOfficeName(""); return; }
    supabase.from("offices").select("name").eq("id", officeId).maybeSingle()
      .then(({ data }) => setOfficeName((data as any)?.name ?? ""));
  }, [officeId]);

  const sum = (rows: any[], f: string) => rows.reduce((a, r) => a + Number(r[f] || 0), 0);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    let voterIds: string[] | null = null;
    if (votersOnly) {
      const { data: vf } = await supabase.from("farmers").select("id").eq("is_voter", true).is("deleted_at", null);
      voterIds = (vf ?? []).map((r: any) => r.id);
      if (voterIds.length === 0) voterIds = ["00000000-0000-0000-0000-000000000000"];
    }
    const inV = (q: any) => voterIds ? q.in("farmer_id", voterIds) : q;

    const [farmers, savings, shares, loans, irrigations, payments, pendingW, pendingL] = await Promise.all([
      supabase.from("farmers").select("id,status,is_voter").is("deleted_at", null),
      inV(supabase.from("savings_transactions").select("type,amount,status,farmer_id").is("deleted_at", null)),
      inV(supabase.from("shares").select("balance,farmer_id")),
      inV(supabase.from("loans").select("principal,total_payable,status,farmer_id").is("deleted_at", null)),
      inV(supabase.from("irrigation_charges").select("total,paid_amount,due_amount,farmer_id").is("deleted_at", null)),
      inV(supabase.from("payments").select("amount,kind,created_at,farmer_id,receipt_url,status,farmers(name_en,farmer_code)").is("deleted_at", null).order("created_at", { ascending: false }).limit(8)),
      inV(supabase.from("savings_transactions").select("id,amount,farmer_id,farmers(name_en,farmer_code)").is("deleted_at", null).eq("status", "pending").eq("type", "withdraw")),
      inV(supabase.from("loans").select("id,principal,farmer_id,farmers(name_en,farmer_code)").is("deleted_at", null).eq("status", "pending")),
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
    const monthStart = today.slice(0, 7) + "-01";
    const { data: monthPayAll } = await supabase
      .from("payments").select("amount,created_at").is("deleted_at", null).gte("created_at", monthStart);
    const monthCollect = sum(monthPayAll ?? [], "amount");
    const pendingCount = (pendingW.data?.length ?? 0) + (pendingL.data?.length ?? 0);

    setStats([
      { label: t("totalFarmers"), value: String(farmersData.length), icon: Users },
      { label: t("activeFarmers"), value: String(farmersData.filter(f => f.status === "active").length), icon: UserCheck, tone: "success" },
      { label: t("totalSavings"), value: money(totalSavings), icon: Wallet },
      { label: t("shareBalance"), value: money(sum(sharesData, "balance")), icon: Coins },
      { label: t("totalLoan"), value: money(totalLoan), icon: HandCoins },
      { label: t("totalIrrigationCollection"), value: money(irrCollection), icon: Droplets },
      { label: t("todayCollection"), value: money(todayCollect), icon: CalendarClock, tone: "success" },
      { label: t("thisMonthCollection"), value: money(monthCollect), icon: CalendarClock },
      { label: t("totalDue"), value: money(totalDue), icon: AlertTriangle, tone: "danger" },
      { label: t("pendingApprovals"), value: String(pendingCount), icon: AlertTriangle, tone: pendingCount > 0 ? "warn" : "default" },
    ]);
    setRecent(paymentsData);
    setPending([
      ...((pendingW.data ?? []).map((x: any) => ({ ...x, kind: "withdraw" }))),
      ...((pendingL.data ?? []).map((x: any) => ({ ...x, kind: "loan" }))),
    ]);

    // Trend: last 6 months
    const months: { key: string; label: string; income: number; expense: number; savings: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("en", { month: "short" }),
        income: 0, expense: 0, savings: 0,
      });
    }
    const fromIso = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
    const [pAll, eAll, sAll] = await Promise.all([
      supabase.from("payments").select("amount,created_at").is("deleted_at", null).gte("created_at", fromIso),
      supabase.from("expenses").select("amount,expense_date").is("deleted_at", null).gte("expense_date", fromIso),
      supabase.from("savings_transactions").select("type,amount,txn_date,status").is("deleted_at", null).eq("status", "approved").gte("txn_date", fromIso),
    ]);
    (pAll.data ?? []).forEach((p: any) => {
      const m = months.find(x => x.key === p.created_at.slice(0, 7)); if (m) m.income += Number(p.amount || 0);
    });
    (eAll.data ?? []).forEach((e: any) => {
      const m = months.find(x => x.key === e.expense_date.slice(0, 7)); if (m) m.expense += Number(e.amount || 0);
    });
    (sAll.data ?? []).forEach((s: any) => {
      const m = months.find(x => x.key === s.txn_date.slice(0, 7));
      if (!m) return;
      m.savings += s.type === "deposit" ? Number(s.amount || 0) : -Number(s.amount || 0);
    });
    setTrend(months);

    setComposition([
      { name: t("savings"), value: Math.max(0, totalSavings) },
      { name: t("sharesShort"), value: Math.max(0, sum(sharesData, "balance")) },
      { name: t("loanOutstanding"), value: Math.max(0, totalLoan) },
      { name: t("irrigationDueShort"), value: Math.max(0, sum(irrData, "due_amount")) },
    ]);

    const dueMap = new Map<string, { name: string; code: string; due: number }>();
    const { data: irrDue } = await supabase
      .from("irrigation_charges")
      .select("farmer_id,due_amount,farmers(name_en,farmer_code)")
      .is("deleted_at", null)
      .gt("due_amount", 0);
    (irrDue ?? []).forEach((r: any) => {
      const key = r.farmer_id;
      const cur = dueMap.get(key) ?? { name: r.farmers?.name_en ?? "—", code: r.farmers?.farmer_code ?? "—", due: 0 };
      cur.due += Number(r.due_amount); dueMap.set(key, cur);
    });
    setTopDues(Array.from(dueMap.values()).sort((a, b) => b.due - a.due).slice(0, 5));
  }

  const pieColors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  return (
    <>
      <PageHeader title={t("dashboard")} description={t("appName")} />
      <NoOfficeBanner />
      <div className="mb-3 flex items-center gap-2 text-xs">
        <Badge variant={isSuper ? "secondary" : "default"}>
          {isSuper ? t("viewingAllOffices") : `${t("officeLabel")}: ${officeName || "—"}`}
        </Badge>
        <span className="text-muted-foreground">{t("officeAccessNote")}</span>
      </div>
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

      {(isSuper || isAdmin) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SmsProviderStatusCard />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">{t("incomeVsExpense6mo")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="income" fill="hsl(var(--success))" name={t("income")} />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" name={t("expense")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-3">{t("composition")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={composition} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => e.name}>
                  {composition.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">{t("netSavingsMovement")}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="savings" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-3">{t("top5Dues")}</h2>
          {topDues.length === 0 ? <p className="text-sm text-muted-foreground">{t("noData")}</p> : (
            <div className="divide-y">
              {topDues.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.code}</div>
                  </div>
                  <div className="font-semibold text-destructive">{money(d.due)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
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
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" title={t("viewReceipt")} className="text-primary hover:text-primary/70">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.status === "pending" && <Badge variant="secondary" className="text-[10px]">{t("pendingLower")}</Badge>}
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
