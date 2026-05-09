import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Wallet, ArrowUpDown } from "lucide-react";

type Inv = any;
type SortKey = "due_date" | "payable_amount" | "due_amount" | "paid_amount" | "invoice_status" | "generated_at";

export default function IrrigationInvoicesTab({ farmerId }: { farmerId: string }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    supabase
      .from("irrigation_invoices" as any)
      .select("*, seasons(name,year,type), lands(dag_no,mouza,land_size)")
      .eq("farmer_id", farmerId)
      .is("deleted_at", null)
      .order("generated_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data as any) ?? []);
        setLoading(false);
      });
  }, [farmerId]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  function effectiveStatus(r: Inv): string {
    if (r.invoice_status === "cancelled") return "cancelled";
    if (Number(r.due_amount || 0) <= 0) return "paid";
    if (Number(r.paid_amount || 0) > 0) return r.due_date && r.due_date < today ? "overdue" : "partial";
    if (r.due_date && r.due_date < today) return "overdue";
    return "pending";
  }

  const seasons = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.season_id) m.set(r.season_id, `${r.seasons?.name ?? r.seasons?.type ?? ""} ${r.seasons?.year ?? ""}`.trim());
    }
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (statusFilter !== "all" && effectiveStatus(r) !== statusFilter) return false;
        if (seasonFilter !== "all" && r.season_id !== seasonFilter) return false;
        if (fromDate && (r.generated_at ?? "").slice(0, 10) < fromDate) return false;
        if (toDate && (r.generated_at ?? "").slice(0, 10) > toDate) return false;
        if (q) {
          const hay = [
            r.invoice_no,
            r.land_type_name,
            r.lands?.mouza,
            r.lands?.dag_no,
            r.seasons?.name,
            r.seasons?.type,
            r.seasons?.year,
            effectiveStatus(r),
          ].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = typeof av === "number" || typeof bv === "number"
          ? Number(av) - Number(bv)
          : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [rows, search, statusFilter, seasonFilter, fromDate, toDate, sortKey, sortDir, today]);

  const totals = useMemo(() => {
    const sel = filtered.filter((r) => selected.has(r.id));
    return {
      count: sel.length,
      due: sel.reduce((s, r) => s + Number(r.due_amount || 0), 0),
    };
  }, [filtered, selected]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function toggleAll() {
    const eligible = filtered.filter((r) => Number(r.due_amount || 0) > 0 && r.invoice_status !== "cancelled");
    if (eligible.every((r) => selected.has(r.id))) setSelected(new Set());
    else setSelected(new Set(eligible.map((r) => r.id)));
  }

  function payNow() {
    if (selected.size === 0) return toast.error("কমপক্ষে একটি ইনভয়েস বেছে নিন");
    const ids = filtered.filter((r) => selected.has(r.id) && Number(r.due_amount || 0) > 0 && r.invoice_status !== "cancelled").map((r) => r.id);
    if (!ids.length) return toast.error("নির্বাচিত ইনভয়েসগুলো পরিশোধযোগ্য নয়");
    nav(`/payments?farmer=${farmerId}&irr=${ids.join(",")}`);
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {/* Filters */}
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="খুঁজুন (ইনভয়েস, সিজন, মৌজা, ধরন)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
              <SelectItem value="pending">পেন্ডিং</SelectItem>
              <SelectItem value="partial">আংশিক</SelectItem>
              <SelectItem value="paid">পরিশোধিত</SelectItem>
              <SelectItem value="overdue">মেয়াদোত্তীর্ণ</SelectItem>
              <SelectItem value="cancelled">বাতিল</SelectItem>
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব সিজন</SelectItem>
              {seasons.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium">{totals.count} টি ইনভয়েস</span>
              <span className="ml-3 text-muted-foreground">মোট বকেয়া: <span className="font-mono font-semibold">{money(totals.due)}</span></span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>রিসেট</Button>
              <Button size="sm" onClick={payNow}><Wallet className="h-4 w-4 mr-1" /> পেমেন্ট করুন</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.filter((r) => Number(r.due_amount || 0) > 0 && r.invoice_status !== "cancelled").every((r) => selected.has(r.id))}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>ইনভয়েস</TableHead>
                <TableHead>সিজন</TableHead>
                <TableHead>জমি</TableHead>
                <SortHead label="মেয়াদ" k="due_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortHead label="প্রদেয়" k="payable_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label="পরিশোধিত" k="paid_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label="বকেয়া" k="due_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label="স্ট্যাটাস" k="invoice_status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">লোড হচ্ছে…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">কোন ইনভয়েস নেই</TableCell></TableRow>
              ) : filtered.map((r) => {
                const st = effectiveStatus(r);
                const eligible = Number(r.due_amount || 0) > 0 && r.invoice_status !== "cancelled";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        disabled={!eligible}
                        onCheckedChange={(v) => {
                          const s = new Set(selected);
                          if (v) s.add(r.id); else s.delete(r.id);
                          setSelected(s);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                    <TableCell className="text-xs">{r.seasons?.name ?? r.seasons?.type} {r.seasons?.year ?? ""}</TableCell>
                    <TableCell className="text-xs">{r.lands?.mouza ?? ""} {r.lands?.dag_no ? `• ${r.lands.dag_no}` : ""}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.due_date}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.payable_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.paid_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.due_amount)}</TableCell>
                    <TableCell><StatusBadge status={st} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} টি ইনভয়েস (মোট {rows.length})</p>
      </CardContent>
    </Card>
  );
}

function SortHead({ label, k, sortKey, sortDir, onClick, className }: { label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: (k: SortKey) => void; className?: string }) {
  const active = sortKey === k;
  return (
    <TableHead className={className}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onClick(k)}>
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-primary" : "text-muted-foreground"}`} />
        {active && <span className="text-[9px]">{sortDir}</span>}
      </button>
    </TableHead>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any; className?: string }> = {
    pending: { label: "পেন্ডিং", variant: "outline" },
    partial: { label: "আংশিক", variant: "secondary" },
    paid: { label: "পরিশোধিত", variant: "default" },
    overdue: { label: "মেয়াদোত্তীর্ণ", variant: "destructive" },
    cancelled: { label: "বাতিল", variant: "outline", className: "opacity-60" },
  };
  const c = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}
