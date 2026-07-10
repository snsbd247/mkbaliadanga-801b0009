import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { formatDagNumbers } from "@/lib/dagNumbers";

/**
 * Opening (carry-forward) Due Report.
 *
 * Opening dues are imported as invoices whose invoice_no starts with "OPEN-".
 * This screen verifies the import calculation (previous_due_amount + delay_fee
 * = payable / due) and offers Season-wise and Land-wise breakdowns with
 * PDF / Excel export.
 */

type Row = {
  invoice_no: string;
  season_id: string;
  season_label: string;
  land_id: string;
  mouza: string;
  dag: string;
  land_size: number;
  owner_name: string;
  owner_code: string;
  previous_due: number;
  delay_fee: number;
  payable: number;
  paid: number;
  due: number;
  ok: boolean;
};

export default function OpeningDueReport() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "ওপেনিং বকেয়া রিপোর্ট — Opening Due Report";
    db.from("seasons").select("id,name,year").order("year", { ascending: false }).then(({ data }) => {
      setSeasons(data ?? []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = db.from("irrigation_invoices").select(
        "invoice_no,season_id,land_id,previous_due_amount,delay_fee,payable_amount,paid_amount,due_amount," +
        "lands(mouza,mouzas(name_bn,name),dag_no,dag_numbers,land_size,owner:farmers!lands_owner_farmer_id_fkey(name_en,name_bn,farmer_code))," +
        "seasons(name,year)"
      ).like("invoice_no", "OPEN-%").is("deleted_at", null);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      const { data } = await q.limit(5000);
      if (cancelled) return;
      const mapped: Row[] = (data ?? []).map((r: any) => {
        const land = r.lands ?? {};
        const owner = land.owner ?? {};
        const prev = Number(r.previous_due_amount ?? 0);
        const fee = Number(r.delay_fee ?? 0);
        const payable = Number(r.payable_amount ?? 0);
        return {
          invoice_no: r.invoice_no,
          season_id: r.season_id,
          season_label: r.seasons ? `${r.seasons.name}${r.seasons.year ? ` (${r.seasons.year})` : ""}` : "",
          land_id: r.land_id,
          mouza: resolveMouzaName(land) || (land.mouza ?? ""),
          dag: formatDagNumbers(Array.isArray(land.dag_numbers) && land.dag_numbers.length ? land.dag_numbers.join(",") : (land.dag_no ?? "")),
          land_size: Number(land.land_size ?? 0),
          owner_name: owner.name_bn || owner.name_en || "",
          owner_code: owner.farmer_code ?? "",
          previous_due: prev,
          delay_fee: fee,
          payable,
          paid: Number(r.paid_amount ?? 0),
          due: Number(r.due_amount ?? 0),
          ok: Math.abs(prev + fee - payable) < 0.01,
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [seasonId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.owner_name.toLowerCase().includes(s) ||
      r.owner_code.toLowerCase().includes(s) ||
      r.mouza.toLowerCase().includes(s) ||
      r.dag.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce((a, r) => ({
    previous_due: a.previous_due + r.previous_due,
    delay_fee: a.delay_fee + r.delay_fee,
    payable: a.payable + r.payable,
    paid: a.paid + r.paid,
    due: a.due + r.due,
  }), { previous_due: 0, delay_fee: 0, payable: 0, paid: 0, due: 0 }), [filtered]);

  const mismatchCount = useMemo(() => filtered.filter((r) => !r.ok).length, [filtered]);

  const bySeason = useMemo(() => {
    const m = new Map<string, { label: string; count: number; previous_due: number; delay_fee: number; payable: number; paid: number; due: number }>();
    filtered.forEach((r) => {
      const k = r.season_id;
      const cur = m.get(k) ?? { label: r.season_label || "—", count: 0, previous_due: 0, delay_fee: 0, payable: 0, paid: 0, due: 0 };
      cur.count++; cur.previous_due += r.previous_due; cur.delay_fee += r.delay_fee;
      cur.payable += r.payable; cur.paid += r.paid; cur.due += r.due;
      m.set(k, cur);
    });
    return [...m.values()];
  }, [filtered]);

  function exportLandPDF() {
    exportTablePDF(
      "ওপেনিং বকেয়া (জমিভিত্তিক)",
      ["মালিক", "ID", "মৌজা", "দাগ", "পূর্বের বকেয়া", "জরিমানা", "মোট", "আদায়", "বকেয়া"],
      filtered.map((r) => [r.owner_name, r.owner_code, r.mouza, r.dag, money(r.previous_due), money(r.delay_fee), money(r.payable), money(r.paid), money(r.due)]),
      undefined,
      { landscape: true },
    );
  }
  function exportLandExcel() {
    exportExcel("ওপেনিং-বকেয়া-জমিভিত্তিক", "Land-wise", filtered.map((r) => ({
      "মালিক": r.owner_name, "ID": r.owner_code, "সিজন": r.season_label, "মৌজা": r.mouza, "দাগ": r.dag,
      "জমি (শতক)": r.land_size, "পূর্বের বকেয়া": r.previous_due, "জরিমানা": r.delay_fee,
      "মোট": r.payable, "আদায়": r.paid, "বকেয়া": r.due, "চেক": r.ok ? "ঠিক" : "অমিল",
    })));
  }
  function exportSeasonPDF() {
    exportTablePDF(
      "ওপেনিং বকেয়া (সিজনভিত্তিক)",
      ["সিজন", "এন্ট্রি", "পূর্বের বকেয়া", "জরিমানা", "মোট", "আদায়", "বকেয়া"],
      bySeason.map((s) => [s.label, String(s.count), money(s.previous_due), money(s.delay_fee), money(s.payable), money(s.paid), money(s.due)]),
    );
  }
  function exportSeasonExcel() {
    exportExcel("ওপেনিং-বকেয়া-সিজনভিত্তিক", "Season-wise", bySeason.map((s) => ({
      "সিজন": s.label, "এন্ট্রি": s.count, "পূর্বের বকেয়া": s.previous_due, "জরিমানা": s.delay_fee,
      "মোট": s.payable, "আদায়": s.paid, "বকেয়া": s.due,
    })));
  }

  return (
    <>
      <PageHeader title="ওপেনিং বকেয়া রিপোর্ট" description="সিজনভিত্তিক ও জমিভিত্তিক ওপেনিং বকেয়া যাচাই ও এক্সপোর্ট" />

      <Card className="mb-4">
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="w-56">
            <Label className="mb-1 block">সিজন</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব সিজন</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}{s.year ? ` (${s.year})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Label className="mb-1 block">খুঁজুন</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="মালিক / ID / মৌজা / দাগ" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <SummaryCard label="পূর্বের বকেয়া" value={money(totals.previous_due)} />
        <SummaryCard label="জরিমানা" value={money(totals.delay_fee)} />
        <SummaryCard label="মোট" value={money(totals.payable)} />
        <SummaryCard label="আদায়" value={money(totals.paid)} />
        <SummaryCard label="বর্তমান বকেয়া" value={money(totals.due)} />
      </div>

      {mismatchCount > 0 && (
        <Card className="mb-4 border-destructive">
          <CardContent className="pt-4 text-destructive text-sm">
            ⚠ {mismatchCount} টি এন্ট্রিতে হিসাব মিলছে না (পূর্বের বকেয়া + জরিমানা ≠ মোট)। নিচের তালিকায় "অমিল" দেখুন।
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="land">
        <TabsList>
          <TabsTrigger value="land">জমিভিত্তিক</TabsTrigger>
          <TabsTrigger value="season">সিজনভিত্তিক</TabsTrigger>
        </TabsList>

        <TabsContent value="land">
          <div className="flex gap-2 my-3">
            <Button variant="outline" size="sm" onClick={exportLandPDF}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={exportLandExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>মালিক</TableHead><TableHead>ID</TableHead><TableHead>মৌজা</TableHead><TableHead>দাগ</TableHead>
                <TableHead className="text-right">পূর্বের বকেয়া</TableHead><TableHead className="text-right">জরিমানা</TableHead>
                <TableHead className="text-right">মোট</TableHead><TableHead className="text-right">আদায়</TableHead>
                <TableHead className="text-right">বকেয়া</TableHead><TableHead>চেক</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">কোনো ওপেনিং বকেয়া নেই</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.invoice_no} className={r.ok ? "" : "bg-destructive/10"}>
                    <TableCell>{r.owner_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.owner_code}</TableCell>
                    <TableCell>{r.mouza}</TableCell>
                    <TableCell className="font-mono text-xs">{r.dag}</TableCell>
                    <TableCell className="text-right">{money(r.previous_due)}</TableCell>
                    <TableCell className="text-right">{money(r.delay_fee)}</TableCell>
                    <TableCell className="text-right">{money(r.payable)}</TableCell>
                    <TableCell className="text-right">{money(r.paid)}</TableCell>
                    <TableCell className="text-right">{money(r.due)}</TableCell>
                    <TableCell>{r.ok ? "✓" : <span className="text-destructive">অমিল</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="season">
          <div className="flex gap-2 my-3">
            <Button variant="outline" size="sm" onClick={exportSeasonPDF}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={exportSeasonExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>সিজন</TableHead><TableHead className="text-right">এন্ট্রি</TableHead>
                <TableHead className="text-right">পূর্বের বকেয়া</TableHead><TableHead className="text-right">জরিমানা</TableHead>
                <TableHead className="text-right">মোট</TableHead><TableHead className="text-right">আদায়</TableHead>
                <TableHead className="text-right">বকেয়া</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bySeason.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো তথ্য নেই</TableCell></TableRow>
                ) : bySeason.map((s) => (
                  <TableRow key={s.label}>
                    <TableCell>{s.label}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{money(s.previous_due)}</TableCell>
                    <TableCell className="text-right">{money(s.delay_fee)}</TableCell>
                    <TableCell className="text-right">{money(s.payable)}</TableCell>
                    <TableCell className="text-right">{money(s.paid)}</TableCell>
                    <TableCell className="text-right">{money(s.due)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </CardContent></Card>
  );
}
