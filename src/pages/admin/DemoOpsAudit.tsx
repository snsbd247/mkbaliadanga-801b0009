import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { RefreshCw, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

const sb = db as any;

type LogRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  modules: string[] | null;
  size: number | null;
  success: boolean | null;
  error_message: string | null;
  summary: any;
  created_at: string;
};

export default function DemoOpsAudit() {
  const { tx } = useLang();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    document.title = tx("Demo Operations Audit", "ডেমো অপারেশন অডিট");
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let q = sb.from("demo_operations_log")
        .select("id,user_id,user_email,action,modules,size,success,error_message,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data } = await q;
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to]);

  const filtered = useMemo(() => {
    const u = userFilter.trim().toLowerCase();
    const m = moduleFilter.trim().toLowerCase();
    return rows.filter((r) => {
      if (u && !(r.user_email ?? r.user_id).toLowerCase().includes(u)) return false;
      if (m && !(r.modules ?? []).some((x) => x.toLowerCase().includes(m))) return false;
      if (sourceFilter !== "all" && (r.summary?.source ?? "") !== sourceFilter) return false;
      if (statusFilter === "ok" && !r.success) return false;
      if (statusFilter === "err" && r.success) return false;
      return true;
    });
  }, [rows, userFilter, moduleFilter, sourceFilter, statusFilter]);

  const backupBadge = (s?: string) => {
    if (s === "ok") return <Badge className="bg-green-600">backup ok</Badge>;
    if (s === "failed") return <Badge variant="destructive">backup failed</Badge>;
    return <Badge variant="outline">no backup</Badge>;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx("Demo Operations Audit", "ডেমো অপারেশন অডিট")}
        description={tx("Track QuickSeed / DemoManager runs — who, when, modules, backup status and validation results", "QuickSeed / DemoManager রান দেখুন — কে, কখন, কোন মডিউল, ব্যাকআপ অবস্থা ও যাচাই ফলাফল")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/help#demoTools"><HelpCircle className="h-4 w-4 mr-1" /> {tx("Manual", "ম্যানুয়াল")}</Link>
          </Button>
        }
      />

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div><Label>{tx("From", "শুরু")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("To", "শেষ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>{tx("User", "ব্যবহারকারী")}</Label><Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder={tx("Search email", "ইমেইল খুঁজুন")} /></div>
        <div><Label>{tx("Module", "মডিউল")}</Label><Input value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} placeholder="cashbook…" /></div>
        <div>
          <Label>{tx("Source", "উৎস")}</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All sources", "সব উৎস")}</SelectItem>
              <SelectItem value="QuickSeed">QuickSeed</SelectItem>
              <SelectItem value="DemoManager">DemoManager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{tx("Status", "অবস্থা")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              <SelectItem value="ok">{tx("Success", "সফল")}</SelectItem>
              <SelectItem value="err">{tx("Failed", "ব্যর্থ")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> {tx("Refresh", "রিফ্রেশ")}
        </Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date/Time", "তারিখ/সময়")}</TableHead>
              <TableHead>{tx("User", "ব্যবহারকারী")}</TableHead>
              <TableHead>{tx("Source", "উৎস")}</TableHead>
              <TableHead>{tx("Action", "অ্যাকশন")}</TableHead>
              <TableHead>{tx("Modules", "মডিউল")}</TableHead>
              <TableHead>{tx("Backup", "ব্যাকআপ")}</TableHead>
              <TableHead>{tx("Validation", "যাচাই")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const mismatches: string[] = r.summary?.validation_mismatches ?? [];
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.user_email || r.user_id}</TableCell>
                  <TableCell>{r.summary?.source ?? "-"}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell className="text-xs max-w-[200px]">{(r.modules ?? []).join(", ")}</TableCell>
                  <TableCell>{backupBadge(r.summary?.backup_status)}</TableCell>
                  <TableCell>
                    {mismatches.length
                      ? <Badge variant="destructive">{mismatches.length} mismatch</Badge>
                      : (r.summary?.validation ? <Badge className="bg-green-600">ok</Badge> : <Badge variant="outline">-</Badge>)}
                  </TableCell>
                  <TableCell>
                    {r.success
                      ? <Badge className="bg-green-600">✓</Badge>
                      : <Badge variant="destructive" title={r.error_message ?? ""}>✕</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No records found", "কোনো রেকর্ড নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
