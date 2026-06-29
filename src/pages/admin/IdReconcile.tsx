import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db";
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

const ISSUE_KEY: Record<Issue, string> = {
  missing_member: "missingFarmerId",
  missing_account: "missingAccountNo",
  duplicate_member: "duplicateFarmerIdIssue",
  duplicate_account: "duplicateAccountNo",
  duplicate_code: "duplicateFarmerCode",
};

export default function IdReconcile() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | Issue>("all");

  useEffect(() => { document.title = t("idReconcileTitle"); load(); }, [t]);

  async function load() {
    setLoading(true);
    const { data, error } = await db
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
    (Object.keys(ISSUE_KEY) as Issue[]).forEach(k => c[k] = rows.filter(r => r.issues.includes(k)).length);
    return c;
  }, [rows]);

  function exportIssues() {
    exportExcel("id-reconcile", t("idReconcileTitle"), filtered.map(r => ({
      Farmer: r.name_en,
      FarmerCode: r.farmer_code,
      MemberNo: r.member_no ?? "",
      AccountNo: r.account_number ?? "",
      Issues: r.issues.map(i => t(ISSUE_KEY[i] as any)).join("; "),
    })));
  }

  async function autoFillMember(r: Row) {
    if (r.member_no) return;
    const next = r.farmer_code;
    const { error } = await db.from("farmers").update({ member_no: next }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("setFarmerIdToast").replace("{v}", String(next)));
    load();
  }

  return (
    <>
      <PageHeader
        title={t("idReconcileTitle")}
        description={t("idReconcileDesc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("rescan")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportIssues} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />{t("excel")}
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span>{t("farmersWithIssues").replace("{n}", String(rows.length))}</span>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">{t("allTab")} ({counts.all})</TabsTrigger>
          {(Object.keys(ISSUE_KEY) as Issue[]).map(k => (
            <TabsTrigger key={k} value={k}>{t(ISSUE_KEY[k] as any)} ({counts[k]})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("farmer")}</TableHead>
              <TableHead>{t("farmerCode")}</TableHead>
              <TableHead>{t("farmerIdLabel")}</TableHead>
              <TableHead>{t("accountNo")}</TableHead>
              <TableHead>{t("issues")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">{t("noIssues")}</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/farmers/${r.id}`} className="underline">{r.name_en}</Link></TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code}</TableCell>
                <TableCell className="font-mono text-xs">{r.member_no ?? <span className="text-destructive">—</span>}</TableCell>
                <TableCell className="font-mono text-xs">{r.account_number ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="space-x-1">
                  {r.issues.map(i => <Badge key={i} variant={i.startsWith("duplicate") ? "destructive" : "secondary"}>{t(ISSUE_KEY[i] as any)}</Badge>)}
                </TableCell>
                <TableCell className="text-right">
                  {!r.member_no && (
                    <Button size="sm" variant="outline" onClick={() => autoFillMember(r)}>{t("useFarmerCode")}</Button>
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
