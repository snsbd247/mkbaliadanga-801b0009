import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { Lock, Unlock, RefreshCw, FileDown, Eye } from "lucide-react";
import { ViewButton } from "@/components/ui/action-icon-button";
import { useAuth } from "@/auth/AuthProvider";
import { exportTablePDF } from "@/lib/exports";
import { getFiscalStartMonth, listFiscalYears, monthRange, quarterRange } from "@/lib/accounting";
import { useLang } from "@/i18n/LanguageProvider";

type Period = {
  id: string;
  period_start: string;
  period_end: string;
  status: "open" | "closed";
  closed_at: string | null;
  office_id: string | null;
  total_debit: number;
  total_credit: number;
  total_income: number;
  total_expense: number;
  net_income: number;
  cash_in: number;
  cash_out: number;
  closing_balance_snapshot: any;
  note: string | null;
};

type Office = { id: string; name: string };

const NONE = "__none__";

export default function PeriodClose() {
  const { t } = useLang();
  const { isSuper } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [fyMonth, setFyMonth] = useState(7);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [officeId, setOfficeId] = useState<string>(NONE);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: o }, m] = await Promise.all([
      db.from("accounting_periods").select("*").order("period_end", { ascending: false }),
      db.from("offices").select("id,name").order("name"),
      getFiscalStartMonth(),
    ]);
    setPeriods((p as Period[]) || []);
    setOffices((o as Office[]) || []);
    setFyMonth(m);
  };

  useEffect(() => { load(); }, []);

  const fyOptions = useMemo(() => listFiscalYears(fyMonth, 4), [fyMonth]);
  const officeMap = useMemo(() => Object.fromEntries(offices.map((o) => [o.id, o.name])), [offices]);

  const presetFY = (idx: number) => {
    const fy = fyOptions[idx];
    if (fy) { setFrom(fy.range.from); setTo(fy.range.to); }
  };
  const presetMonth = (off: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + off);
    const r = monthRange(d.getFullYear(), d.getMonth() + 1);
    setFrom(r.from); setTo(r.to);
  };
  const presetQuarter = () => {
    const d = new Date();
    const q = Math.floor(d.getMonth() / 3) + 1;
    const r = quarterRange(d.getFullYear(), q);
    setFrom(r.from); setTo(r.to);
  };

  const runPreview = async () => {
    if (!from || !to) { toast.error(t("periodStartEndRequired")); return; }
    setBusy(true);
    const { data, error } = await db.rpc("compute_period_summary", {
      _from: from, _to: to, _office: officeId === NONE ? null : officeId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPreview(Array.isArray(data) ? data[0] : data);
  };

  const closePeriod = async () => {
    if (!from || !to) { toast.error(t("periodStartEndRequired")); return; }
    setBusy(true);
    const { error } = await db.rpc("close_accounting_period", {
      _from: from, _to: to,
      _office: officeId === NONE ? null : officeId,
      _note: note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("periodClosedToast"));
    setNote("");
    setPreview(null);
    await load();
  };

  const reopen = async (id: string) => {
    if (!isSuper) { toast.error(t("onlySuperReopen")); return; }
    const { error } = await db.rpc("reopen_accounting_period", { _id: id });
    if (error) { toast.error(error.message); return; }
    toast.success(t("periodReopenedToast"));
    await load();
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("periodClose")}
        description={t("periodCloseDesc")}
      />

      <Card>
        <CardHeader><CardTitle className="text-lg">{t("newPeriodClose")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => presetMonth(-1)}>{t("lastMonth")}</Button>
            <Button variant="outline" size="sm" onClick={() => presetMonth(0)}>{t("thisMonth")}</Button>
            <Button variant="outline" size="sm" onClick={presetQuarter}>{t("thisQuarter")}</Button>
            {fyOptions.slice(0, 2).map((fy, i) => (
              <Button key={fy.label} variant="outline" size="sm" onClick={() => presetFY(i)}>{t("fyPrefix")} {fy.label}</Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>{t("from")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>{t("to")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label>{t("officeOptional")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("globalAllOffices")}</SelectItem>
                  {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1 flex items-end gap-2">
              <Button variant="outline" onClick={runPreview} disabled={busy}>
                <RefreshCw className="mr-1 h-4 w-4" /> {t("previewLabel")}
              </Button>
            </div>
          </div>
          <div>
            <Label>{t("note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} rows={2} />
          </div>

          {preview && (
            <Card className="bg-muted/40">
              <CardContent className="pt-6 grid gap-2 md:grid-cols-4 text-sm">
                <Stat label={t("totalDebit")} value={preview.total_debit} />
                <Stat label={t("totalCredit")} value={preview.total_credit} />
                <Stat label={`${t("total")} ${t("income")}`} value={preview.total_income} positive />
                <Stat label={`${t("total")} ${t("expense")}`} value={preview.total_expense} />
                <Stat label={t("netIncome")} value={preview.net_income} positive={preview.net_income >= 0} />
                <Stat label={t("cashIn")} value={preview.cash_in} positive />
                <Stat label={t("cashOut")} value={preview.cash_out} />
                <div className="md:col-span-1 flex items-center justify-end">
                  <Button onClick={closePeriod} disabled={busy}>
                    <Lock className="mr-1 h-4 w-4" /> {t("closePeriod")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <DayCloseCard officeId={officeId === NONE ? null : officeId} />



      <Card>
        <CardHeader><CardTitle className="text-lg">{t("closedPeriods")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("office")}</TableHead>
                <TableHead className="text-right">{t("income")}</TableHead>
                <TableHead className="text-right">{t("expense")}</TableHead>
                <TableHead className="text-right">{t("net")}</TableHead>
                <TableHead className="text-right">{t("cashIn")}</TableHead>
                <TableHead className="text-right">{t("cashOut")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{t("noPeriodsYet")}</TableCell></TableRow>
              )}
              {periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</TableCell>
                  <TableCell>{p.office_id ? officeMap[p.office_id] || "—" : <span className="text-muted-foreground">{t("global")}</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.total_income)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.total_expense)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${p.net_income >= 0 ? "text-primary" : "text-destructive"}`}>{money(p.net_income)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.cash_in)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.cash_out)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "closed" ? "secondary" : "outline"}>
                      {p.status === "closed" ? t("closedStatus") : t("openStatus")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <SnapshotDialog period={p} t={t} />
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        title={t("exportSnapshotPDF")}
                        onClick={() => exportSnapshotPDF(p)}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {isSuper && p.status === "closed" && (
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          title={t("reopenPeriod")}
                          onClick={() => reopen(p.id)}
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${positive ? "text-primary" : ""}`}>{money(Number(value) || 0)}</div>
    </div>
  );
}

function SnapshotDialog({ period, t }: { period: Period; t: (k: any) => string }) {
  const snap = (period.closing_balance_snapshot as any[]) || [];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <ViewButton title={t("viewSnapshot")} />
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("snapshotTitle")} — {fmtDate(period.period_start)} → {fmtDate(period.period_end)}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead>{t("typeLabel")}</TableHead>
                <TableHead className="text-right">{t("debitWord")}</TableHead>
                <TableHead className="text-right">{t("creditWord")}</TableHead>
                <TableHead className="text-right">{t("closingWord")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snap.map((r: any) => (
                <TableRow key={r.account_id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground text-xs">{r.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(r.debit) || 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(r.credit) || 0)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(Number(r.closing) || 0)}</TableCell>
                </TableRow>
              ))}
              {snap.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noSnapshotRows")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          {period.note && <p className="text-sm text-muted-foreground mr-auto">{period.note}</p>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportSnapshotPDF(p: Period) {
  const snap = (p.closing_balance_snapshot as any[]) || [];
  exportTablePDF(
    "Period Snapshot",
    ["Code", "Account", "Type", "Debit", "Credit", "Closing"],
    [
      ...snap.map((r) => [r.code, r.name, r.type, money(Number(r.debit) || 0), money(Number(r.credit) || 0), money(Number(r.closing) || 0)]),
      ["", "Total Income", "", "", money(p.total_income), ""],
      ["", "Total Expense", "", money(p.total_expense), "", ""],
      ["", "Net Income", "", "", "", money(p.net_income)],
    ],
    { from: p.period_start, to: p.period_end },
  );
}
