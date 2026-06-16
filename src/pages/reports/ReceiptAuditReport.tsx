import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { fetchReceiptAuditLogs, type ReceiptAuditLog } from "@/lib/receiptAudit";

const PAGE_SIZE = 50;

export default function ReceiptAuditReport() {
  const { tx } = useLang();
  const [receiptNo, setReceiptNo] = useState("");
  const [farmerText, setFarmerText] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ReceiptAuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { rows, count } = await fetchReceiptAuditLogs({
        receiptNo: receiptNo.trim() || undefined,
        officeId: officeId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        ascending,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(rows);
      setCount(count);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }
  // Server-side filters (receipt no / office / date / sort / page) refetch.
  useEffect(() => { load(); }, [receiptNo, officeId, from, to, ascending, page]);
  // Reset to first page whenever a filter changes.
  useEffect(() => { setPage(0); }, [receiptNo, officeId, from, to, ascending]);

  // Farmer is matched client-side against before/after/meta blob (no FK on audit_logs).
  const filtered = useMemo(() => {
    const s = farmerText.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      JSON.stringify({ o: r.old_values, n: r.new_values, m: r.meta }).toLowerCase().includes(s),
    );
  }, [rows, farmerText]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Receipt edit audit log", "রসিদ এডিট অডিট লগ")} />
      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>{tx("Receipt no", "রসিদ নং")}</Label>
            <Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder={tx("Exact no.", "সঠিক নং")} />
          </div>
          <div>
            <Label>{tx("Farmer / value", "কৃষক / মান")}</Label>
            <Input value={farmerText} onChange={(e) => setFarmerText(e.target.value)} placeholder={tx("Search in changes", "পরিবর্তনে খুঁজুন")} />
          </div>
          <div>
            <Label>{tx("Office ID", "অফিস আইডি")}</Label>
            <Input value={officeId} onChange={(e) => setOfficeId(e.target.value)} placeholder={tx("Office", "অফিস")} />
          </div>
          <div>
            <Label>{tx("From", "শুরু")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("To", "শেষ")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAscending((a) => !a)}>
            <ArrowUpDown className="h-4 w-4 mr-1" /> {ascending ? tx("Oldest first", "পুরোনো আগে") : tx("Newest first", "নতুন আগে")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setReceiptNo(""); setFarmerText(""); setOfficeId(""); setFrom(""); setTo(""); }}>
            {tx("Clear", "মুছুন")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> {tx("Loading…", "লোড হচ্ছে…")}</div>
        ) : (
          <>
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
                {filtered.map((r) => {
                  const { reason, ...after } = (r.new_values as any) || {};
                  const receipt = (r.meta as any)?.receipt_no ?? "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{receipt}</TableCell>
                      <TableCell className="text-xs max-w-[180px]">{(reason as string) || "—"}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[220px] break-all">{JSON.stringify(r.old_values)}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[220px] break-all">{JSON.stringify(after)}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/payments?receipt=${encodeURIComponent(receipt)}`} title={tx("Open receipt", "রসিদ খুলুন")}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No records", "কোনো রেকর্ড নেই")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{tx("Total", "মোট")}: {count}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span>{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
