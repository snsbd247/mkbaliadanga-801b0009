import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, FileBarChart2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel, statusVariant } from "./AssetItems";

type StatusKey = "purchased" | "in_stock" | "transferred" | "installed" | "maintenance" | "damaged" | "disposed";

export default function AssetDashboard() {
  const { tx } = useLang();
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    purchased: 0, in_stock: 0, transferred: 0, installed: 0, maintenance: 0, damaged: 0, disposed: 0,
  });
  const [totalValuation, setTotalValuation] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    document.title = tx("Asset Dashboard", "এসেট ড্যাশবোর্ড");
    (async () => {
      const a = await supabase.from("assets" as any).select("id,current_status,purchase_price").is("deleted_at", null);
      if (!a.error && a.data) {
        const c: any = { purchased: 0, in_stock: 0, transferred: 0, installed: 0, maintenance: 0, damaged: 0, disposed: 0 };
        let total = 0;
        for (const r of a.data as any[]) {
          c[r.current_status] = (c[r.current_status] || 0) + 1;
          total += Number(r.purchase_price || 0);
        }
        setCounts(c);
        setTotalValuation(total);
      }
      const m = await supabase.from("asset_movements" as any)
        .select("id,asset_id,quantity,movement_date,remarks,from_location_id,to_location_id")
        .order("created_at", { ascending: false }).limit(10);
      if (!m.error) setRecent((m.data as any[]) || []);

      const s = await supabase.from("asset_stocks" as any)
        .select("id,asset_id,location_id,quantity").lte("quantity", 1).limit(10);
      if (!s.error) setLowStock((s.data as any[]) || []);
    })();
  }, [tx]);

  const cards: { key: StatusKey; }[] = [
    { key: "in_stock" }, { key: "installed" }, { key: "maintenance" },
    { key: "damaged" }, { key: "transferred" }, { key: "disposed" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Asset Dashboard", "এসেট ড্যাশবোর্ড")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/assets/reports"><FileBarChart2 className="h-4 w-4 mr-1" />{tx("Reports", "রিপোর্ট")}</Link>
          </Button>
        } />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(({ key }) => (
          <Card key={key} className="p-4">
            <div className="text-xs text-muted-foreground">{statusLabel(key, tx)}</div>
            <div className="text-2xl font-semibold mt-1">{counts[key]}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">{tx("Total Valuation", "মোট মূল্যায়ন")}</div>
        <div className="text-3xl font-bold mt-1">৳ {totalValuation.toLocaleString()}</div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="font-semibold mb-3">{tx("Recent Movements", "সাম্প্রতিক স্থানান্তর")}</div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Qty", "পরিমাণ")}</TableHead>
              <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{tx("No data", "কোন তথ্য নেই")}</TableCell></TableRow>
              ) : recent.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.movement_date}</TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{r.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">{tx("Low Stock Alerts", "কম স্টক সতর্কতা")}</div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Asset", "এসেট")}</TableHead>
              <TableHead>{tx("Qty", "পরিমাণ")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lowStock.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{tx("All stock healthy", "সকল স্টক সুস্থ")}</TableCell></TableRow>
              ) : lowStock.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.asset_id?.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant={r.quantity === 0 ? "destructive" : "secondary"}>{r.quantity}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
