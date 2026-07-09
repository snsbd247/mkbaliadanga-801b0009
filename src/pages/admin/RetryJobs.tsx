import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, RotateCw, AlertTriangle } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { manualRetry } from "@/lib/retryQueue";
import { toast } from "sonner";

type Job = {
  id: string;
  job_type: string;
  reference_id: string | null;
  status: string;
  retry_count: number;
  max_retry: number;
  next_retry_at: string;
  last_error: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  retrying: "outline",
  succeeded: "default",
  failed: "destructive",
  permanently_failed: "destructive",
};

export default function RetryJobs() {
  const { tx } = useLang();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    let q = db
      .from("background_retry_jobs")
      .select("id,job_type,reference_id,status,retry_count,max_retry,next_retry_at,last_error,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (typeFilter !== "all") q = q.eq("job_type", typeFilter);
    const { data } = await q;
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }

  useEffect(() => {
    document.title = tx("Retry Jobs", "রিট্রাই কিউ");
    load();
  }, [statusFilter, typeFilter]);

  async function onRetry(id: string) {
    await manualRetry(id);
    toast.success(tx("Queued for immediate retry", "অবিলম্বে রিট্রাই কিউ-তে যোগ হয়েছে"));
    load();
  }

  const failedCount = jobs.filter(j => j.status === "permanently_failed").length;

  return (
    <>
      <PageHeader
        title={tx("Background Retry Jobs", "ব্যাকগ্রাউন্ড রিট্রাই কিউ")}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
          </Button>
        }
      />
      {failedCount > 0 && (
        <Card className="p-3 mb-3 text-sm flex items-center gap-2 border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>{tx(`${failedCount} permanently failed job(s) need attention`, `${failedCount}টি জব স্থায়ীভাবে ব্যর্থ — অ্যাটেনশন প্রয়োজন`)}</span>
        </Card>
      )}
      <Card className="p-3 mb-3 flex flex-wrap gap-3">
        <div className="min-w-[160px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All statuses", "সব স্ট্যাটাস")}</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="retrying">retrying</SelectItem>
              <SelectItem value="succeeded">succeeded</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="permanently_failed">permanently_failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All types", "সব টাইপ")}</SelectItem>
              <SelectItem value="receipt_generation">receipt_generation</SelectItem>
              <SelectItem value="sms_send">sms_send</SelectItem>
              <SelectItem value="sms_delivery_check">sms_delivery_check</SelectItem>
              <SelectItem value="report_export">report_export</SelectItem>
              <SelectItem value="cashbook_write">cashbook_write</SelectItem>
              <SelectItem value="journal_post">journal_post</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Type", "টাইপ")}</TableHead>
              <TableHead>{tx("Ref", "রেফ")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead className="text-right">{tx("Attempts", "প্রচেষ্টা")}</TableHead>
              <TableHead>{tx("Next retry", "পরবর্তী রিট্রাই")}</TableHead>
              <TableHead>{tx("Last error", "শেষ ত্রুটি")}</TableHead>
              <TableHead className="text-right">{tx("Action", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && jobs.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{tx("No jobs", "কোনো জব নেই")}</TableCell></TableRow>
            )}
            {jobs.map(j => (
              <TableRow key={j.id}>
                <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                <TableCell className="font-mono text-xs">{j.reference_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[j.status] ?? "outline"}>{j.status}</Badge></TableCell>
                <TableCell className="text-right">{j.retry_count} / {j.max_retry}</TableCell>
                <TableCell className="text-xs">{new Date(j.next_retry_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={j.last_error ?? ""}>{j.last_error ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {(j.status === "failed" || j.status === "permanently_failed" || j.status === "retrying") && (
                    <Button size="sm" variant="outline" onClick={() => onRetry(j.id)}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" />{tx("Retry", "রিট্রাই")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
