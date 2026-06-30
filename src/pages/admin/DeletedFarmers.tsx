import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { tableLabel } from "@/lib/tableLabels";

type DeletionLog = {
  id: string;
  farmer_id: string | null;
  farmer_name: string | null;
  farmer_code: string | null;
  user_name: string | null;
  status: string;
  blocking: Record<string, number> | null;
  reason: string | null;
  created_at: string | null;
};

export default function DeletedFarmers() {
  const { lang, tx } = useLang();
  const [rows, setRows] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await db.rpc("deleted_farmers_list", { _limit: 500 });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows(((data as any)?.result ?? data ?? []) as DeletionLog[]);
  }

  useEffect(() => {
    load();
  }, []);

  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleString(lang === "bn" ? "bn-BD" : "en-US") : "—");

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx("Permanent Delete Report", "পারমানেন্ট ডিলিট রিপোর্ট")}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" /> {tx("Refresh", "রিফ্রেশ")}
          </Button>
        }
      />
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {tx("Loading…", "লোড হচ্ছে…")}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tx("No records.", "কোনো রেকর্ড নেই।")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Farmer", "ফার্মার")}</TableHead>
                <TableHead>{tx("Code", "কোড")}</TableHead>
                <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                <TableHead>{tx("Reason / Blocking", "কারণ / ব্লকিং")}</TableHead>
                <TableHead>{tx("Done by", "কে করেছে")}</TableHead>
                <TableHead>{tx("When", "কখন")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.farmer_name || r.farmer_id || "—"}</TableCell>
                  <TableCell>{r.farmer_code || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "deleted" ? "destructive" : "secondary"}>
                      {r.status === "deleted" ? tx("Deleted", "ডিলিট হয়েছে") : tx("Blocked", "ব্লকড")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                    {r.blocking
                      ? Object.entries(r.blocking).map(([k, v]) => `${tableLabel(k, lang)} (${v})`).join(", ")
                      : r.reason || "—"}
                  </TableCell>
                  <TableCell>{r.user_name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
