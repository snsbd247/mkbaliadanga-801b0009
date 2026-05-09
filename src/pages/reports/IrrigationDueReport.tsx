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
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { formatLandSize, shatakToBigha } from "@/lib/irrigationCalc";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  land_id: string;
  land_label: string;
  land_size_shatak: number;
  land_size_bigha: number;
  season_id: string;
  season_label: string;
  total: number;
  paid: number;
  due: number;
};

export default function IrrigationDueReport() {
  const { t } = useLang();
  const { isSuper } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [seasonId, setSeasonId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [onlyDue, setOnlyDue] = useState<boolean>(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = t("irrigationDueReport");
    Promise.all([
      supabase.from("offices").select("id,name").order("name"),
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
    ]).then(([o, s]) => {
      setOffices(o.data ?? []);
      setSeasons(s.data ?? []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("irrigation_charges").select(
        "farmer_id,land_id,season_id,total,paid_amount,due_amount,office_id," +
        "farmers(name_en,farmer_code),lands(mouza,dag_no,land_size),seasons(name,year,type)"
      ).is("deleted_at", null).limit(5000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      const { data, error } = await q;
      if (cancelled) return;
      setLoading(false);
      if (error) return;
      const grouped = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        const key = `${r.farmer_id}|${r.land_id}|${r.season_id}`;
        const cur = grouped.get(key) ?? {
          farmer_id: r.farmer_id,
          farmer_name: r.farmers?.name_en ?? "—",
          farmer_code: r.farmers?.farmer_code ?? "—",
          land_id: r.land_id,
          land_label: [r.lands?.mouza, r.lands?.dag_no ? `Dag ${r.lands.dag_no}` : null, r.lands?.land_size != null ? formatLandSize(r.lands.land_size, "short") : null].filter(Boolean).join(" • ") || "—",
          season_id: r.season_id,
          season_label: r.seasons ? `${r.seasons.name ?? r.seasons.type} ${r.seasons.year}` : "—",
          total: 0, paid: 0, due: 0,
        };
        cur.total += Number(r.total || 0);
        cur.paid += Number(r.paid_amount || 0);
        cur.due += Number(r.due_amount || 0);
        grouped.set(key, cur);
      });
      setRows(Array.from(grouped.values()));
    })();
    return () => { cancelled = true; };
  }, [officeId, seasonId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyDue && r.due <= 0) return false;
      if (!s) return true;
      return (
        r.farmer_name.toLowerCase().includes(s) ||
        r.farmer_code.toLowerCase().includes(s) ||
        r.land_label.toLowerCase().includes(s)
      );
    }).sort((a, b) => b.due - a.due);
  }, [rows, search, onlyDue]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ total: a.total + r.total, paid: a.paid + r.paid, due: a.due + r.due }),
    { total: 0, paid: 0, due: 0 },
  ), [filtered]);

  const head = [t("farmerCode"), t("farmer"), t("land"), t("season"), t("total"), t("paid"), t("dueAmount")];
  const body = filtered.map((r) => [r.farmer_code, r.farmer_name, r.land_label, r.season_label, money(r.total), money(r.paid), money(r.due)]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("irrigationDueReport")}
        description={t("irrigationDueReportDesc")}
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-5">
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
          <div className="lg:col-span-2">
            <Label>{t("searchFarmerLand")}</Label>
            <Input placeholder={t("searchFarmerLandPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={onlyDue} onCheckedChange={setOnlyDue} id="onlydue" />
            <Label htmlFor="onlydue">{t("onlyWithDue")}</Label>
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
              <Button variant="outline" size="sm" onClick={() => exportExcel(
                "Irrigation-Due", "Due",
                filtered.map((r) => ({
                  "Farmer Code": r.farmer_code, "Farmer": r.farmer_name,
                  "Land": r.land_label, "Season": r.season_label,
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
                  <TableCell className="text-xs">{r.season_label}</TableCell>
                  <TableCell className="text-right">{money(r.total)}</TableCell>
                  <TableCell className="text-right">{money(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due)}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
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
