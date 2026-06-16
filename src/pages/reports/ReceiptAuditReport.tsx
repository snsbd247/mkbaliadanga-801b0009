import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

const PAGE_SIZE = 50;

export default function ReceiptAuditReport() {
  const { tx } = useLang();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("audit_logs" as any)
        .select("id,created_at,action,entity,entity_id,office_id,old_values,new_values,meta,user_id")
        .eq("entity", "payments")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (from) q = q.gte("created_at", `${from}T00:00:00`);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as any) ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [from, to]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = JSON.stringify({ meta: r.meta, old: r.old_values, new: r.new_values, id: r.entity_id, office: r.office_id }).toLowerCase();
      return blob.includes(s);
    });
  }, [rows, search]);

  const pageRows = filtered.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Receipt edit audit log", "রসিদ এডিট অডিট লগ")} />
      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>{tx("Search (receipt no / farmer / office)", "খুঁজুন (রসিদ নং / কৃষক / অফিস)")}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("Search…", "খুঁজুন…")} />
          </div>
          <div>
            <Label>{tx("From", "শুরু")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("To", "শেষ")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>{tx("Clear", "মুছুন")}</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {tx("Loading…", "লোড হচ্ছে…")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Receipt no", "রসিদ নং")}</TableHead>
                <TableHead>{tx("Reason", "কারণ")}</TableHead>
                <TableHead>{tx("Before", "আগে")}</TableHead>
                <TableHead>{tx("After", "পরে")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => {
                const { reason, ...after } = r.new_values || {};
                const receiptNo = r.meta?.receipt_no ?? "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{receiptNo}</TableCell>
                    <TableCell className="text-xs max-w-[180px]">{reason || "—"}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[220px] break-all">{JSON.stringify(r.old_values)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[220px] break-all">{JSON.stringify(after)}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/payments?receipt=${encodeURIComponent(receiptNo)}`} title={tx("Open receipt", "রসিদ খুলুন")}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pageRows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No records", "কোনো রেকর্ড নেই")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
