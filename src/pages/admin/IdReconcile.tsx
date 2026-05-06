import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { exportExcel } from "@/lib/exports";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

type Issue = "missing_member" | "missing_account" | "duplicate_member" | "duplicate_account" | "duplicate_code";

interface Row {
  id: string;
  name_en: string;
  member_no: string | null;
  account_number: string | null;
  farmer_code: string;
  office_id: string | null;
  issues: Issue[];
}

const LABELS: Record<Issue, string> = {
  missing_member: "Missing Farmer ID",
  missing_account: "Missing Account No",
  duplicate_member: "Duplicate Farmer ID",
  duplicate_account: "Duplicate Account No",
  duplicate_code: "Duplicate Farmer Code",
};

export default function IdReconcile() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | Issue>("all");

  useEffect(() => { document.title = "ID Reconcile"; load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("farmers")
      .select("id,name_en,member_no,account_number,farmer_code,office_id")
      .is("deleted_at", null)
      .limit(5000);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data as any[]) ?? [];

    const memberCount = new Map<string, number>();
    const accountCount = new Map<string, number>();
    const codeCount = new Map<string, number>();
    list.forEach(f => {
      if (f.member_no) memberCount.set(f.member_no, (memberCount.get(f.member_no) ?? 0) + 1);
      if (f.account_number) accountCount.set(f.account_number, (accountCount.get(f.account_number) ?? 0) + 1);
      if (f.farmer_code) codeCount.set(f.farmer_code, (codeCount.get(f.farmer_code) ?? 0) + 1);
    });

    const out: Row[] = [];
    for (const f of list) {
      const issues: Issue[] = [];
      if (!f.member_no) issues.push("missing_member");
      if (!f.account_number) issues.push("missing_account");
      if (f.member_no && (memberCount.get(f.member_no) ?? 0) > 1) issues.push("duplicate_member");
      if (f.account_number && (accountCount.get(f.account_number) ?? 0) > 1) issues.push("duplicate_account");
      if (f.farmer_code && (codeCount.get(f.farmer_code) ?? 0) > 1) issues.push("duplicate_code");
      if (issues.length) out.push({ ...f, issues });
    }
    setRows(out);
    setLoading(false);
  }

  const filtered = useMemo(() => tab === "all" ? rows : rows.filter(r => r.issues.includes(tab)), [rows, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    (Object.keys(LABELS) as Issue[]).forEach(k => c[k] = rows.filter(r => r.issues.includes(k)).length);
    return c;
  }, [rows]);

  function exportIssues() {
    exportExcel("id-reconcile", "ID Reconcile", filtered.map(r => ({
      Farmer: r.name_en,
      FarmerCode: r.farmer_code,
      MemberNo: r.member_no ?? "",
      AccountNo: r.account_number ?? "",
      Issues: r.issues.map(i => LABELS[i]).join("; "),
    })));
  }

  async function autoFillMember(r: Row) {
    if (r.member_no) return;
    const next = r.farmer_code; // safest: copy farmer_code as member_no fallback
    const { error } = await supabase.from("farmers").update({ member_no: next }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Set Farmer ID = ${next}`);
    load();
  }

  return (
    <>
      <PageHeader
        title="ID Reconcile"
        description="Find inconsistencies in Farmer ID, Account Number, and Farmer Code across all farmers."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Re-scan
            </Button>
            <Button variant="outline" size="sm" onClick={exportIssues} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span><strong>{rows.length}</strong> farmer(s) with at least one issue out of the first 5,000 records scanned.</span>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          {(Object.keys(LABELS) as Issue[]).map(k => (
            <TabsTrigger key={k} value={k}>{LABELS[k]} ({counts[k]})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farmer</TableHead>
              <TableHead>Farmer Code</TableHead>
              <TableHead>Farmer ID</TableHead>
              <TableHead>Account No</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No issues 🎉</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/farmers/${r.id}`} className="underline">{r.name_en}</Link></TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code}</TableCell>
                <TableCell className="font-mono text-xs">{r.member_no ?? <span className="text-destructive">missing</span>}</TableCell>
                <TableCell className="font-mono text-xs">{r.account_number ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="space-x-1">
                  {r.issues.map(i => <Badge key={i} variant={i.startsWith("duplicate") ? "destructive" : "secondary"}>{LABELS[i]}</Badge>)}
                </TableCell>
                <TableCell className="text-right">
                  {!r.member_no && (
                    <Button size="sm" variant="outline" onClick={() => autoFillMember(r)}>Use farmer_code</Button>
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
