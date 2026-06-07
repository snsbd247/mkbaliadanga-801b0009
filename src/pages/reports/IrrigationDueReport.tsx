import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel, exportCSV } from "@/lib/exports";
import { formatLandSize, shatakToBigha } from "@/lib/irrigationCalc";
import { formatDagNumbers } from "@/lib/dagNumbers";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  father_name: string;
  land_id: string;
  land_label: string;
  patwari_id: string | null;
  patwari_name: string;
  land_size_shatak: number;
  land_size_bigha: number;
  season_id: string;
  season_label: string;
  total: number;
  paid: number;
  due: number;
};

export default function IrrigationDueReport() {
  const { t, tx } = useLang();
  const { isSuper } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [patwaris, setPatwaris] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [seasonId, setSeasonId] = useState<string>("all");
  const [patwariId, setPatwariId] = useState<string>("all");
  const [farmerId, setFarmerId] = useState<string>("all");
  const [genFrom, setGenFrom] = useState<string>("");
  const [genTo, setGenTo] = useState<string>("");
  const [dueFrom, setDueFrom] = useState<string>("");
  const [dueTo, setDueTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [onlyDue, setOnlyDue] = useState<boolean>(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = t("irrigationDueReport");
    Promise.all([
      supabase.from("offices").select("id,name").order("name"),
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("patwaris").select("id,name,name_bn").eq("is_active", true).order("name"),
      supabase.from("farmers").select("id,name_en,name_bn,farmer_code").is("deleted_at", null).order("farmer_code").limit(5000),
    ]).then(([o, s, p, f]) => {
      setOffices(o.data ?? []);
      setSeasons(s.data ?? []);
      setPatwaris(p.data ?? []);
      setFarmers(f.data ?? []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("irrigation_invoices").select(
        "farmer_id,land_id,season_id,payable_amount,paid_amount,due_amount,office_id,generated_at,due_date," +
        "farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn,farmer_code,father_name)," +
        "lands(mouza,dag_no,land_size,patwari_id,patwaris(name,name_bn))," +
        "seasons(name,year,type)"
      ).is("deleted_at", null).neq("invoice_status", "cancelled").limit(10000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      if (farmerId !== "all") q = q.eq("farmer_id", farmerId);
      if (genFrom) q = q.gte("generated_at", genFrom);
      if (genTo) q = q.lte("generated_at", `${genTo}T23:59:59`);
      if (dueFrom) q = q.gte("due_date", dueFrom);
      if (dueTo) q = q.lte("due_date", dueTo);
      const { data, error } = await q;
      if (cancelled) return;
      setLoading(false);
      if (error) return;
      const grouped = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        if (patwariId !== "all" && r.lands?.patwari_id !== patwariId) return;
        const key = `${r.farmer_id}|${r.land_id}|${r.season_id}`;
        const shatak = Number(r.lands?.land_size ?? 0);
        const pw = r.lands?.patwaris;
        const cur = grouped.get(key) ?? {
          farmer_id: r.farmer_id,
          farmer_name: r.farmers?.name_bn || r.farmers?.name_en || "—",
          farmer_code: r.farmers?.farmer_code ?? "—",
          father_name: r.farmers?.father_name ?? "",
          land_id: r.land_id,
          land_label: [r.lands?.mouza, r.lands?.dag_no ? `Dag ${formatDagNumbers(r.lands.dag_no)}` : null, r.lands?.land_size != null ? formatLandSize(r.lands.land_size, "short") : null].filter(Boolean).join(" • ") || "—",
          patwari_id: r.lands?.patwari_id ?? null,
          patwari_name: pw ? (pw.name_bn || pw.name) : "—",
          land_size_shatak: shatak,
          land_size_bigha: shatakToBigha(shatak),
          season_id: r.season_id,
          season_label: r.seasons ? `${r.seasons.name ?? r.seasons.type} ${r.seasons.year}` : "—",
          total: 0, paid: 0, due: 0,
        };
        cur.total += Number(r.payable_amount || 0);
        cur.paid += Number(r.paid_amount || 0);
        cur.due += Number(r.due_amount || 0);
        grouped.set(key, cur);
      });
      setRows(Array.from(grouped.values()));
    })();
    return () => { cancelled = true; };
  }, [officeId, seasonId, patwariId, farmerId, genFrom, genTo, dueFrom, dueTo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyDue && r.due <= 0) return false;
      if (!s) return true;
      return (
        r.farmer_name.toLowerCase().includes(s) ||
        r.farmer_code.toLowerCase().includes(s) ||
        r.land_label.toLowerCase().includes(s) ||
        r.patwari_name.toLowerCase().includes(s)
      );
    }).sort((a, b) => b.due - a.due);
  }, [rows, search, onlyDue]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ total: a.total + r.total, paid: a.paid + r.paid, due: a.due + r.due }),
    { total: 0, paid: 0, due: 0 },
  ), [filtered]);

  const head = [t("farmerCode"), t("farmer"), "Land", tx("Patwari", "পাটুয়ারি"), "Bigha", "Shatak", t("season"), t("total"), t("paid"), t("dueAmount")];
  const body = filtered.map((r) => [r.farmer_code, r.farmer_name, r.land_label, r.patwari_name, r.land_size_bigha.toFixed(2), r.land_size_shatak.toFixed(2), r.season_label, money(r.total), money(r.paid), money(r.due)]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("irrigationDueReport")}
        description={t("irrigationDueReportDesc")}
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-4">
          {isSuper && (
            <div>
              <Label>{t("office")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allOffices")}</SelectItem>
                  {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{t("season")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSeasons")}</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Patwari", "পাটুয়ারি")}</Label>
            <Select value={patwariId} onValueChange={setPatwariId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All patwaris", "সকল পাটুয়ারি")}</SelectItem>
                {patwaris.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn || p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Farmer", "কৃষক")}</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">{tx("All farmers", "সকল কৃষক")}</SelectItem>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_bn || f.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Generated from", "তৈরি হয়েছে (থেকে)")}</Label>
            <Input type="date" value={genFrom} onChange={(e) => setGenFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Generated to", "তৈরি হয়েছে (পর্যন্ত)")}</Label>
            <Input type="date" value={genTo} onChange={(e) => setGenTo(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Due from", "ডিউ ডেট (থেকে)")}</Label>
            <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Due to", "ডিউ ডেট (পর্যন্ত)")}</Label>
            <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label>{t("searchFarmerLand")}</Label>
            <Input placeholder={t("searchFarmerLandPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={onlyDue} onCheckedChange={setOnlyDue} id="onlydue" />
            <Label htmlFor="onlydue">{t("onlyWithDue")}</Label>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => { setOfficeId("all"); setSeasonId("all"); setPatwariId("all"); setFarmerId("all"); setGenFrom(""); setGenTo(""); setDueFrom(""); setDueTo(""); setSearch(""); }}>
              {tx("Reset filters", "ফিল্টার রিসেট")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{filtered.length} {t("rows")} {loading && `(${t("loading")})`}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF("Irrigation-Due", head, body)}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(
                "Irrigation-Due", head, body,
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportExcel(
                "Irrigation-Due", "Due",
                filtered.map((r) => ({
                  "Farmer Code": r.farmer_code, "Farmer": r.farmer_name,
                  "Land": r.land_label, "Patwari": r.patwari_name,
                  "Bigha": Number(r.land_size_bigha.toFixed(2)),
                  "Shatak": Number(r.land_size_shatak.toFixed(2)),
                  "Season": r.season_label,
                  "Total": r.total, "Paid": r.paid, "Due": r.due,
                })),
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("farmer")}</TableHead>
                <TableHead>{t("land")}</TableHead>
                <TableHead>{tx("Patwari", "পাটুয়ারি")}</TableHead>
                <TableHead>{t("season")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="text-right">{t("paid")}</TableHead>
                <TableHead className="text-right">{t("dueAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.farmer_code}</TableCell>
                  <TableCell>{r.farmer_name}</TableCell>
                  <TableCell className="text-xs">{r.land_label}</TableCell>
                  <TableCell className="text-xs">{r.patwari_name}</TableCell>
                  <TableCell className="text-xs">{r.season_label}</TableCell>
                  <TableCell className="text-right">{money(r.total)}</TableCell>
                  <TableCell className="text-right">{money(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due)}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div>{t("total")}: <span className="font-semibold">{money(totals.total)}</span></div>
              <div>{t("paid")}: <span className="font-semibold text-success">{money(totals.paid)}</span></div>
              <div>{t("dueAmount")}: <span className="font-semibold text-destructive">{money(totals.due)}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}