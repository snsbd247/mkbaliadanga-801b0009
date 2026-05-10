import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileBarChart2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv, type CsvColumn } from "@/lib/csvExport";
import { statusLabel } from "./AssetItems";
import { toast } from "sonner";

type DateRange = { from: string; to: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

function ExportBtn<T>({ rows, columns, name }: { rows: T[]; columns: CsvColumn<T>[]; name: string }) {
  const { tx } = useLang();
  return (
    <Button variant="outline" size="sm" onClick={() => {
      if (!rows.length) { toast.info(tx("No rows to export", "এক্সপোর্ট করার মতো কিছু নেই")); return; }
      downloadCsv(`${name}-${todayISO()}.csv`, rows, columns);
    }}>
      <Download className="h-4 w-4 mr-1" />CSV
    </Button>
  );
}

export default function AssetReports() {
  const { tx } = useLang();
  const [range, setRange] = useState<DateRange>({ from: monthStartISO(), to: todayISO() });
  const [tab, setTab] = useState<string>("register");

  // datasets
  const [register, setRegister] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, { code: string; name: string }>>({});

  useEffect(() => { document.title = tx("Asset Reports", "এসেট রিপোর্ট"); }, [tx]);

  useEffect(() => {
    (async () => {
      const a = await supabase.from("assets" as any)
        .select("id,asset_code,name_en,name_bn,serial_no,tracking_mode,current_status,purchase_price,unit")
        .is("deleted_at", null).order("asset_code");
      if (!a.error && a.data) {
        setRegister(a.data as any[]);
        const map: any = {};
        for (const r of a.data as any[]) map[r.id] = { code: r.asset_code, name: r.name_en || r.name_bn || "" };
        setAssetMap(map);
      }
      const s = await supabase.from("asset_stocks" as any).select("*");
      if (!s.error) setStocks((s.data as any[]) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const between = (q: any, col: string) => q.gte(col, range.from).lte(col, range.to);

      const m = await between(supabase.from("asset_movements" as any).select("*").order("movement_date", { ascending: false }), "movement_date");
      if (!m.error) setMovements((m.data as any[]) || []);

      const mn = await between(supabase.from("asset_maintenance_logs" as any).select("*").order("started_at", { ascending: false }), "started_at");
      if (!mn.error) setMaintenance((mn.data as any[]) || []);

      const d = await between(supabase.from("asset_disposals" as any).select("*").order("disposal_date", { ascending: false }), "disposal_date");
      if (!d.error) setDisposals((d.data as any[]) || []);

      const au = await supabase.from("asset_audit_logs" as any).select("*")
        .gte("created_at", `${range.from}T00:00:00`).lte("created_at", `${range.to}T23:59:59`)
        .order("created_at", { ascending: false }).limit(500);
      if (!au.error) setAudits((au.data as any[]) || []);
    })();
  }, [range.from, range.to]);

  const assetLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = assetMap[id]; return a ? `${a.code} · ${a.name}` : id.slice(0, 8);
  };

  const disposalTotals = useMemo(() => {
    let sale = 0, book = 0, gl = 0;
    for (const r of disposals) {
      sale += Number(r.sale_amount || 0);
      book += Number(r.book_value || 0);
      gl += Number(r.gain_loss || 0);
    }
    return { sale, book, gl };
  }, [disposals]);

  const registerCols: CsvColumn<any>[] = [
    { header: "Asset Code", accessor: r => r.asset_code },
    { header: "Name (EN)", accessor: r => r.name_en },
    { header: "Name (BN)", accessor: r => r.name_bn },
    { header: "Serial", accessor: r => r.serial_no },
    { header: "Tracking", accessor: r => r.tracking_mode },
    { header: "Status", accessor: r => r.current_status },
    { header: "Unit", accessor: r => r.unit },
    { header: "Purchase Price", accessor: r => r.purchase_price },
  ];
  const stockCols: CsvColumn<any>[] = [
    { header: "Asset", accessor: r => assetLabel(r.asset_id) },
    { header: "Location ID", accessor: r => r.location_id },
    { header: "Quantity", accessor: r => r.quantity },
  ];
  const moveCols: CsvColumn<any>[] = [
    { header: "Date", accessor: r => r.movement_date },
    { header: "Asset", accessor: r => assetLabel(r.asset_id) },
    { header: "From", accessor: r => r.from_location_id },
    { header: "To", accessor: r => r.to_location_id },
    { header: "Qty", accessor: r => r.quantity },
    { header: "Remarks", accessor: r => r.remarks },
  ];
  const maintCols: CsvColumn<any>[] = [
    { header: "Started", accessor: r => r.started_at },
    { header: "Ended", accessor: r => r.ended_at },
    { header: "Asset", accessor: r => assetLabel(r.asset_id) },
    { header: "Vendor", accessor: r => r.vendor },
    { header: "Cost", accessor: r => r.cost },
    { header: "Status", accessor: r => r.status },
    { header: "Remarks", accessor: r => r.remarks },
  ];
  const dispCols: CsvColumn<any>[] = [
    { header: "Date", accessor: r => r.disposal_date },
    { header: "Asset", accessor: r => assetLabel(r.asset_id) },
    { header: "Method", accessor: r => r.method },
    { header: "Sale Amount", accessor: r => r.sale_amount },
    { header: "Book Value", accessor: r => r.book_value },
    { header: "Gain/Loss", accessor: r => r.gain_loss },
    { header: "Remarks", accessor: r => r.remarks },
  ];
  const auditCols: CsvColumn<any>[] = [
    { header: "Time", accessor: r => r.created_at },
    { header: "Entity", accessor: r => r.entity },
    { header: "Action", accessor: r => r.action_type },
    { header: "Asset", accessor: r => assetLabel(r.asset_id) },
    { header: "Remarks", accessor: r => r.remarks },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Asset Reports", "এসেট রিপোর্ট")} actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/assets/dashboard"><FileBarChart2 className="h-4 w-4 mr-1" />{tx("Dashboard", "ড্যাশবোর্ড")}</Link>
        </Button>
      } />

      <Card className="p-3 flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">{tx("From", "শুরু")}</Label>
          <Input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">{tx("To", "শেষ")}</Label>
          <Input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="register">{tx("Register", "রেজিস্টার")}</TabsTrigger>
          <TabsTrigger value="stock">{tx("Stock", "স্টক")}</TabsTrigger>
          <TabsTrigger value="movement">{tx("Movement", "স্থানান্তর")}</TabsTrigger>
          <TabsTrigger value="maintenance">{tx("Maintenance", "মেরামত")}</TabsTrigger>
          <TabsTrigger value="disposal">{tx("Disposal P/L", "নিষ্পত্তি লাভ/ক্ষতি")}</TabsTrigger>
          <TabsTrigger value="audit">{tx("Audit", "অডিট")}</TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{register.length} {tx("assets", "এসেট")}</div>
              <ExportBtn rows={register} columns={registerCols} name="asset-register" />
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Code", "কোড")}</TableHead>
                  <TableHead>{tx("Name", "নাম")}</TableHead>
                  <TableHead>{tx("Serial", "সিরিয়াল")}</TableHead>
                  <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                  <TableHead className="text-right">{tx("Price", "মূল্য")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {register.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.asset_code}</TableCell>
                      <TableCell>{r.name_bn || r.name_en}</TableCell>
                      <TableCell className="font-mono text-xs">{r.serial_no || "—"}</TableCell>
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
              <div className="text-sm text-muted-foreground">{stocks.length} {tx("rows", "সারি")}</div>
              <ExportBtn rows={stocks} columns={stockCols} name="asset-stock" />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Location", "অবস্থান")}</TableHead>
                <TableHead className="text-right">{tx("Qty", "পরিমাণ")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {stocks.map((r: any) => (
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
              <div className="text-sm text-muted-foreground">{movements.length} {tx("rows", "সারি")}</div>
              <ExportBtn rows={movements} columns={moveCols} name="asset-movement" />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead className="text-right">{tx("Qty", "পরিমাণ")}</TableHead>
                <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.map((r: any) => (
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

        <TabsContent value="maintenance">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{maintenance.length} {tx("rows", "সারি")}</div>
              <ExportBtn rows={maintenance} columns={maintCols} name="asset-maintenance" />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Started", "শুরু")}</TableHead>
                <TableHead>{tx("Asset", "এসেট")}</TableHead>
                <TableHead>{tx("Vendor", "বিক্রেতা")}</TableHead>
                <TableHead className="text-right">{tx("Cost", "খরচ")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {maintenance.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.started_at}</TableCell>
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

        <TabsContent value="disposal">
          <Card className="p-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Sale Total", "মোট বিক্রয়")}</div><div className="text-lg font-semibold">৳ {disposalTotals.sale.toLocaleString()}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Book Value", "বহি মূল্য")}</div><div className="text-lg font-semibold">৳ {disposalTotals.book.toLocaleString()}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Net Gain/Loss", "নেট লাভ/ক্ষতি")}</div><div className={`text-lg font-semibold ${disposalTotals.gl >= 0 ? "text-emerald-600" : "text-destructive"}`}>৳ {disposalTotals.gl.toLocaleString()}</div></Card>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">{disposals.length} {tx("rows", "সারি")}</div>
              <ExportBtn rows={disposals} columns={dispCols} name="asset-disposal" />
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
                {disposals.map((r: any) => (
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

        <TabsContent value="audit">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-muted-foreground">{audits.length} {tx("entries", "এন্ট্রি")}</div>
              <ExportBtn rows={audits} columns={auditCols} name="asset-audit" />
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
                {audits.map((r: any) => (
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
