import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel, statusVariant } from "./AssetItems";
import { toast } from "sonner";
import { PurchaseDialog, MovementDialog, InstallationDialog, MaintenanceDialog, DamageDialog, DisposalDialog } from "./AssetActionDialogs";

type Asset = any;

export default function AssetItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { tx } = useLang();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [installs, setInstalls] = useState<any[]>([]);
  const [maint, setMaint] = useState<any[]>([]);
  const [damages, setDamages] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);

  async function load() {
    if (!id) return;
    const a = await supabase.from("assets" as any).select("*").eq("id", id).maybeSingle();
    if (a.error) { toast.error(a.error.message); return; }
    setAsset(a.data);
    document.title = (a.data as any)?.name_en ? `${(a.data as any).name_en} — ${tx("Asset", "এসেট")}` : tx("Asset", "এসেট");

    const orderDesc = { ascending: false } as const;
    const [p, s, m, ins, mn, dm, ds, au] = await Promise.all([
      supabase.from("asset_purchases" as any).select("*").eq("asset_id", id).order("purchase_date", orderDesc),
      supabase.from("asset_stocks" as any).select("*").eq("asset_id", id),
      supabase.from("asset_movements" as any).select("*").eq("asset_id", id).order("created_at", orderDesc),
      supabase.from("asset_installations" as any).select("*").eq("asset_id", id).order("install_date", orderDesc),
      supabase.from("asset_maintenance_logs" as any).select("*").eq("asset_id", id).order("maintenance_date", orderDesc),
      supabase.from("asset_damage_reports" as any).select("*").eq("asset_id", id).order("report_date", orderDesc),
      supabase.from("asset_disposals" as any).select("*").eq("asset_id", id).order("disposal_date", orderDesc),
      supabase.from("asset_audit_logs" as any).select("*").eq("asset_id", id).order("created_at", orderDesc).limit(200),
    ]);
    setPurchases(p.data ?? []);
    setStocks(s.data ?? []);
    setMovements(m.data ?? []);
    setInstalls(ins.data ?? []);
    setMaint(mn.data ?? []);
    setDamages(dm.data ?? []);
    setDisposals(ds.data ?? []);
    setAudits(au.data ?? []);
  }

  useEffect(() => { load(); }, [id]);

  if (!asset) {
    return <div className="p-6 text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</div>;
  }

  const totalStock = stocks.reduce((sum, x) => sum + Number(x.quantity ?? 0), 0);
  const totalMaintCost = maint.reduce((sum, x) => sum + Number(x.cost ?? 0), 0);
  const totalDisposalNet = disposals.reduce((sum, x) => sum + Number(x.gain_loss ?? 0), 0);

  return (
    <>
      <PageHeader
        title={asset.name_bn || asset.name_en}
        description={`${asset.asset_code}${asset.serial_no ? ` · SN: ${asset.serial_no}` : ""}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/assets/items"><ArrowLeft className="h-4 w-4 mr-1" />{tx("Back", "ফিরে যান")}</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{tx("Status", "অবস্থা")}</div>
          <div className="mt-1"><Badge variant={statusVariant(asset.current_status)}>{statusLabel(asset.current_status, tx)}</Badge></div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{tx("Tracking", "ট্র্যাকিং")}</div>
          <div className="mt-1 font-medium capitalize">{asset.tracking_mode === "serial" ? tx("Serial", "সিরিয়াল") : tx("Quantity", "কোয়ান্টিটি")}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{tx("Purchase price", "ক্রয়মূল্য")}</div>
          <div className="mt-1 font-medium">৳ {Number(asset.purchase_price).toLocaleString()}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{tx("Total stock", "মোট স্টক")}</div>
          <div className="mt-1 font-medium">{totalStock.toLocaleString()} {asset.unit ?? ""}</div>
        </Card>
      </div>

      <Tabs defaultValue="purchase">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="purchase">{tx("Purchase", "ক্রয়")}</TabsTrigger>
          <TabsTrigger value="stock">{tx("Stock", "স্টক")}</TabsTrigger>
          <TabsTrigger value="movement">{tx("Movement", "মুভমেন্ট")}</TabsTrigger>
          <TabsTrigger value="install">{tx("Installation", "ইনস্টলেশন")}</TabsTrigger>
          <TabsTrigger value="maint">{tx("Maintenance", "মেরামত")}</TabsTrigger>
          <TabsTrigger value="damage">{tx("Damage", "ক্ষতি")}</TabsTrigger>
          <TabsTrigger value="disposal">{tx("Disposal", "নিষ্পত্তি")}</TabsTrigger>
          <TabsTrigger value="audit">{tx("Audit", "অডিট")}</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase">
          <SimpleTable
            empty={tx("No purchase history", "কোনো ক্রয় ইতিহাস নেই")}
            columns={[tx("Date", "তারিখ"), tx("Supplier", "সরবরাহকারী"), tx("Qty", "পরিমাণ"), tx("Unit price", "একক মূল্য"), tx("Total", "মোট")]}
            rows={purchases.map((p) => [p.purchase_date, p.supplier ?? "—", p.quantity, Number(p.unit_price).toLocaleString(), Number(p.total_amount).toLocaleString()])}
          />
        </TabsContent>
        <TabsContent value="stock">
          <SimpleTable
            empty={tx("No stock entries", "কোনো স্টক নেই")}
            columns={[tx("Location", "অবস্থান"), tx("Quantity", "পরিমাণ"), tx("Updated", "আপডেট")]}
            rows={stocks.map((s) => [s.location_id ?? "—", Number(s.quantity).toLocaleString(), new Date(s.updated_at).toLocaleString()])}
          />
        </TabsContent>
        <TabsContent value="movement">
          <SimpleTable
            empty={tx("No movements", "কোনো মুভমেন্ট নেই")}
            columns={[tx("Date", "তারিখ"), tx("From", "থেকে"), tx("To", "এ"), tx("Qty", "পরিমাণ"), tx("Remarks", "মন্তব্য")]}
            rows={movements.map((m) => [m.movement_date, m.from_location_id ?? "—", m.to_location_id ?? "—", m.quantity, m.remarks ?? "—"])}
          />
        </TabsContent>
        <TabsContent value="install">
          <SimpleTable
            empty={tx("No installations", "কোনো ইনস্টলেশন নেই")}
            columns={[tx("Date", "তারিখ"), tx("Location", "অবস্থান"), tx("Condition", "অবস্থা"), tx("Remarks", "মন্তব্য")]}
            rows={installs.map((i) => [i.install_date, i.location_name ?? i.location_id ?? "—", i.condition_status, i.remarks ?? "—"])}
          />
        </TabsContent>
        <TabsContent value="maint">
          <SimpleTable
            empty={tx("No maintenance logs", "কোনো মেরামত নেই")}
            columns={[tx("Date", "তারিখ"), tx("Vendor", "ভেন্ডর"), tx("Cost", "খরচ"), tx("Downtime (days)", "বন্ধ (দিন)"), tx("Status", "অবস্থা")]}
            rows={maint.map((m) => [m.maintenance_date, m.vendor ?? "—", Number(m.cost).toLocaleString(), m.downtime_days, m.status])}
            footer={[tx("Total", "মোট"), "", totalMaintCost.toLocaleString(), "", ""]}
          />
        </TabsContent>
        <TabsContent value="damage">
          <SimpleTable
            empty={tx("No damage reports", "কোনো ক্ষতির রিপোর্ট নেই")}
            columns={[tx("Date", "তারিখ"), tx("Severity", "মাত্রা"), tx("Status", "অবস্থা"), tx("Remarks", "মন্তব্য")]}
            rows={damages.map((d) => [d.report_date, d.severity, d.status, d.remarks ?? "—"])}
          />
        </TabsContent>
        <TabsContent value="disposal">
          <SimpleTable
            empty={tx("No disposal records", "কোনো নিষ্পত্তি নেই")}
            columns={[tx("Date", "তারিখ"), tx("Method", "পদ্ধতি"), tx("Sale", "বিক্রয়"), tx("Book value", "হিসাবী মূল্য"), tx("Gain/Loss", "লাভ/ক্ষতি")]}
            rows={disposals.map((d) => [d.disposal_date, d.method, Number(d.sale_amount).toLocaleString(), Number(d.book_value).toLocaleString(), Number(d.gain_loss).toLocaleString()])}
            footer={[tx("Net", "নেট"), "", "", "", totalDisposalNet.toLocaleString()]}
          />
        </TabsContent>
        <TabsContent value="audit">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("When", "কখন")}</TableHead>
                  <TableHead>{tx("Entity", "এনটিটি")}</TableHead>
                  <TableHead>{tx("Action", "অ্যাকশন")}</TableHead>
                  <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{a.entity}</Badge></TableCell>
                    <TableCell>{a.action_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {!audits.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{tx("No audit entries", "কোনো অডিট লগ নেই")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function SimpleTable({ columns, rows, empty, footer }: { columns: string[]; rows: (string | number)[][]; empty: string; footer?: (string | number)[] }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>{r.map((cell, j) => <TableCell key={j}>{cell as any}</TableCell>)}</TableRow>
          ))}
          {!rows.length && (
            <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">{empty}</TableCell></TableRow>
          )}
          {footer && rows.length > 0 && (
            <TableRow className="font-medium bg-muted/30">
              {footer.map((cell, j) => <TableCell key={j}>{cell as any}</TableCell>)}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
