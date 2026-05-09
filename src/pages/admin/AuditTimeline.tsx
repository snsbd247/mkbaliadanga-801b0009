import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, RefreshCw, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { downloadCsv } from "@/lib/csvExport";
import { fmtDateTime } from "@/lib/format";

type Row = {
  id: string;
  created_at: string;
  module: string;
  action_type: string;
  reference_id: string | null;
  user_id: string | null;
  office_id: string | null;
  old_data: any;
  new_data: any;
  ip: string | null;
  user_agent: string | null;
};

const MODULES = [
  "all", "irrigation_payment", "irrigation_invoice", "delay_fee_override",
  "promise_date", "sms", "receipt", "permission", "retry_job", "other",
];

export default function AuditTimeline() {
  const { tx } = useLang();
  const { isSuper } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("system_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (module !== "all") q = q.eq("module", module);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data } = await q;
      setRows((data ?? []) as Row[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = tx("Audit Timeline", "অডিট টাইমলাইন");
    load();
  }, [module, from, to]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      (r.action_type || "").toLowerCase().includes(s) ||
      (r.reference_id || "").toLowerCase().includes(s) ||
      JSON.stringify(r.new_data || {}).toLowerCase().includes(s) ||
      JSON.stringify(r.old_data || {}).toLowerCase().includes(s),
    );
  }, [rows, search]);

  function exportCsv() {
    downloadCsv(`audit-timeline-${new Date().toISOString().slice(0, 10)}`, filtered, [
      { header: "Timestamp", accessor: r => r.created_at },
      { header: "Module", accessor: r => r.module },
      { header: "Action", accessor: r => r.action_type },
      { header: "Reference ID", accessor: r => r.reference_id ?? "" },
      { header: "User ID", accessor: r => r.user_id ?? "" },
      { header: "Office ID", accessor: r => r.office_id ?? "" },
      { header: "IP", accessor: r => r.ip ?? "" },
      { header: "User Agent", accessor: r => r.user_agent ?? "" },
      { header: "Old Data", accessor: r => JSON.stringify(r.old_data ?? "") },
      { header: "New Data", accessor: r => JSON.stringify(r.new_data ?? "") },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Audit Timeline", "অডিট টাইমলাইন")}
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
            <Label>{tx("Module", "মডিউল")}</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Search", "অনুসন্ধান")}</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={tx("action / id / data", "অ্যাকশন / আইডি / ডেটা")} />
          </div>
          <div>
            <Label>{tx("From", "হতে")}</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("To", "পর্যন্ত")}</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {tx("Showing", "দেখাচ্ছে")}: <b>{filtered.length}</b> {tx("of", "/")} {rows.length}
          {!isSuper && <span> • {tx("Office-scoped view", "অফিস-স্কোপড দৃশ্য")}</span>}
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Time", "সময়")}</TableHead>
              <TableHead>{tx("Module", "মডিউল")}</TableHead>
              <TableHead>{tx("Action", "অ্যাকশন")}</TableHead>
              <TableHead>{tx("Reference", "রেফারেন্স")}</TableHead>
              <TableHead>{tx("Details", "বিস্তারিত")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No audit records", "কোনো অডিট রেকর্ড নেই")}</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <>
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{r.module}</Badge></TableCell>
                  <TableCell><Badge>{r.action_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.reference_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {expandedId === r.id ? tx("Hide", "লুকান") : tx("Show", "দেখুন")}
                  </TableCell>
                </TableRow>
                {expandedId === r.id && (
                  <TableRow key={r.id + "-d"}>
                    <TableCell colSpan={5} className="bg-muted/30">
                      <div className="grid gap-2 md:grid-cols-2 text-xs">
                        <div>
                          <div className="font-semibold mb-1">{tx("Old", "পুরাতন")}</div>
                          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(r.old_data ?? {}, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">{tx("New", "নতুন")}</div>
                          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(r.new_data ?? {}, null, 2)}</pre>
                        </div>
                        <div className="md:col-span-2 text-muted-foreground">
                          User: {r.user_id?.slice(0, 8) ?? "—"} • Office: {r.office_id?.slice(0, 8) ?? "—"} • IP: {r.ip ?? "—"}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
