import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLandTypes, landTypeLabel } from "@/components/locations/LandTypeSelect";

/**
 * Consolidated Cultivation History view.
 * Each row = one farmer with their lands rolled up:
 *   Name, Father, Mobile, Member ID, Mouza(s), Total area, Total amount (current season rate).
 */
export default function CultivationHistoryReport() {
  const { tx } = useLang();
  const { rows: landTypeRows } = useLandTypes();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [rateMap, setRateMap] = useState<RateRow[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [seasonName, setSeasonName] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tx("Cultivation History", "চাষাবাদের তথ্য");
    db.from("seasons").select("id,name,year,type,status").order("year", { ascending: false }).then(({ data }) => {
      const list = data ?? [];
      setSeasons(list);
      const active = list.find((s: any) => s.status === "active") || list[0];
      if (active) {
        setSeasonId(active.id);
        setSeasonName(active.name || `${active.type} ${active.year}`);
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.from("farmers").select("id,name_en,name_bn,father_name,mobile,member_no,farmer_code,status").is("deleted_at", null).order("name_en"),
      (db.from as any)("lands_with_location").select("id,farmer_id,owner_type,land_size,field_type,land_type_id,mouza_name,mouza,dag_no"),
    ]).then(([f, l]) => {
      setFarmers(f.data ?? []);
      setLands(l.data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!seasonId) { setRateMap([]); return; }
    loadSeasonRateMap(seasonId, null).then(setRateMap);
    const s = seasons.find((x: any) => x.id === seasonId);
    if (s) setSeasonName(s.name || `${s.type} ${s.year}`);
  }, [seasonId, seasons]);

  const rows = useMemo(() => {
    const byFarmer: Record<string, any[]> = {};
    for (const l of lands) {
      (byFarmer[l.farmer_id] ||= []).push(l);
    }
    return farmers.map((f) => {
      const fl = byFarmer[f.id] ?? [];
      const totalArea = fl.reduce((s, l) => s + Number(l.land_size || 0), 0);
      const totalAmount = fl.reduce((s, l) => {
        const m = resolveRateForLand(rateMap, l);
        return s + (m ? Number(m.rate_per_shotok) * Number(l.land_size || 0) : 0);
      }, 0);
      const rates = Array.from(new Set(fl.map(l => {
        const m = resolveRateForLand(rateMap, l);
        return m ? Number(m.rate_per_shotok) : null;
      }).filter(v => v !== null))) as number[];
      const avgRate = totalArea > 0 ? totalAmount / totalArea : 0;
      const mouzas = Array.from(new Set(fl.map((l) => l.mouza_name || l.mouza).filter(Boolean))).join(", ");
      const particulars = Array.from(new Set(fl.map((l) => landTypeLabel(landTypeRows, l.land_type_id, l.field_type) || l.field_type).filter(Boolean))).join(", ");
      return {
        id: f.id,
        member_no: f.member_no ?? f.farmer_code ?? "—",
        name: f.name_bn || f.name_en || "—",
        father: f.father_name ?? "—",
        mobile: f.mobile ?? "—",
        mouzas: mouzas || "—",
        particulars: particulars || "—",
        rateLabel: rates.length === 0 ? "—" : rates.length === 1 ? money(rates[0]) : `${money(Math.min(...rates))}–${money(Math.max(...rates))}`,
        avgRate,
        landCount: fl.length,
        totalArea,
        totalAmount,
      };
    }).filter((r) => r.landCount > 0);
  }, [farmers, lands, rateMap, landTypeRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.name).toLowerCase().includes(q) ||
      String(r.father).toLowerCase().includes(q) ||
      String(r.mobile).includes(q) ||
      String(r.member_no).toLowerCase().includes(q) ||
      String(r.mouzas).toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    area: filtered.reduce((s, r) => s + r.totalArea, 0),
    amount: filtered.reduce((s, r) => s + r.totalAmount, 0),
  }), [filtered]);

  function doExportPdf() {
    exportTablePDF(
      tx(`Cultivation History — ${seasonName}`, `চাষাবাদের তথ্য — ${seasonName}`),
      ["ID", "নাম", "পিতা", "মোবাইল", "মৌজা", "বিবরণ", "রেট/শতক", "জমি (শতক)", "টাকা"],
      filtered.map((r) => [r.member_no, r.name, r.father, r.mobile, r.mouzas, r.particulars, r.rateLabel, r.totalArea.toFixed(2), money(r.totalAmount)]),
    );
  }
  function doExportExcel() {
    exportExcel("cultivation-history", "Cultivation", filtered.map((r) => ({
      ID: r.member_no, Name: r.name, Father: r.father, Mobile: r.mobile, Mouza: r.mouzas,
      Particular: r.particulars, Rate_Per_Shotok: r.avgRate,
      Lands: r.landCount, Area_Shotok: r.totalArea, Amount_BDT: r.totalAmount,
    })));
  }

  return (
    <>
      <PageHeader title={tx("Cultivation History", "চাষাবাদের সম্মিলিত তথ্য")} />
      <Card className="p-3 mb-3 grid gap-3 md:grid-cols-4 items-end">
        <div>
          <Label>মৌসুম</Label>
          <Select value={seasonId} onValueChange={setSeasonId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name || `${s.type} ${s.year}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>খুঁজুন</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম / পিতা / মোবাইল / আইডি / মৌজা" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={doExportPdf} disabled={!filtered.length}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={doExportExcel} disabled={!filtered.length}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>আইডি</TableHead>
              <TableHead>কৃষকের নাম</TableHead>
              <TableHead>পিতার নাম</TableHead>
              <TableHead>মোবাইল</TableHead>
              <TableHead>মৌজা</TableHead>
              <TableHead>বিবরণ</TableHead>
              <TableHead className="text-right">রেট/শতক</TableHead>
              <TableHead className="text-right">জমি (শতক)</TableHead>
              <TableHead className="text-right">মোট টাকা</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">কোনো ডেটা নেই</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs font-mono">{r.member_no}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-xs">{r.father}</TableCell>
                <TableCell className="text-xs">{r.mobile}</TableCell>
                <TableCell className="text-xs">{r.mouzas}</TableCell>
                <TableCell className="text-xs">{r.particulars}</TableCell>
                <TableCell className="text-right text-xs">{r.rateLabel}</TableCell>
                <TableCell className="text-right">{r.totalArea.toFixed(2)}</TableCell>
                <TableCell className="text-right">{money(r.totalAmount)}</TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow className="bg-muted/70 font-bold border-t-2">
                <TableCell colSpan={7} className="text-right">সর্বমোট ({filtered.length} জন)</TableCell>
                <TableCell className="text-right">{totals.area.toFixed(2)}</TableCell>
                <TableCell className="text-right">{money(totals.amount)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
