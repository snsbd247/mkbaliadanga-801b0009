import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, RefreshCw } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  id: string; scanned_at: string; scanned_text: string; asset_id: string | null;
  asset_code: string | null; success: boolean; error_message: string | null; source: string;
};

export default function AssetScanHistory() {
  const { tx } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("asset_scan_logs" as any)
      .select("*").order("scanned_at", { ascending: false }).limit(200);
    setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    document.title = tx("Scan history", "স্ক্যান ইতিহাস");
    load();
  }, [tx]);

  return (
    <>
      <PageHeader
        title={tx("Scan history", "স্ক্যান ইতিহাস")}
        description={tx("Recent QR / code scans with their resolved asset and result.", "সাম্প্রতিক QR/কোড স্ক্যান এবং তার ফলাফল।")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}</Button>
            <Button asChild><Link to="/assets/scan"><Camera className="h-4 w-4 mr-1" />{tx("Scan now", "স্ক্যান করুন")}</Link></Button>
          </div>
        }
      />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tx("When", "কখন")}</TableHead>
            <TableHead>{tx("Result", "ফলাফল")}</TableHead>
            <TableHead>{tx("Code / Text", "কোড / টেক্সট")}</TableHead>
            <TableHead>{tx("Asset", "এসেট")}</TableHead>
            <TableHead>{tx("Source", "উৎস")}</TableHead>
            <TableHead>{tx("Note", "নোট")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.scanned_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={r.success ? "default" : "destructive"}>{r.success ? tx("Success", "সফল") : tx("Failed", "ব্যর্থ")}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs max-w-[260px] truncate" title={r.scanned_text}>{r.scanned_text}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.asset_id
                    ? <Link className="underline" to={`/assets/items/${r.asset_id}`}>{r.asset_code || r.asset_id.slice(0,8)}</Link>
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.error_message ?? ""}>{r.error_message || "—"}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No scans yet", "এখনও কোনো স্ক্যান নেই")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
