import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

type Inv = any;

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

function fmt(v: any) {
  if (typeof v !== "number") return v;
  return money(v);
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
};

export default function IrrigationReportCharts({ rows }: { rows: Inv[] }) {
  const { t } = useLang();

  const bySeason = useMemo(() => {
    const m = new Map<string, { name: string; payable: number; paid: number; due: number }>();
    for (const r of rows) {
      const name = `${r.seasons?.name ?? r.seasons?.type ?? "—"} ${r.seasons?.year ?? ""}`.trim();
      const cur = m.get(name) ?? { name, payable: 0, paid: 0, due: 0 };
      cur.payable += Number(r.payable_amount || 0);
      cur.paid += Number(r.paid_amount || 0);
      cur.due += Number(r.due_amount || 0);
      m.set(name, cur);
    }
    return [...m.values()].sort((a, b) => b.payable - a.payable).slice(0, 12);
  }, [rows]);

  const byLandType = useMemo(() => {
    const m = new Map<string, { name: string; payable: number; paid: number; due: number }>();
    for (const r of rows) {
      const name = r.land_type_name || t("irr_unknown" as any);
      const cur = m.get(name) ?? { name, payable: 0, paid: 0, due: 0 };
      cur.payable += Number(r.payable_amount || 0);
      cur.paid += Number(r.paid_amount || 0);
      cur.due += Number(r.due_amount || 0);
      m.set(name, cur);
    }
    return [...m.values()].sort((a, b) => b.payable - a.payable);
  }, [rows, t]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; invoiced: number; collected: number }>();
    for (const r of rows) {
      const d = r.generated_at ? new Date(r.generated_at) : r.created_at ? new Date(r.created_at) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(key) ?? { month: key, invoiced: 0, collected: 0 };
      cur.invoiced += Number(r.payable_amount || 0);
      cur.collected += Number(r.paid_amount || 0);
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [rows]);

  const overdueAging = useMemo(() => {
    const today = Date.now();
    const labels = [
      t("irr_aging_0_30" as any),
      t("irr_aging_31_60" as any),
      t("irr_aging_61_90" as any),
      t("irr_aging_90_plus" as any),
    ];
    const buckets: Record<string, number> = { [labels[0]]: 0, [labels[1]]: 0, [labels[2]]: 0, [labels[3]]: 0 };
    for (const r of rows) {
      const due = Number(r.due_amount || 0);
      if (due <= 0 || !r.due_date) continue;
      const days = Math.floor((today - new Date(r.due_date).getTime()) / 86400000);
      if (days <= 0) continue;
      if (days <= 30) buckets[labels[0]] += due;
      else if (days <= 60) buckets[labels[1]] += due;
      else if (days <= 90) buckets[labels[2]] += due;
      else buckets[labels[3]] += due;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [rows, t]);

  const totalOverdue = overdueAging.reduce((s, b) => s + b.value, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-sm">{t("irr_chartTitleSeasonCollection" as any)}</h3>
          {bySeason.length === 0 ? (
            <EmptyChart text={t("irr_chartNoData" as any)} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySeason}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="paid" stackId="a" name={t("irr_chartLegendPaid" as any)} fill="hsl(var(--primary))" />
                <Bar dataKey="due" stackId="a" name={t("irr_chartLegendDue" as any)} fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-sm">{t("irr_chartTitleLandTypeCompare" as any)}</h3>
          {byLandType.length === 0 ? (
            <EmptyChart text={t("irr_chartNoData" as any)} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byLandType}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="payable" name={t("irr_chartLegendPayable" as any)} fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="paid" name={t("irr_chartLegendPaid" as any)} fill="hsl(var(--primary))" />
                <Bar dataKey="due" name={t("irr_chartLegendDue" as any)} fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-sm">{t("irr_chartTitleMonthly" as any)}</h3>
          {byMonth.length === 0 ? (
            <EmptyChart text={t("irr_chartNoData" as any)} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="invoiced" name={t("irr_chartLegendInvoiced" as any)} stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collected" name={t("irr_chartLegendCollected" as any)} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-sm">{t("irr_chartTitleAging" as any)} ({money(totalOverdue)})</h3>
          {totalOverdue === 0 ? (
            <EmptyChart text={t("irr_chartNoOverdue" as any)} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={overdueAging.filter((b) => b.value > 0)} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {overdueAging.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart({ text }: { text?: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
