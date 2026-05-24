// Payment reconciliation report (Payments vs Public Payment Intents).
// Highlights mismatches grouped by office, farmer, and season.
// i18n-ignore-file — admin/utility page
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";


const sb = supabase as any;

type Group = {
  key: string;
  label: string;
  paid: number;
  paidCount: number;
  intentTotal: number;
  intentCount: number;
  unmatchedIntents: number; // intents that haven't been processed/linked
  voided: number;
  voidedCount: number;
  delta: number; // paid - intentTotal
};

export default function PaymentReconciliation() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  const [dateFrom, setDateFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<Record<string, any>>({});
  const [seasons, setSeasons] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    try {
      const from = `${dateFrom}T00:00:00.000Z`;
      const to = `${dateTo}T23:59:59.999Z`;
      const [p, i, ip, ofs, ses, fs] = await Promise.all([
        sb.from("payments")
          .select("id,farmer_id,office_id,amount,status,voided_at,created_at,receipt_no,payment_allocations(kind,reference_id,amount)")
          .gte("created_at", from).lte("created_at", to).limit(5000),
        sb.from("public_payment_intents").select("*")
          .gte("created_at", from).lte("created_at", to).limit(5000),
        sb.from("irrigation_invoice_payments").select("payment_id,invoice_id,irrigation_invoices(season_id,office_id)")
          .gte("created_at", from).lte("created_at", to).limit(10000),
        sb.from("offices").select("id,name"),
        sb.from("seasons").select("id,name,year,type"),
        sb.from("farmers").select("id,farmer_code,name_en,name_bn,office_id"),
      ]);
      setPayments(p.data ?? []);
      setIntents(i.data ?? []);
      setInvoices(ip.data ?? []);
      setOffices(Object.fromEntries((ofs.data ?? []).map((o: any) => [o.id, o])));
      setSeasons(Object.fromEntries((ses.data ?? []).map((s: any) => [s.id, s])));
      setFarmers(Object.fromEntries((fs.data ?? []).map((f: any) => [f.id, f])));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { document.title = "Payment Reconciliation"; load(); }, []);

  // Map farmer_code -> farmer for intent lookups
  const farmersByCode = useMemo(() => {
    const m: Record<string, any> = {};
    Object.values(farmers).forEach((f: any) => { if (f.farmer_code) m[f.farmer_code] = f; });
    return m;
  }, [farmers]);

  // Group helper
  function buildGroups(keyFn: (p: any) => string, labelFn: (k: string) => string, intentKeyFn: (i: any) => string): Group[] {
    const map = new Map<string, Group>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { key: k, label: labelFn(k), paid: 0, paidCount: 0, intentTotal: 0, intentCount: 0, unmatchedIntents: 0, voided: 0, voidedCount: 0, delta: 0 });
      return map.get(k)!;
    };
    for (const p of payments) {
      const k = keyFn(p) || "—";
      const g = get(k);
      if (p.voided_at || p.status === "voided") { g.voided += Number(p.amount || 0); g.voidedCount += 1; continue; }
      if (p.status === "approved") { g.paid += Number(p.amount || 0); g.paidCount += 1; }
    }
    for (const i of intents) {
      const k = intentKeyFn(i) || "—";
      const g = get(k);
      g.intentTotal += Number(i.amount || 0);
      g.intentCount += 1;
      if (i.status === "pending") g.unmatchedIntents += 1;
    }
    for (const g of map.values()) g.delta = +(g.paid - g.intentTotal).toFixed(2);
    return Array.from(map.values()).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  // Map payment -> seasons via irrigation_invoice_payments
  const paymentSeasons = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ip of invoices) {
      const sid = (ip as any).irrigation_invoices?.season_id;
      if (!sid) continue;
      if (!m.has(ip.payment_id)) m.set(ip.payment_id, new Set());
      m.get(ip.payment_id)!.add(sid);
    }
    return m;
  }, [invoices]);

  const byOffice = useMemo(() => buildGroups(
    (p) => p.office_id ?? "",
    (k) => offices[k]?.name ?? "(unassigned)",
    (i) => farmersByCode[i.farmer_code]?.office_id ?? "",
  ), [payments, intents, offices, farmersByCode]);

  const byFarmer = useMemo(() => buildGroups(
    (p) => p.farmer_id ?? "",
    (k) => {
      const f = farmers[k];
      return f ? `${f.name_en ?? f.name_bn ?? ""} (${f.farmer_code ?? "—"})` : "—";
    },
    (i) => farmersByCode[i.farmer_code]?.id ?? "",
  ), [payments, intents, farmers, farmersByCode]);

  const bySeason = useMemo(() => {
    // For payments, expand into season rows
    const map = new Map<string, Group>();
    const get = (k: string, label: string) => {
      if (!map.has(k)) map.set(k, { key: k, label, paid: 0, paidCount: 0, intentTotal: 0, intentCount: 0, unmatchedIntents: 0, voided: 0, voidedCount: 0, delta: 0 });
      return map.get(k)!;
    };
    for (const p of payments) {
      const sids = paymentSeasons.get(p.id) ?? new Set<string>();
      const isVoided = p.voided_at || p.status === "voided";
      if (sids.size === 0) {
        const g = get("—", "(no season)");
        if (isVoided) { g.voided += Number(p.amount || 0); g.voidedCount += 1; }
        else if (p.status === "approved") { g.paid += Number(p.amount || 0); g.paidCount += 1; }
        continue;
      }
      for (const sid of sids) {
        const s = seasons[sid];
        const label = s ? (s.name ?? `${s.year} ${s.type}`) : sid.slice(0, 8);
        const g = get(sid, label);
        if (isVoided) { g.voided += Number(p.amount || 0) / sids.size; g.voidedCount += 1; }
        else if (p.status === "approved") { g.paid += Number(p.amount || 0) / sids.size; g.paidCount += 1; }
      }
    }
    // Intents have no season — bucket under "(no season)" for visibility
    const g = get("—", "(no season)");
    for (const i of intents) {
      g.intentTotal += Number(i.amount || 0);
      g.intentCount += 1;
      if (i.status === "pending") g.unmatchedIntents += 1;
    }
    for (const x of map.values()) x.delta = +(x.paid - x.intentTotal).toFixed(2);
    return Array.from(map.values()).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [payments, intents, paymentSeasons, seasons]);

  // Per-intent mismatches: intents without a matching approved payment
  const intentMismatches = useMemo(() => {
    return intents.filter(i => i.status === "pending" || (i.status === "processed" && !i.payment_id));
  }, [intents]);

  const totals = useMemo(() => {
    const approved = payments.filter(p => p.status === "approved" && !p.voided_at);
    const voided = payments.filter(p => p.status === "voided" || p.voided_at);
    return {
      paidSum: approved.reduce((s, p) => s + Number(p.amount || 0), 0),
      paidCount: approved.length,
      voidedSum: voided.reduce((s, p) => s + Number(p.amount || 0), 0),
      voidedCount: voided.length,
      intentSum: intents.reduce((s, i) => s + Number(i.amount || 0), 0),
      intentCount: intents.length,
      unmatched: intentMismatches.length,
    };
  }, [payments, intents, intentMismatches]);

  function exportCsv(rows: Group[], name: string) {
    if (!rows.length) return toast.error("Nothing to export");
    const escape = (v: any) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [
      ["Group", "Paid Total", "Paid Count", "Intent Total", "Intent Count", "Pending Intents", "Voided Total", "Voided Count", "Delta (Paid - Intent)"].join(","),
      ...rows.map(r => [r.label, r.paid.toFixed(2), r.paidCount, r.intentTotal.toFixed(2), r.intentCount, r.unmatchedIntents, r.voided.toFixed(2), r.voidedCount, r.delta.toFixed(2)].map(escape).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `recon-${name}-${dateFrom}-to-${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  const renderTable = (rows: Group[], scope: string) => (
    <Card className="overflow-x-auto">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{rows.length} groups • sorted by |Δ|</span>
        <Button size="sm" variant="outline" onClick={() => exportCsv(rows, scope)}>
          <Download className="h-4 w-4 mr-1" />CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{scope}</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Intent</TableHead>
            <TableHead className="text-right">Pending intents</TableHead>
            <TableHead className="text-right">Voided</TableHead>
            <TableHead className="text-right">Δ (Paid − Intent)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const mismatch = Math.abs(r.delta) > 0.01 || r.unmatchedIntents > 0 || r.voidedCount > 0;
            return (
              <TableRow key={r.key} className={mismatch ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{money(r.paid)} <span className="text-xs text-muted-foreground">({r.paidCount})</span></TableCell>
                <TableCell className="text-right tabular-nums">{money(r.intentTotal)} <span className="text-xs text-muted-foreground">({r.intentCount})</span></TableCell>
                <TableCell className="text-right">
                  {r.unmatchedIntents > 0 ? <Badge variant="destructive">{r.unmatchedIntents}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.voidedCount > 0 ? <Badge variant="outline" className="text-destructive border-destructive">{money(r.voided)} ({r.voidedCount})</Badge> : "—"}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${Math.abs(r.delta) > 0.01 ? "text-destructive" : ""}`}>
                  {r.delta >= 0 ? "+" : ""}{money(r.delta)}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No data in range</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="পেমেন্ট রিকনসিলিয়েশন"
        description="Payments vs public payment intents — অমিল হাইলাইট অফিস / কৃষক / সিজন অনুযায়ী"
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Reload
          </Button>
        }
      />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div className="md:col-span-2 flex items-end"><Button onClick={load} disabled={loading} className="w-full">Apply</Button></div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Approved paid</div><div className="text-lg font-semibold tabular-nums">{money(totals.paidSum)}</div><div className="text-xs text-muted-foreground">{totals.paidCount} payments</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Intent total</div><div className="text-lg font-semibold tabular-nums">{money(totals.intentSum)}</div><div className="text-xs text-muted-foreground">{totals.intentCount} intents</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Voided</div><div className="text-lg font-semibold tabular-nums text-destructive">{money(totals.voidedSum)}</div><div className="text-xs text-muted-foreground">{totals.voidedCount} payments</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Pending / unmatched intents</div><div className="text-lg font-semibold tabular-nums text-destructive">{totals.unmatched}</div></Card>
      </div>

      <Tabs defaultValue="office">
        <TabsList>
          <TabsTrigger value="office">By Office</TabsTrigger>
          <TabsTrigger value="farmer">By Farmer</TabsTrigger>
          <TabsTrigger value="season">By Season</TabsTrigger>
          <TabsTrigger value="intents">Unmatched intents ({intentMismatches.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="office">{renderTable(byOffice, "Office")}</TabsContent>
        <TabsContent value="farmer">{renderTable(byFarmer.slice(0, 200), "Farmer")}</TabsContent>
        <TabsContent value="season">{renderTable(bySeason, "Season")}</TabsContent>
        <TabsContent value="intents">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Farmer Code</TableHead><TableHead>Phone</TableHead>
                <TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {intentMismatches.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{new Date(i.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{i.farmer_code}</TableCell>
                    <TableCell className="text-xs">{i.phone ?? "—"}</TableCell>
                    <TableCell className="text-xs">{i.allocation_hint ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(i.amount)}</TableCell>
                    <TableCell><Badge variant="destructive">{i.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {intentMismatches.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No unmatched intents 🎉</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
