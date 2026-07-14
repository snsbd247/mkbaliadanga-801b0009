import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Wallet, ArrowUpDown, FileDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { exportTablePDF } from "@/lib/exports";
import { invoiceBilledArea, invoiceParcelArea } from "@/lib/irrigationInvoiceArea";

type Inv = any;
type SortKey = "due_date" | "payable_amount" | "due_amount" | "paid_amount" | "invoice_status" | "generated_at";

export default function IrrigationInvoicesTab({ farmerId }: { farmerId: string }) {
  const nav = useNavigate();
  const { t } = useLang();
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
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    db
      .from("irrigation_invoices" as any)
      .select("*, seasons(name,year,type), lands(dag_no,mouza,land_size,owner_type,owner_farmer_id)")
      .eq("farmer_id", farmerId)
      .is("deleted_at", null)
      .order("generated_at", { ascending: false })
      .limit(500)
      .then(async ({ data, error }) => {
        if (error) toast.error(error.message);
        const list = (data as any[]) ?? [];
        setRows(list);
        const ownerIds = Array.from(new Set(
          list.map((r: any) => r.is_borga ? (r.owner_farmer_id ?? r.lands?.owner_farmer_id) : null).filter(Boolean)
        )) as string[];
        if (ownerIds.length) {
          const { data: owners } = await db.from("farmers").select("id,name_en,name_bn,farmer_code").in("id", ownerIds);
          const map: Record<string, string> = {};
          (owners ?? []).forEach((o: any) => { map[o.id] = o.name_bn || o.name_en || o.farmer_code || "—"; });
          setOwnerNames(map);
        } else {
          setOwnerNames({});
        }
        setLoading(false);
      });
  }, [farmerId]);

  function landLabel(r: Inv): { main: string; sub: string } {
    const l = r.lands || {};
    const parts: string[] = [];
    if (l.mouza) parts.push(String(l.mouza));
    if (l.dag_no) parts.push(`দাগ ${l.dag_no}`);
    const billedArea = invoiceBilledArea(r);
    const parcelArea = invoiceParcelArea(r);
    if (billedArea != null) parts.push(`${billedArea.toFixed(4)} শতক`);
    const main = parts.join(" • ");
    let sub = "";
    if (r.is_borga) {
      const ownerId = r.owner_farmer_id ?? l.owner_farmer_id;
      const oname = ownerId ? ownerNames[ownerId] : "";
      const total = parcelArea != null && billedArea != null && Math.abs(parcelArea - billedArea) > 0.0001
        ? ` — পূর্ণ জমি: ${parcelArea.toFixed(4)} শতক`
        : "";
      sub = `বর্গা${oname ? ` — মালিক: ${oname}` : ""}${total}`;
    } else if (l.owner_type === "owner") {
      sub = "নিজ মালিক";
    }
    return { main, sub };
  }

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
    if (selected.size === 0) return toast.error(t("irr_selectAtLeastOne" as any));
    const ids = filtered.filter((r) => selected.has(r.id) && Number(r.due_amount || 0) > 0 && r.invoice_status !== "cancelled").map((r) => r.id);
    if (!ids.length) return toast.error(t("irr_notPayable" as any));
    nav(`/payments?farmer=${farmerId}&irr=${ids.join(",")}`);
  }

  async function combinedReceipt() {
    if (selected.size === 0) return toast.error(t("irr_selectAtLeastOne" as any));
    const sel = filtered.filter((r) => selected.has(r.id));
    // Group by season label for visual grouping
    const sorted = [...sel].sort((a, b) => {
      const sa = `${a.seasons?.year ?? ""} ${a.seasons?.name ?? a.seasons?.type ?? ""}`;
      const sb = `${b.seasons?.year ?? ""} ${b.seasons?.name ?? b.seasons?.type ?? ""}`;
      return sa.localeCompare(sb);
    });
    const totalPayable = sorted.reduce((s, r) => s + Number(r.payable_amount || 0), 0);
    const totalPaid = sorted.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const totalDue = sorted.reduce((s, r) => s + Number(r.due_amount || 0), 0);
    const rows: any[][] = sorted.map((r) => {
      const ll = landLabel(r);
      return [
        r.invoice_no ?? "—",
        `${r.seasons?.name ?? r.seasons?.type ?? ""} ${r.seasons?.year ?? ""}`.trim(),
        ll.main + (ll.sub ? ` (${ll.sub})` : ""),
        fmtDate(r.due_date),
        money(r.payable_amount),
        money(r.paid_amount),
        money(r.due_amount),
      ];
    });
    rows.push(["", "", "", "মোট (Total)", money(totalPayable), money(totalPaid), money(totalDue)]);
    await exportTablePDF(
      `Combined Irrigation Receipt — ${sel.length} invoice(s)`,
      ["Invoice", "Season", "Land", "Due Date", "Payable", "Paid", "Due"],
      rows,
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {/* Filters */}
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder={t("irr_search" as any)} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("irr_allStatuses" as any)}</SelectItem>
              <SelectItem value="pending">{t("irr_statusPending" as any)}</SelectItem>
              <SelectItem value="partial">{t("irr_statusPartial" as any)}</SelectItem>
              <SelectItem value="paid">{t("irr_statusPaid" as any)}</SelectItem>
              <SelectItem value="overdue">{t("irr_statusOverdue" as any)}</SelectItem>
              <SelectItem value="cancelled">{t("irr_statusCancelled" as any)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("irr_allSeasons" as any)}</SelectItem>
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
              <span className="font-medium">{t("irr_invoiceCount" as any).replace("{n}", String(totals.count))}</span>
              <span className="ml-3 text-muted-foreground">{t("irr_totalDue" as any)}: <span className="font-mono font-semibold">{money(totals.due)}</span></span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("irr_reset" as any)}</Button>
              <Button size="sm" variant="outline" onClick={combinedReceipt}><FileDown className="h-4 w-4 mr-1" /> মিলিত রসিদ</Button>
              <Button size="sm" onClick={payNow}><Wallet className="h-4 w-4 mr-1" /> {t("irr_payNow" as any)}</Button>
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
                <TableHead>{t("irr_colInvoice" as any)}</TableHead>
                <TableHead>{t("irr_colSeason" as any)}</TableHead>
                <TableHead>{t("irr_colLand" as any)}</TableHead>
                <SortHead label={t("irr_colDueDate" as any)} k="due_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortHead label={t("irr_chartLegendPayable" as any)} k="payable_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label={t("irr_colPaid" as any)} k="paid_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label={t("irr_colDue" as any)} k="due_amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHead label={t("irr_colStatus" as any)} k="invoice_status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{t("irr_loading" as any)}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{t("irr_noInvoice" as any)}</TableCell></TableRow>
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
                    <TableCell className="font-mono text-xs">
                      {r.invoice_no}
                      {r.rate_source === "MANUAL" && <Badge variant="outline" className="ml-1 text-[10px]">কাস্টম রেট</Badge>}
                      {r.rate_source === "CATEGORY" && r.irrigation_category_name && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">{r.irrigation_category_name}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.seasons?.name ?? r.seasons?.type} {r.seasons?.year ?? ""}</TableCell>
                    <TableCell className="text-xs">
                      {(() => { const ll = landLabel(r); return (
                        <div className="flex flex-col">
                          <span>{ll.main || "—"}</span>
                          {ll.sub && <span className="text-[10px] text-muted-foreground">{ll.sub}</span>}
                        </div>
                      ); })()}
                    </TableCell>
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
        <p className="text-xs text-muted-foreground">{t("irr_invoiceCount" as any).replace("{n}", String(filtered.length))} ({rows.length})</p>
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
  const { t } = useLang();
  const map: Record<string, { label: string; variant: any; className?: string }> = {
    pending: { label: t("irr_statusPending" as any), variant: "outline" },
    partial: { label: t("irr_statusPartial" as any), variant: "secondary" },
    paid: { label: t("irr_statusPaid" as any), variant: "default" },
    overdue: { label: t("irr_statusOverdue" as any), variant: "destructive" },
    cancelled: { label: t("irr_statusCancelled" as any), variant: "outline", className: "opacity-60" },
  };
  const c = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}
