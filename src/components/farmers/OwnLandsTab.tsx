import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileText, FileSpreadsheet, History, ArrowUpDown, Plus } from "lucide-react";
import { money } from "@/lib/format";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";

type SeasonStatus = { state: "none" | "paid" | "partial" | "due"; payable: number; paid: number; due: number };

type SortKey = "location" | "dag_no" | "land_size" | "field_type" | "rate" | "total" | "status";

interface Props {
  lands: any[];
  loading?: boolean;
  rateMap: any[];
  resolveRateForLand: (rateMap: any[], land: any) => any;
  landSeasonStatus: (landId: string) => SeasonStatus;
  buildLocLine: (land: any) => string;
  fmtLand: (v: any) => string;
  t: (k: any) => string;
  tx: (en: string, bn: string) => string;
  farmer: { name_en: string; account_number?: string | null; farmer_code: string };
  downloadLandInvoices: (landId: string) => void;
  openEdit: (land: any) => void;
  onDelete: (land: any) => void;
  borgaOut?: any[];
  /** Map of owner land id -> total area currently given out as borga. */
  borgaGivenMap?: Record<string, number>;
}

const PAGE_SIZE = 10;

export default function OwnLandsTab({
  lands, loading, rateMap, resolveRateForLand, landSeasonStatus, buildLocLine,
  fmtLand, t, tx, farmer, downloadLandInvoices, openEdit, onDelete, borgaOut = [], borgaGivenMap = {},
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dag_no");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const statusLabel = (s: SeasonStatus["state"]) =>
    s === "paid" ? tx("Paid", "পরিশোধিত")
      : s === "partial" ? tx("Partially Paid", "আংশিক পরিশোধিত")
      : s === "due" ? tx("Due", "বকেয়া")
      : tx("No invoice", "ইনভয়েস নেই");

  const enriched = useMemo(() => {
    return lands
      .filter((l) => l.owner_type === "owner")
      .map((l) => {
        const matched = resolveRateForLand(rateMap, l);
        const rate = matched ? Number(matched.rate_per_shotok) : 0;
        const size = Number(l.land_size || 0);
        const given = Math.min(size, Math.max(0, Number(borgaGivenMap[l.id] || 0)));
        const selfArea = Math.max(0, +(size - given).toFixed(3));
        // Irrigation is billed on the self-cultivated (remaining) area only.
        const total = rate * selfArea;
        const m = landSeasonStatus(l.id);
        return { l, rate, total, m, location: buildLocLine(l), size, given, selfArea };
      });
  }, [lands, rateMap, resolveRateForLand, landSeasonStatus, buildLocLine, borgaGivenMap]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q ? enriched : enriched.filter((r) =>
      [r.location, r.l.dag_no, r.l.patwari_name_bn, r.l.patwari_name, r.l.field_type]
        .filter(Boolean).join(" ").toLowerCase().includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: typeof base[number]) => {
      switch (sortKey) {
        case "location": return r.location ?? "";
        case "dag_no": return r.l.dag_no ?? "";
        case "land_size": return Number(r.l.land_size || 0);
        case "field_type": return r.l.field_type ?? "";
        case "rate": return r.rate;
        case "total": return r.total;
        case "status": return r.m.due;
      }
    };
    return [...base].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [enriched, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const exportRows = () => filtered.map((r, i) => [
    i + 1,
    r.location || "-",
    r.l.dag_no ?? "-",
    Number(r.size.toFixed(3)),
    Number(r.given.toFixed(3)),
    Number(r.selfArea.toFixed(3)),
    t((r.l.owner_type as any) ?? ""),
    tx("Self-owned", "নিজ মালিক"),
    r.l.patwari_name_bn || r.l.patwari_name || "-",
    t((r.l.field_type as any) ?? ""),
    r.rate ? Number(r.rate.toFixed(2)) : 0,
    r.total ? Number(r.total.toFixed(2)) : 0,
    r.m.state === "none" ? "-" : Number(r.m.due.toFixed(2)),
    statusLabel(r.m.state),
  ]);

  const headerLabels = [
    "#", tx("Location", "অবস্থান"), tx("Dag No", "দাগ নং"),
    tx("Total Size", "মোট জমি"), tx("Borga Given", "বর্গা দেওয়া"), tx("Remaining (self)", "অবশিষ্ট (নিজ)"),
    tx("Owner Type", "মালিকানার ধরন"),
    tx("Owner", "মালিক"), tx("Patwari", "পাটুয়ারি"), tx("Field Type", "জমির শ্রেণি"),
    tx("Rate / Shotok", "রেট/শতক"), tx("Total Amount", "মোট টাকা"),
    tx("Irrigation Charge Due", "সেচ চার্জ বকেয়া"), tx("Payment Status", "পেমেন্ট স্ট্যাটাস"),
  ];


  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Own Lands - ${farmer.name_en}`, 40, 40);
    doc.setFontSize(10);
    doc.text(`Account: ${farmer.account_number ?? farmer.farmer_code}`, 40, 58);
    autoTable(doc, { head: [headerLabels], body: exportRows() as any, startY: 72, styles: { fontSize: 8 } });
    doc.save(`own-lands-${farmer.farmer_code}.pdf`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...exportRows()]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Own Lands");
    XLSX.writeFile(wb, `own-lands-${farmer.farmer_code}.xlsx`);
  };

  const Th = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}<ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "opacity-100" : "opacity-40"}`} />
      </button>
    </TableHead>
  );

  if (loading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </Card>
    );
  }

  const allOwn = enriched.length;
  const totalSize = enriched.reduce((s, r) => s + r.size, 0);
  const totalGiven = enriched.reduce((s, r) => s + r.given, 0);
  const totalRemaining = enriched.reduce((s, r) => s + r.selfArea, 0);
  const totalAmount = enriched.reduce((s, r) => s + r.total, 0);
  const totalDue = enriched.reduce((s, r) => s + (r.m.state === "none" ? 0 : r.m.due), 0);
  const borgaSize = borgaOut.reduce((s, l) => s + Number(l.land_size || 0), 0);


  return (
    <div className="space-y-4">
      {/* ===== Own lands the farmer cultivates ===== */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-muted/30">
          <div>
            <h3 className="text-sm font-semibold">{tx("Own Lands", "নিজের জমি")}</h3>
            <p className="text-xs text-muted-foreground">
              {tx("Lands owned and cultivated by this farmer", "এই কৃষকের নিজ মালিকানাধীন জমি")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={tx("Search location, dag, patwari…", "অবস্থান, দাগ, পাটুয়ারি খুঁজুন…")}
              className="h-8 w-[220px] text-xs"
            />
            <Button size="sm" variant="outline" disabled={allOwn === 0} onClick={exportPdf}>
              <FileText className="h-4 w-4 mr-1" />PDF
            </Button>
            <Button size="sm" variant="outline" disabled={allOwn === 0} onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        </div>

        {allOwn > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b text-xs">
            <Badge variant="secondary">{tx("Plots", "জমি")}: {allOwn}</Badge>
            <Badge variant="secondary">{tx("Total Size", "মোট জমি")}: {fmtLand(totalSize)}</Badge>
            {totalGiven > 0.005 && <Badge variant="secondary">{tx("Borga Given", "বর্গা দেওয়া")}: {fmtLand(totalGiven)}</Badge>}
            {totalGiven > 0.005 && <Badge variant="secondary">{tx("Remaining (self)", "অবশিষ্ট (নিজ)")}: {fmtLand(totalRemaining)}</Badge>}
            <Badge variant="secondary">{tx("Total Amount", "মোট টাকা")}: {money(totalAmount)}</Badge>

            {totalDue > 0.005
              ? <Badge variant="destructive">{tx("Due", "বকেয়া")}: {money(totalDue)}</Badge>
              : <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{tx("All Paid", "সব পরিশোধিত")}</Badge>}
          </div>
        )}

        {allOwn === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Plus className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">{tx("No own lands", "নিজের কোনো জমি নেই")}</p>
            <p className="text-xs text-muted-foreground">
              {tx("This farmer has no lands they personally own.", "এই কৃষকের নিজ মালিকানাধীন কোনো জমি নেই।")}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-muted/40">
                  <Th k="location">{tx("Location", "অবস্থান")}</Th>
                  <Th k="dag_no">{tx("Dag No", "দাগ নং")}</Th>
                  <Th k="land_size" align="right">{tx("Total Size", "মোট জমি")}</Th>
                  <TableHead className="text-right">{tx("Borga Given", "বর্গা দেওয়া")}</TableHead>
                  <TableHead className="text-right">{tx("Remaining (self)", "অবশিষ্ট (নিজ)")}</TableHead>

                  <TableHead>{tx("Owner Type", "মালিকানার ধরন")}</TableHead>
                  <TableHead>{tx("Owner", "মালিক")}</TableHead>
                  <TableHead>{tx("Patwari", "পাটুয়ারি")}</TableHead>
                  <Th k="field_type">{tx("Field Type", "জমির শ্রেণি")}</Th>
                  <Th k="rate" align="right">{tx("Rate / Shotok", "রেট/শতক")}</Th>
                  <Th k="total" align="right">{tx("Total Amount", "মোট টাকা")}</Th>
                  <TableHead>{tx("Irrigation Charge", "সেচ চার্জ")}</TableHead>
                  <Th k="status">{tx("Payment Status", "পেমেন্ট স্ট্যাটাস")}</Th>
                  <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
                  ) : pageRows.map(({ l, rate, total, m, location, size, given, selfArea }) => {
                    const isDue = m.due > 0.005;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs max-w-md whitespace-normal">{location}</TableCell>
                        <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link></TableCell>
                        <TableCell className="text-right">{fmtLand(size)}</TableCell>
                        <TableCell className="text-right">
                          {given > 0.005
                            ? <Badge variant="secondary" className="font-normal">{fmtLand(given)}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtLand(selfArea)}</TableCell>

                        <TableCell>{t((l.owner_type as any) ?? "")}</TableCell>
                        <TableCell className="text-xs"><span className="text-muted-foreground">{tx("Self-owned", "নিজ মালিক")}</span></TableCell>
                        <TableCell className="text-xs">{l.patwari_name_bn || l.patwari_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{t((l.field_type as any) ?? "")}</TableCell>
                        <TableCell className="text-right">{rate ? money(rate) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">{rate ? money(total) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {m.state === "none"
                            ? <span className="text-muted-foreground text-xs">{tx("No invoice", "ইনভয়েস নেই")}</span>
                            : (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => downloadLandInvoices(l.id)}>
                                <FileDown className="h-3.5 w-3.5" />
                                {isDue ? tx("Invoice", "ইনভয়েস") : tx("Receipt", "রসিদ")}
                              </Button>
                            )}
                        </TableCell>
                        <TableCell>
                          {m.state === "none"
                            ? <span className="text-muted-foreground text-xs">—</span>
                            : isDue
                              ? <Badge variant="destructive">{statusLabel(m.state)} {money(m.due)}</Badge>
                              : <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{statusLabel(m.state)}</Badge>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" title={tx("Irrigation / Payment history", "সেচ / পেমেন্ট ইতিহাস")}>
                            <Link to={`/lands/${l.id}`}><History className="h-3.5 w-3.5" />{tx("History", "ইতিহাস")}</Link>
                          </Button>
                          <EditButton onClick={() => openEdit(l)} title={t("edit")} />
                          <DeleteButton onClick={() => onDelete(l)} title={t("delete")} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 p-3 border-t text-xs">
                <span className="text-muted-foreground">
                  {tx("Showing", "দেখানো হচ্ছে")} {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filtered.length)} / {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
                    {tx("Previous", "পূর্ববর্তী")}
                  </Button>
                  <span>{curPage} / {totalPages}</span>
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>
                    {tx("Next", "পরবর্তী")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ===== Own lands sharecropped by others ===== */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b bg-muted/30">
          <div>
            <h3 className="text-sm font-semibold">{tx("Sharecropped by others", "অন্যরা বর্গা চাষ করছেন")}</h3>
            <p className="text-xs text-muted-foreground">
              {tx("Own lands the owner does not farm — cultivated by sharecroppers", "মালিক নিজে চাষ করেন না — বর্গাদাররা চাষ করছেন")}
            </p>
          </div>
          {borgaOut.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">{tx("Plots", "জমি")}: {borgaOut.length}</Badge>
              <Badge variant="secondary">{tx("Total Size", "মোট জমি")}: {fmtLand(borgaSize)}</Badge>
            </div>
          )}
        </div>
        {borgaOut.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {tx("No sharecropped lands", "কোনো বর্গা জমি নেই")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/40">
                <TableHead>{tx("Dag No", "দাগ নং")}</TableHead>
                <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                <TableHead className="text-right">{tx("Land Size (Decimal)", "জমির পরিমাণ (শতক)")}</TableHead>
                <TableHead>{tx("Sharecropper", "বর্গাদার")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {borgaOut.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.dag_no || (l.dag_numbers || []).join(", ") || "—"}</TableCell>
                    <TableCell>{l.mouza_name || l.mouza || "—"}</TableCell>
                    <TableCell className="text-right">{fmtLand(l.land_size)}</TableCell>
                    <TableCell className="text-xs">
                      {l.tenant ? (
                        <Link to={`/farmers/${l.tenant.id}`} className="underline text-primary">
                          {l.tenant.name_bn || l.tenant.name_en}
                          {l.tenant.farmer_code ? <span className="text-muted-foreground"> ({l.tenant.farmer_code})</span> : null}
                        </Link>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
