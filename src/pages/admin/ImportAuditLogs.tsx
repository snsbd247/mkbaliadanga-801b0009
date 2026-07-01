import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Loader2, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";

type Row = {
  id: string;
  created_at: string;
  user_id: string | null;
  office_id: string | null;
  module: string;
  mode: string;
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_failed: number;
  summary: any;
};

const fmt = (d: string) => { try { return new Date(d).toLocaleString(); } catch { return d; } };

/** Derive a template-type label from a log row. */
function templateType(r: Row): string {
  if (r.mode !== "download") return r.mode;
  const kind = r.summary?.kind ?? "";
  const format = r.summary?.format ?? "";
  return [kind, format].filter(Boolean).join(" · ") || "download";
}

export default function ImportAuditLogs() {
  const { tx } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all"); // all | insert | csv | xlsx | sample
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      let q = db
        .from("import_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data } = await q;
      setRows((data ?? []) as Row[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = tx("Import Audit Logs", "ইমপোর্ট অডিট লগ");
    load();
  }, [from, to]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (user.trim() && !String(r.user_id ?? "").toLowerCase().includes(user.trim().toLowerCase())) return false;
      if (typeFilter === "all") return true;
      if (typeFilter === "insert") return r.mode === "insert";
      // download-format filters
      if (r.mode !== "download") return false;
      const kind = String(r.summary?.kind ?? "").toLowerCase();
      const format = String(r.summary?.format ?? "").toLowerCase();
      if (typeFilter === "sample") return kind === "sample";
      return format === typeFilter; // csv | xlsx
    });
  }, [rows, user, typeFilter]);

  function exportCsv() {
    downloadCsv(`import-audit-${new Date().toISOString().slice(0, 10)}`, filtered, [
      { header: "Time", accessor: (r) => r.created_at },
      { header: "User ID", accessor: (r) => r.user_id ?? "" },
      { header: "Module", accessor: (r) => r.module },
      { header: "Type", accessor: (r) => templateType(r) },
      { header: "Processed", accessor: (r) => r.rows_processed },
      { header: "Inserted", accessor: (r) => r.rows_inserted },
      { header: "Updated", accessor: (r) => r.rows_updated },
      { header: "Failed", accessor: (r) => r.rows_failed },
      { header: "Summary", accessor: (r) => JSON.stringify(r.summary ?? "") },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Import Audit Logs", "ইমপোর্ট অডিট লগ")}
        description={tx("Template downloads & bulk import history", "টেমপ্লেট ডাউনলোড ও বাল্ক ইমপোর্ট ইতিহাস")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
            </Button>
          </div>
        }
      />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>{tx("Type", "ধরন")}</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="insert">{tx("Import (insert)", "ইমপোর্ট")}</SelectItem>
                <SelectItem value="csv">{tx("Template CSV", "টেমপ্লেট CSV")}</SelectItem>
                <SelectItem value="xlsx">{tx("Template XLSX", "টেমপ্লেট XLSX")}</SelectItem>
                <SelectItem value="sample">{tx("Sample", "স্যাম্পল")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("User ID", "ইউজার আইডি")}</Label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder={tx("user id…", "ইউজার আইডি…")} />
          </div>
          <div>
            <Label>{tx("From", "হতে")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("To", "পর্যন্ত")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {tx("Showing", "দেখাচ্ছে")}: <b>{filtered.length}</b> {tx("of", "/")} {rows.length}
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Time", "সময়")}</TableHead>
              <TableHead>{tx("Module", "মডিউল")}</TableHead>
              <TableHead>{tx("Type", "ধরন")}</TableHead>
              <TableHead>{tx("User", "ইউজার")}</TableHead>
              <TableHead className="text-right">{tx("Processed", "প্রক্রিয়াকৃত")}</TableHead>
              <TableHead className="text-right">{tx("Inserted", "যোগ")}</TableHead>
              <TableHead className="text-right">{tx("Failed", "ব্যর্থ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{tx("No records", "কোনো রেকর্ড নেই")}</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{r.module}</Badge></TableCell>
                <TableCell><Badge variant={r.mode === "insert" ? "default" : "secondary"}>{templateType(r)}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-right">{r.mode === "insert" ? r.rows_processed : "—"}</TableCell>
                <TableCell className="text-right">{r.mode === "insert" ? r.rows_inserted : "—"}</TableCell>
                <TableCell className="text-right">{r.mode === "insert" && r.rows_failed > 0 ? <span className="text-destructive font-medium">{r.rows_failed}</span> : (r.mode === "insert" ? 0 : "—")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
