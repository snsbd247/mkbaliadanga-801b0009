import { resolveMouzaName } from "@/lib/mouzaQuery";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
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
import { isLaravelBackend } from "@/lib/backend";

type Row = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  father_name: string;
  village: string;
  mobile: string;
  land_id: string;
  land_label: string;
  mouza: string;
  dag: string;
  patwari_id: string | null;
  patwari_name: string;
  owner_name: string;
  owner_code: string;
  owner_father: string;
  owner_village: string;
  owner_mobile: string;
  land_size_shatak: number;
  land_size_bigha: number;
  season_id: string;
  season_label: string;
  season_type: string;
  total: number;
  paid: number;
  due: number;
};

const uniq = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((v) => (v ?? "").toString()).filter(Boolean)));

const chunk = <T,>(items: T[], size = 500): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const parseFilterDate = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const parts = iso
    ? { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
    : dmy
      ? { y: Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) }
      : null;
  if (!parts || parts.m < 1 || parts.m > 12 || parts.d < 1 || parts.d > 31) return null;
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  if (dt.getUTCFullYear() !== parts.y || dt.getUTCMonth() !== parts.m - 1 || dt.getUTCDate() !== parts.d) return null;
  return `${parts.y.toString().padStart(4, "0")}-${parts.m.toString().padStart(2, "0")}-${parts.d.toString().padStart(2, "0")}`;
};

const dateOnly = (value: unknown): string => {
  const text = (value ?? "").toString();
  const m = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
};

async function fetchByIds(table: string, ids: string[], select: string) {
  const rows: any[] = [];
  for (const part of chunk(uniq(ids))) {
    const { data } = await db.from(table).select(select).in("id", part);
    rows.push(...((data as any[]) ?? []));
  }
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

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
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    document.title = t("irrigationDueReport");
    Promise.all([
      db.from("offices").select("id,name").order("name"),
      db.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      db.from("patwaris").select("id,name,name_bn").eq("is_active", true).order("name"),
      db.from("farmers").select("id,name_en,name_bn,farmer_code").is("deleted_at", null).order("farmer_code").limit(5000),
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
    setErrorMessage("");
    (async () => {
      const parsedGenFrom = parseFilterDate(genFrom);
      const parsedGenTo = parseFilterDate(genTo);
      const parsedDueFrom = parseFilterDate(dueFrom);
      const parsedDueTo = parseFilterDate(dueTo);
      const invoiceSelect = isLaravelBackend
        ? "id,farmer_id,land_id,season_id,payable_amount,amount,paid_amount,due_amount,office_id,generated_at,issue_date,created_at,due_date,invoice_status,status,deleted_at"
        : "id,farmer_id,land_id,season_id,payable_amount,paid_amount,due_amount,office_id,generated_at,created_at,due_date,invoice_status,deleted_at";
      let q = db.from("irrigation_invoices").select(invoiceSelect).is("deleted_at", null).neq("invoice_status", "cancelled").limit(10000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      if (farmerId !== "all") q = q.eq("farmer_id", farmerId);
      if (parsedDueFrom) q = q.gte("due_date", parsedDueFrom);
      if (parsedDueTo) q = q.lte("due_date", parsedDueTo);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setLoading(false);
        setRows([]);
        setErrorMessage(error.message || tx("Data could not be loaded", "ডাটা লোড করা যায়নি"));
        return;
      }

      const invoiceRows = ((data as any[]) ?? []).filter((r) => {
        if ((r.invoice_status ?? r.status) === "cancelled") return false;
        const generated = dateOnly(r.generated_at) || dateOnly(r.issue_date) || dateOnly(r.created_at);
        if (parsedGenFrom && (!generated || generated < parsedGenFrom)) return false;
        if (parsedGenTo && (!generated || generated > parsedGenTo)) return false;
        const due = dateOnly(r.due_date);
        if (parsedDueFrom && (!due || due < parsedDueFrom)) return false;
        if (parsedDueTo && (!due || due > parsedDueTo)) return false;
        return true;
      });

      const farmerSelect = isLaravelBackend
        ? "id,name,name_en,name_bn,farmer_code,member_no,code,father_name,village,mobile,phone"
        : "id,name_en,name_bn,farmer_code,member_no,father_name,village,mobile";
      const [farmerById, landById, seasonById] = await Promise.all([
        fetchByIds("farmers", invoiceRows.map((r) => r.farmer_id), farmerSelect),
        fetchByIds("lands", invoiceRows.map((r) => r.land_id), isLaravelBackend
          ? "id,mouza,mouza_id,dag_no,dag_numbers,land_size,area_decimal,patwari_id,owner_farmer_id,deleted_at"
          : "id,mouza,mouza_id,dag_no,dag_numbers,land_size,patwari_id,owner_farmer_id,deleted_at"),
        fetchByIds("seasons", invoiceRows.map((r) => r.season_id), "id,name,year,type"),
      ]);

      const lands = Object.values(landById) as any[];
      const [mouzaById, patwariById, ownerById] = await Promise.all([
        fetchByIds("mouzas", lands.map((l) => l.mouza_id), "id,name,name_bn"),
        fetchByIds("patwaris", lands.map((l) => l.patwari_id), "id,name,name_bn"),
        fetchByIds("farmers", lands.map((l) => l.owner_farmer_id), farmerSelect),
      ]);

      const grouped = new Map<string, Row>();
      invoiceRows.forEach((r: any) => {
        const land = landById[r.land_id] ?? null;
        if (land?.deleted_at) return;
        if (patwariId !== "all" && land?.patwari_id !== patwariId) return;
        const farmer = farmerById[r.farmer_id] ?? null;
        const season = seasonById[r.season_id] ?? null;
        const mouza = land?.mouza_id ? mouzaById[land.mouza_id] ?? null : null;
        const landWithMouza = land ? { ...land, mouzas: mouza } : null;
        const pw = land?.patwari_id ? patwariById[land.patwari_id] : null;
        const own = land?.owner_farmer_id ? ownerById[land.owner_farmer_id] : null;
        const key = `${r.farmer_id}|${r.land_id}|${r.season_id}`;
        const shatak = Number(land?.land_size ?? land?.area_decimal ?? 0);
        const dag = land?.dag_no ? formatDagNumbers(land.dag_no) : (land?.dag_numbers ? formatDagNumbers(land.dag_numbers) : "");
        const resolvedMouza = resolveMouzaName(landWithMouza) || land?.mouza || "";
        const cur = grouped.get(key) ?? {
          farmer_id: r.farmer_id,
          farmer_name: farmer?.name_bn || farmer?.name_en || farmer?.name || "—",
          farmer_code: farmer?.farmer_code || farmer?.member_no || farmer?.code || "—",
          father_name: farmer?.father_name ?? "",
          village: farmer?.village ?? "",
          mobile: farmer?.mobile || farmer?.phone || "",
          land_id: r.land_id,
          land_label: [resolvedMouza, dag ? `Dag ${dag}` : null, shatak ? formatLandSize(shatak, "short") : null].filter(Boolean).join(" • ") || "—",
          mouza: resolvedMouza,
          dag,
          patwari_id: land?.patwari_id ?? null,
          patwari_name: pw ? (pw.name_bn || pw.name) : "—",
          owner_name: own ? (own.name_bn || own.name_en || own.name || "") : "",
          owner_code: own?.farmer_code || own?.member_no || own?.code || "",
          owner_father: own?.father_name ?? "",
          owner_village: own?.village ?? "",
          owner_mobile: own?.mobile || own?.phone || "",
          land_size_shatak: shatak,
          land_size_bigha: shatakToBigha(shatak),
          season_id: r.season_id,
          season_label: season ? `${season.name ?? season.type} ${season.year}` : "—",
          season_type: season?.type ?? "",
          total: 0, paid: 0, due: 0,
        };
        cur.total += Number(r.payable_amount ?? r.amount ?? (Number(r.paid_amount || 0) + Number(r.due_amount || 0)));
        cur.paid += Number(r.paid_amount || 0);
        cur.due += Number(r.due_amount || 0);
        grouped.set(key, cur);
      });
      setRows(Array.from(grouped.values()));
      setLoading(false);
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
        (r.father_name || "").toLowerCase().includes(s) ||
        r.land_label.toLowerCase().includes(s) ||
        r.mouza.toLowerCase().includes(s) ||
        r.dag.toLowerCase().includes(s) ||
        (r.owner_name || "").toLowerCase().includes(s) ||
        (r.season_label || "").toLowerCase().includes(s) ||
        r.patwari_name.toLowerCase().includes(s)
      );
    }).sort((a, b) => b.due - a.due);
  }, [rows, search, onlyDue]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ total: a.total + r.total, paid: a.paid + r.paid, due: a.due + r.due }),
    { total: 0, paid: 0, due: 0 },
  ), [filtered]);

  const head = [
    t("farmerCode"), t("farmer"), tx("Father", "পিতার নাম"), tx("Village", "গ্রাম"), tx("Mobile", "মোবাইল"),
    tx("Mouza", "মৌজা"), tx("Dag", "দাগ"), tx("Type", "টাইপ"), t("season"), "Bigha", "Shatak",
    t("total"), t("paid"), t("dueAmount"),
    tx("Owner", "মালিক"), tx("Owner ID", "মালিক আইডি"), tx("Owner father", "মালিকের পিতা"),
    tx("Owner village", "মালিকের গ্রাম"), tx("Owner mobile", "মালিকের মোবাইল"), tx("Patwari", "পাটুয়ারি"),
  ];
  const body = filtered.map((r) => [
    r.farmer_code, r.farmer_name, r.father_name || "—", r.village || "—", r.mobile || "—",
    r.mouza || "—", r.dag || "—", r.season_type || "—", r.season_label, r.land_size_bigha.toFixed(2), r.land_size_shatak.toFixed(2),
    money(r.total), money(r.paid), money(r.due),
    r.owner_name || "—", r.owner_code || "—", r.owner_father || "—", r.owner_village || "—", r.owner_mobile || "—", r.patwari_name,
  ]);

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
            <p className="text-sm text-muted-foreground">{errorMessage || `${filtered.length} ${t("rows")} ${loading ? `(${t("loading")})` : ""}`}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF("Irrigation-Due", head, body, { from: dueFrom, to: dueTo }, { landscape: true, preview: true })}>
                <FileDown className="mr-1 h-4 w-4" /> {tx("Preview (A4)", "প্রিভিউ (A4)")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTablePDF("Irrigation-Due", head, body, { from: dueFrom, to: dueTo }, { landscape: true })}>
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
                  "Father": r.father_name, "Village": r.village, "Mobile": r.mobile,
                  "Mouza": r.mouza, "Dag": r.dag, "Type": r.season_type, "Season": r.season_label,
                  "Bigha": Number(r.land_size_bigha.toFixed(2)),
                  "Shatak": Number(r.land_size_shatak.toFixed(2)),
                  "Total": r.total, "Paid": r.paid, "Due": r.due,
                  "Owner": r.owner_name, "Owner ID": r.owner_code, "Owner Father": r.owner_father,
                  "Owner Village": r.owner_village, "Owner Mobile": r.owner_mobile, "Patwari": r.patwari_name,
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
                <TableHead>{tx("Father", "পিতার নাম")}</TableHead>
                <TableHead>{tx("Village", "গ্রাম")}</TableHead>
                <TableHead>{tx("Mobile", "মোবাইল")}</TableHead>
                <TableHead>{t("land")}</TableHead>
                <TableHead>{tx("Owner", "মালিক")}</TableHead>
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
                  <TableCell className="text-xs">{r.father_name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.village || "—"}</TableCell>
                  <TableCell className="text-xs">{r.mobile || "—"}</TableCell>
                  <TableCell className="text-xs">{r.land_label}</TableCell>
                  <TableCell className="text-xs">{r.owner_name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.patwari_name}</TableCell>
                  <TableCell className="text-xs">{r.season_label}</TableCell>
                  <TableCell className="text-right">{money(r.total)}</TableCell>
                  <TableCell className="text-right">{money(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due)}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
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