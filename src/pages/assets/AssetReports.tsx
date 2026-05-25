import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileBarChart2, FileSpreadsheet, FileText } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv, type CsvColumn } from "@/lib/csvExport";
import { exportExcel, exportTablePDF } from "@/lib/exports";
import { statusLabel, assetTypeLabel, type AssetType } from "./AssetItems";
import { toast } from "sonner";

type DateRange = { from: string; to: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

/** Tri-format export bar — CSV / Excel / PDF — using the project's shared helpers. */
function ExportBar<T>({ rows, columns, name, range }: { rows: T[]; columns: CsvColumn<T>[]; name: string; range?: DateRange }) {
  const { tx } = useLang();
  const guard = () => {
    if (!rows.length) { toast.info(tx("No rows to export", "এক্সপোর্ট করার মতো কিছু নেই")); return false; }
    return true;
  };
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => guard() && downloadCsv(`${name}-${todayISO()}.csv`, rows, columns)}>
        <Download className="h-4 w-4 mr-1" />CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => {
        if (!guard()) return;
        const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.header, c.accessor(r) ?? ""])));
        exportExcel(name, name.slice(0, 28), data, range);
      }}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => {
        if (!guard()) return;
        const head = columns.map((c) => c.header);
        const body = rows.map((r) => columns.map((c) => c.accessor(r) ?? ""));
        exportTablePDF(name, head, body, range);
      }}>
        <FileText className="h-4 w-4 mr-1" />PDF
      </Button>
    </div>
  );
}

export default function AssetReports() {
  const { tx } = useLang();
  const [range, setRange] = useState<DateRange>({ from: monthStartISO(), to: todayISO() });
  const [tab, setTab] = useState<string>("register");

  // filters
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // datasets
  const [register, setRegister] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [installs, setInstalls] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [damages, setDamages] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [depreciation, setDepreciation] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);

  // lookups
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; code: string; name_en: string; name_bn: string | null }[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, { code: string; name: string; office_id: string | null; cat: string | null; type: AssetType; status: string }>>({});

  useEffect(() => { document.title = tx("Asset Reports", "এসেট রিপোর্ট"); }, [tx]);

  useEffect(() => {
    (async () => {
      const [a, s, o, c] = await Promise.all([
        supabase.from("assets" as any)
          .select("id,office_id,asset_category_id,asset_code,name_en,name_bn,serial_no,tracking_mode,current_status,asset_type,purchase_price,unit")
          .is("deleted_at", null).order("asset_code"),
        supabase.from("asset_stocks" as any).select("*"),
        supabase.from("offices").select("id,name").order("name"),
        supabase.from("asset_categories" as any).select("id,code,name_en,name_bn").is("deleted_at", null).order("code"),
      ]);
      if (!a.error && a.data) {
        setRegister(a.data as any[]);
        const map: any = {};
        for (const r of a.data as any[]) map[r.id] = {
          code: r.asset_code, name: r.name_bn || r.name_en || "",
          office_id: r.office_id, cat: r.asset_category_id, type: r.asset_type, status: r.current_status,
        };
        setAssetMap(map);
      }
      if (!s.error) setStocks((s.data as any[]) || []);
      if (!o.error) setOffices((o.data as any[]) || []);
      if (!c.error) setCats((c.data as any[]) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const between = (q: any, col: string) => q.gte(col, range.from).lte(col, range.to);
      const [m, ins, mn, dm, d, dep, au] = await Promise.all([
        between(supabase.from("asset_movements" as any).select("*").is("deleted_at", null).order("movement_date", { ascending: false }), "movement_date"),
        between(supabase.from("asset_installations" as any).select("*").is("deleted_at", null).order("install_date", { ascending: false }), "install_date"),
        between(supabase.from("asset_maintenance_logs" as any).select("*").is("deleted_at", null).order("maintenance_date", { ascending: false }), "maintenance_date"),
        between(supabase.from("asset_damage_reports" as any).select("*").is("deleted_at", null).order("report_date", { ascending: false }), "report_date"),
        between(supabase.from("asset_disposals" as any).select("*").is("deleted_at", null).order("disposal_date", { ascending: false }), "disposal_date"),
        between(supabase.from("asset_depreciation_schedule" as any).select("*").order("period_month", { ascending: false }), "period_month"),
        supabase.from("asset_audit_logs" as any).select("*")
          .gte("created_at", `${range.from}T00:00:00`).lte("created_at", `${range.to}T23:59:59`)
          .order("created_at", { ascending: false }).limit(500),
      ]);
      if (!m.error) setMovements((m.data as any[]) || []);
      if (!ins.error) setInstalls((ins.data as any[]) || []);
      if (!mn.error) setMaintenance((mn.data as any[]) || []);
      if (!dm.error) setDamages((dm.data as any[]) || []);
      if (!d.error) setDisposals((d.data as any[]) || []);
      if (!dep.error) setDepreciation((dep.data as any[]) || []);
      if (!au.error) setAudits((au.data as any[]) || []);
    })();
  }, [range.from, range.to]);

  const officeName = (id?: string | null) => offices.find((o) => o.id === id)?.name ?? "—";
  const catName = (id?: string | null) => {
    const c = cats.find((x) => x.id === id); return c ? (c.name_bn || c.name_en) : "—";
  };
  const assetLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = assetMap[id]; return a ? `${a.code} · ${a.name}` : id.slice(0, 8);
  };

  /** Filter helper that matches an asset row against the active filter chips. */
  const passAsset = (a?: { office_id: string | null; cat: string | null; type: AssetType; status: string } | null) => {
    if (!a) return true;
    if (officeFilter !== "all" && a.office_id !== officeFilter) return false;
    if (catFilter !== "all" && a.cat !== catFilter) return false;
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  };
  const passById = (asset_id?: string | null) => {
    if (!asset_id) return officeFilter === "all" && catFilter === "all" && typeFilter === "all" && statusFilter === "all";
    return passAsset(assetMap[asset_id]);
  };

  const fRegister = useMemo(() => register.filter((r: any) => passAsset({ office_id: r.office_id, cat: r.asset_category_id, type: r.asset_type, status: r.current_status })), [register, officeFilter, catFilter, typeFilter, statusFilter]);
  const fStocks = useMemo(() => stocks.filter((r: any) => passById(r.asset_id)), [stocks, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fMovements = useMemo(() => movements.filter((r: any) => passById(r.asset_id)), [movements, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fInstalls = useMemo(() => installs.filter((r: any) => passById(r.asset_id)), [installs, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fMaint = useMemo(() => maintenance.filter((r: any) => passById(r.asset_id)), [maintenance, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fDamages = useMemo(() => damages.filter((r: any) => passById(r.asset_id)), [damages, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fDisposals = useMemo(() => disposals.filter((r: any) => passById(r.asset_id)), [disposals, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fDepreciation = useMemo(() => depreciation.filter((r: any) => passById(r.asset_id)), [depreciation, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);
  const fAudits = useMemo(() => audits.filter((r: any) => passById(r.asset_id)), [audits, assetMap, officeFilter, catFilter, typeFilter, statusFilter]);

  // Valuation = current book value snapshot (purchase_price − latest accumulated depreciation per asset).
  const valuation = useMemo(() => {
    const accum: Record<string, number> = {};
    for (const r of depreciation) {
      const cur = accum[r.asset_id] ?? 0;
      const v = Number(r.accumulated_depreciation || 0);
      if (v > cur) accum[r.asset_id] = v;
    }
    return fRegister.map((r: any) => {
      const purchase = Number(r.purchase_price || 0);
      const acc = accum[r.id] ?? 0;
      const book = Math.max(0, purchase - acc);
      return { ...r, _accumulated: acc, _book: book };
    });
  }, [fRegister, depreciation]);

  const disposalTotals = useMemo(() => {
    let sale = 0, book = 0, gl = 0;
    for (const r of fDisposals) { sale += Number(r.sale_amount || 0); book += Number(r.book_value || 0); gl += Number(r.gain_loss || 0); }
    return { sale, book, gl };
  }, [fDisposals]);

  // ---- column definitions (bilingual headers) ----
  const registerCols: CsvColumn<any>[] = [
    { header: tx("Asset Code", "এসেট কোড"), accessor: (r) => r.asset_code },
    { header: tx("Name (EN)", "নাম (EN)"), accessor: (r) => r.name_en },
    { header: tx("Name (BN)", "নাম (BN)"), accessor: (r) => r.name_bn },
    { header: tx("Type", "ধরন"), accessor: (r) => assetTypeLabel(r.asset_type, tx) },
    { header: tx("Office", "অফিস"), accessor: (r) => officeName(r.office_id) },
    { header: tx("Category", "ক্যাটাগরি"), accessor: (r) => catName(r.asset_category_id) },
    { header: tx("Serial", "সিরিয়াল"), accessor: (r) => r.serial_no },
    { header: tx("Status", "অবস্থা"), accessor: (r) => statusLabel(r.current_status, tx) },
    { header: tx("Unit", "একক"), accessor: (r) => r.unit },
    { header: tx("Purchase Price", "ক্রয়মূল্য"), accessor: (r) => r.purchase_price },
  ];
  const stockCols: CsvColumn<any>[] = [
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Location", "অবস্থান"), accessor: (r) => r.location_id ?? "" },
    { header: tx("Quantity", "পরিমাণ"), accessor: (r) => r.quantity },
  ];
  const moveCols: CsvColumn<any>[] = [
    { header: tx("Date", "তারিখ"), accessor: (r) => r.movement_date },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("From", "থেকে"), accessor: (r) => r.from_location_id },
    { header: tx("To", "প্রতি"), accessor: (r) => r.to_location_id },
    { header: tx("Qty", "পরিমাণ"), accessor: (r) => r.quantity },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks },
  ];
  const installCols: CsvColumn<any>[] = [
    { header: tx("Date", "তারিখ"), accessor: (r) => r.install_date },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Location", "অবস্থান"), accessor: (r) => r.location_name ?? "" },
    { header: tx("Condition", "অবস্থা"), accessor: (r) => r.condition_status ?? "" },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks ?? "" },
  ];
  const maintCols: CsvColumn<any>[] = [
    { header: tx("Date", "তারিখ"), accessor: (r) => r.maintenance_date },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Vendor", "বিক্রেতা"), accessor: (r) => r.vendor },
    { header: tx("Cost", "খরচ"), accessor: (r) => r.cost },
    { header: tx("Downtime (days)", "ডাউনটাইম (দিন)"), accessor: (r) => r.downtime_days },
    { header: tx("Status", "অবস্থা"), accessor: (r) => r.status },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks },
  ];
  const damageCols: CsvColumn<any>[] = [
    { header: tx("Date", "তারিখ"), accessor: (r) => r.report_date },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Severity", "মাত্রা"), accessor: (r) => r.severity },
    { header: tx("Status", "অবস্থা"), accessor: (r) => r.status },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks },
  ];
  const dispCols: CsvColumn<any>[] = [
    { header: tx("Date", "তারিখ"), accessor: (r) => r.disposal_date },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Method", "পদ্ধতি"), accessor: (r) => r.method },
    { header: tx("Sale Amount", "বিক্রয়মূল্য"), accessor: (r) => r.sale_amount },
    { header: tx("Book Value", "বহিমূল্য"), accessor: (r) => r.book_value },
    { header: tx("Gain/Loss", "লাভ/ক্ষতি"), accessor: (r) => r.gain_loss },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks },
  ];
  const depCols: CsvColumn<any>[] = [
    { header: tx("Period", "সময়কাল"), accessor: (r) => r.period_month },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Opening BV", "শুরুর বহিমূল্য"), accessor: (r) => r.opening_book_value },
    { header: tx("Depreciation", "ডিপ্রেসিয়েশন"), accessor: (r) => r.depreciation_amount },
    { header: tx("Accumulated", "জমা"), accessor: (r) => r.accumulated_depreciation },
    { header: tx("Closing BV", "শেষের বহিমূল্য"), accessor: (r) => r.closing_book_value },
    { header: tx("Status", "অবস্থা"), accessor: (r) => r.status },
  ];
  const valCols: CsvColumn<any>[] = [
    { header: tx("Asset Code", "এসেট কোড"), accessor: (r) => r.asset_code },
    { header: tx("Name", "নাম"), accessor: (r) => r.name_bn || r.name_en },
    { header: tx("Office", "অফিস"), accessor: (r) => officeName(r.office_id) },
    { header: tx("Type", "ধরন"), accessor: (r) => assetTypeLabel(r.asset_type, tx) },
    { header: tx("Purchase Price", "ক্রয়মূল্য"), accessor: (r) => r.purchase_price },
    { header: tx("Accum. Depreciation", "জমা ডিপ্রেসিয়েশন"), accessor: (r) => r._accumulated },
    { header: tx("Book Value", "বহিমূল্য"), accessor: (r) => r._book },
  ];
  const auditCols: CsvColumn<any>[] = [
    { header: tx("Time", "সময়"), accessor: (r) => r.created_at },
    { header: tx("Entity", "এন্টিটি"), accessor: (r) => r.entity },
    { header: tx("Action", "কার্যক্রম"), accessor: (r) => r.action_type },
    { header: tx("Asset", "এসেট"), accessor: (r) => assetLabel(r.asset_id) },
    { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks },
  ];

  const allStatuses = ["purchased", "in_stock", "transferred", "installed", "in_use", "maintenance", "damaged", "disposed", "scrapped", "lost"];

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Asset Reports", "এসেট রিপোর্ট")} actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/assets/dashboard"><FileBarChart2 className="h-4 w-4 mr-1" />{tx("Dashboard", "ড্যাশবোর্ড")}</Link>
        </Button>
      } />

      <Card className="p-3 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div>
          <Label className="text-xs">{tx("From", "শুরু")}</Label>
          <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">{tx("To", "শেষ")}</Label>
          <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">{tx("Office", "অফিস")}</Label>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{tx("Category", "ক্যাটাগরি")}</Label>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name_bn || c.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{tx("Type", "ধরন")}</Label>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              <SelectItem value="inventory">{assetTypeLabel("inventory", tx)}</SelectItem>
              <SelectItem value="fixed_asset">{assetTypeLabel("fixed_asset", tx)}</SelectItem>
              <SelectItem value="consumable">{assetTypeLabel("consumable", tx)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{tx("Status", "অবস্থা")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              {allStatuses.map((s) => <SelectItem key={s} value={s}>{statusLabel(s as any, tx)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="register">{tx("Register", "রেজিস্টার")}</TabsTrigger>
          <TabsTrigger value="stock">{tx("Stock", "স্টক")}</TabsTrigger>
          <TabsTrigger value="movement">{tx("Movement", "স্থানান্তর")}</TabsTrigger>
          <TabsTrigger value="install">{tx("Installation", "ইনস্টলেশন")}</TabsTrigger>
          <TabsTrigger value="maintenance">{tx("Maintenance", "মেরামত")}</TabsTrigger>
          <TabsTrigger value="damage">{tx("Damage", "ক্ষতি")}</TabsTrigger>
          <TabsTrigger value="disposal">{tx("Disposal P/L", "নিষ্পত্তি লাভ/ক্ষতি")}</TabsTrigger>
          <TabsTrigger value="depreciation">{tx("Depreciation", "ডিপ্রেসিয়েশন")}</TabsTrigger>
          <TabsTrigger value="valuation">{tx("Valuation", "মূল্যায়ন")}</TabsTrigger>
          <TabsTrigger value="audit">{tx("Audit", "অডিট")}</TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fRegister.length} {tx("assets", "এসেট")}</div>
              <ExportBar rows={fRegister} columns={registerCols} name="asset-register" range={range} />
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Code", "কোড")}</TableHead>
                  <TableHead>{tx("Name", "নাম")}</TableHead>
                  <TableHead>{tx("Type", "ধরন")}</TableHead>
                  <TableHead>{tx("Office", "অফিস")}</TableHead>
                  <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                  <TableHead className="text-right">{tx("Price", "মূল্য")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fRegister.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.asset_code}</TableCell>
                      <TableCell>{r.name_bn || r.name_en}</TableCell>
                      <TableCell><Badge variant="outline">{assetTypeLabel(r.asset_type, tx)}</Badge></TableCell>
                      <TableCell className="text-xs">{officeName(r.office_id)}</TableCell>
                      <TableCell><Badge variant="secondary">{statusLabel(r.current_status, tx)}</Badge></TableCell>
                      <TableCell className="text-right">{Number(r.purchase_price || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fStocks.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fStocks} columns={stockCols} name="asset-stock" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Location", "অবস্থান")}</TableHead>
                <TableHead className="text-right">{tx("Qty", "পরিমাণ")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fStocks.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.location_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="movement">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fMovements.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fMovements} columns={moveCols} name="asset-movement" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead className="text-right">{tx("Qty", "পরিমাণ")}</TableHead>
                <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fMovements.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.movement_date}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="truncate max-w-[240px]">{r.remarks || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="install">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fInstalls.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fInstalls} columns={installCols} name="asset-installation" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Location", "অবস্থান")}</TableHead>
                <TableHead>{tx("Condition", "অবস্থা")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fInstalls.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.install_date}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell>{r.location_name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.condition_status || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fMaint.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fMaint} columns={maintCols} name="asset-maintenance" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Vendor", "বিক্রেতা")}</TableHead>
                <TableHead className="text-right">{tx("Cost", "খরচ")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fMaint.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.maintenance_date}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell>{r.vendor || "—"}</TableCell>
                    <TableCell className="text-right">{Number(r.cost || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="damage">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fDamages.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fDamages} columns={damageCols} name="asset-damage" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Severity", "মাত্রা")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fDamages.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.report_date}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell><Badge variant={r.severity === "critical" ? "destructive" : "outline"}>{r.severity}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="truncate max-w-[240px]">{r.remarks || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="disposal">
          <Card className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Sale Total", "মোট বিক্রয়")}</div><div className="text-lg font-semibold">৳ {disposalTotals.sale.toLocaleString()}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Book Value", "বহি মূল্য")}</div><div className="text-lg font-semibold">৳ {disposalTotals.book.toLocaleString()}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Net Gain/Loss", "নেট লাভ/ক্ষতি")}</div><div className={`text-lg font-semibold ${disposalTotals.gl >= 0 ? "text-emerald-600" : "text-destructive"}`}>৳ {disposalTotals.gl.toLocaleString()}</div></Card>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">{fDisposals.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fDisposals} columns={dispCols} name="asset-disposal" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Method", "পদ্ধতি")}</TableHead>
                <TableHead className="text-right">{tx("Sale", "বিক্রয়")}</TableHead>
                <TableHead className="text-right">{tx("Book", "বহি")}</TableHead>
                <TableHead className="text-right">{tx("G/L", "লাভ/ক্ষতি")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fDisposals.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.disposal_date}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell><Badge variant="secondary">{r.method}</Badge></TableCell>
                    <TableCell className="text-right">{Number(r.sale_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r.book_value || 0).toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${Number(r.gain_loss || 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}>{Number(r.gain_loss || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="depreciation">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fDepreciation.length} {tx("rows", "সারি")}</div>
              <ExportBar rows={fDepreciation} columns={depCols} name="asset-depreciation" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Period", "সময়কাল")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead className="text-right">{tx("Opening BV", "শুরুর বহিমূল্য")}</TableHead>
                <TableHead className="text-right">{tx("Depreciation", "ডিপ্রেসিয়েশন")}</TableHead>
                <TableHead className="text-right">{tx("Closing BV", "শেষের বহিমূল্য")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fDepreciation.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.period_month}</TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell className="text-right">{Number(r.opening_book_value || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r.depreciation_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r.closing_book_value || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={r.status === "posted" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="valuation">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{valuation.length} {tx("assets", "এসেট")}</div>
              <ExportBar rows={valuation} columns={valCols} name="asset-valuation" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Code", "কোড")}</TableHead>
                <TableHead>{tx("Name", "নাম")}</TableHead>
                <TableHead className="text-right">{tx("Purchase", "ক্রয়")}</TableHead>
                <TableHead className="text-right">{tx("Accum.", "জমা")}</TableHead>
                <TableHead className="text-right">{tx("Book Value", "বহিমূল্য")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {valuation.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.asset_code}</TableCell>
                    <TableCell>{r.name_bn || r.name_en}</TableCell>
                    <TableCell className="text-right">{Number(r.purchase_price || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r._accumulated || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r._book || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{fAudits.length} {tx("entries", "এন্ট্রি")}</div>
              <ExportBar rows={fAudits} columns={auditCols} name="asset-audit" range={range} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Time", "সময়")}</TableHead>
                <TableHead>{tx("Entity", "এন্টিটি")}</TableHead>
                <TableHead>{tx("Action", "কার্যক্রম")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fAudits.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{r.entity}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{r.action_type}</Badge></TableCell>
                    <TableCell>{assetLabel(r.asset_id)}</TableCell>
                    <TableCell className="truncate max-w-[240px]">{r.remarks || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
