import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

type DupKey = `${string}|${string}|${string}`; // kind|date|receipt_no

interface RawPayment {
  id: string;
  receipt_no: string | null;
  kind: string | null;
  amount: number | null;
  created_at: string;
  farmer_id: string | null;
  farmers?: { name_en?: string | null; member_no?: string | null } | null;
}

interface DuplicateGroup {
  key: DupKey;
  kind: string;
  date: string;
  receipt_no: string;
  rows: RawPayment[];
}

const KINDS = ["all", "irrigation", "savings", "loan"] as const;

export default function DuplicateReceiptAudit() {
  const [days, setDays] = useState<number>(90);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RawPayment[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        let q = supabase
          .from("payments")
          .select("id, receipt_no, kind, amount, created_at, farmer_id, farmers(name_en, member_no)")
          .gte("created_at", since)
          .not("receipt_no", "is", null)
          .order("created_at", { ascending: false })
          .limit(10000);
        if (kind !== "all") q = q.eq("kind", kind);
        const { data: rows } = await q;
        if (!cancelled) setData((rows ?? []) as any);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days, kind, refreshTick]);

  const groups = useMemo<DuplicateGroup[]>(() => {
    const map = new Map<DupKey, DuplicateGroup>();
    for (const p of data) {
      if (!p.receipt_no) continue;
      const day = String(p.created_at).slice(0, 10);
      const k = `${p.kind ?? ""}|${day}|${p.receipt_no}` as DupKey;
      const cur = map.get(k);
      if (cur) cur.rows.push(p);
      else map.set(k, { key: k, kind: p.kind ?? "", date: day, receipt_no: p.receipt_no, rows: [p] });
    }
    const dups = Array.from(map.values()).filter((g) => g.rows.length > 1);
    const term = search.trim().toLowerCase();
    const filtered = term
      ? dups.filter((g) => g.receipt_no.toLowerCase().includes(term) || g.kind.toLowerCase().includes(term) || g.date.includes(term))
      : dups;
    return filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [data, search]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Duplicate receipt audit"
        description="Receipts that share the same number within the same kind and day."
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshTick((t) => t + 1)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        }
      />

      <Card className="p-3 grid sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Window</label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Kind</label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Search receipt no / date</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. IRR-20260506 or 2026-05-06" />
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          {loading ? "Scanning…" : "No duplicates found in the selected window."}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-3 py-2 border-b bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {groups.length} duplicate group{groups.length === 1 ? "" : "s"} detected. Click a row to expand.
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const isOpen = !!open[g.key];
                return (
                  <>
                    <TableRow key={g.key} className="cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell><Badge variant="secondary">{g.kind || "—"}</Badge></TableCell>
                      <TableCell>{g.date}</TableCell>
                      <TableCell className="font-mono">{g.receipt_no}</TableCell>
                      <TableCell className="text-right"><Badge variant="destructive">×{g.rows.length}</Badge></TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={g.key + ":exp"} className="bg-muted/40">
                        <TableCell></TableCell>
                        <TableCell colSpan={4}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Created at</TableHead>
                                <TableHead>Payment ID</TableHead>
                                <TableHead>Farmer</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.rows.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                                  <TableCell>
                                    {r.farmer_id ? (
                                      <Link to={`/farmers/${r.farmer_id}`} className="text-primary hover:underline">
                                        {r.farmers?.name_en ?? r.farmer_id}
                                        {r.farmers?.member_no ? ` (${r.farmers.member_no})` : ""}
                                      </Link>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">{Number(r.amount ?? 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
