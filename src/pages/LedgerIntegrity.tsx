import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { RefreshCw, ShieldAlert, ShieldCheck, ExternalLink } from "lucide-react";

const REF_TO_PATH: Record<string, string> = {
  savings: "/savings",
  loan: "/loans",
  loan_payment: "/loans",
  irrigation: "/irrigation",
  expense: "/payments",
  journal: "/journal-entry",
};

export default function LedgerIntegrity() {
  const { t } = useLang();
  const [unbalanced, setUnbalanced] = useState<any[]>([]);
  const [orphans, setOrphans] = useState<any[]>([]);
  const [missingAccts, setMissingAccts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runCheck = async () => {
    setLoading(true);
    const [u, o, m, s] = await Promise.all([
      supabase.rpc("ledger_unbalanced_refs"),
      supabase.rpc("ledger_orphan_refs"),
      supabase.from("ledger_entries").select("id,entry_date,description").is("account_id", null).limit(100),
      supabase.rpc("ledger_integrity_summary"),
    ]);
    setUnbalanced((u.data as any[]) || []);
    setOrphans((o.data as any[]) || []);
    setMissingAccts((m.data as any[]) || []);
    setSummary(s.data || null);
    setLastRun(new Date());
    setLoading(false);
  };

  useEffect(() => { runCheck(); /* eslint-disable-next-line */ }, []);

  const totalIssues = unbalanced.length + orphans.length + missingAccts.length;
  const allClear = !loading && totalIssues === 0;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("ledgerIntegrityCheck")}
        description={t("ledgerIntegrityDesc")}
        actions={
          <Button onClick={runCheck} disabled={loading} size="sm">
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("runIntegrityCheck")}
          </Button>
        }
      />

      {/* Banner */}
      <Card className={`border-l-4 ${allClear ? "border-l-primary" : totalIssues > 0 ? "border-l-destructive" : "border-l-muted"}`}>
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allClear
              ? <ShieldCheck className="h-8 w-8 text-primary" />
              : <ShieldAlert className={`h-8 w-8 ${totalIssues > 0 ? "text-destructive" : "text-muted-foreground"}`} />}
            <div>
              <div className="font-semibold">
                {loading ? t("runningChecks") : allClear ? t("allChecksPassed") : `${totalIssues} ${t("issuesFound")}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {summary?.total_entries ?? 0} {t("ledgerEntriesScanned")}
                {lastRun && ` · ${t("lastRun")} ${lastRun.toLocaleTimeString()}`}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Stat label={t("unbalanced")} value={unbalanced.length} />
            <Stat label={t("orphan")} value={orphans.length} />
            <Stat label={t("noAccount")} value={missingAccts.length} />
          </div>
        </CardContent>
      </Card>

      {/* Unbalanced */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {t("unbalancedPostings")} <Badge variant={unbalanced.length === 0 ? "secondary" : "destructive"}>{unbalanced.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unbalanced.length === 0 ? (
            <p className="text-sm text-primary">✅ {t("allReferencesBalanced")}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("referenceType")}</TableHead>
                <TableHead>{t("referenceId")}</TableHead>
                <TableHead className="text-right">{t("debit")}</TableHead>
                <TableHead className="text-right">{t("credit")}</TableHead>
                <TableHead className="text-right">{t("diff")}</TableHead>
                <TableHead className="text-right">{t("fix")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {unbalanced.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline">{r.reference_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_id}</TableCell>
                    <TableCell className="text-right">{money(r.total_debit)}</TableCell>
                    <TableCell className="text-right">{money(r.total_credit)}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">{money(r.diff)}</TableCell>
                    <TableCell className="text-right">
                      <FixLink refType={r.reference_type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Orphans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {t("orphanReferences")} <Badge variant={orphans.length === 0 ? "secondary" : "destructive"}>{orphans.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orphans.length === 0 ? (
            <p className="text-sm text-primary">✅ {t("everyEntryHasSource")}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("referenceType")}</TableHead>
                <TableHead>{t("referenceId")}</TableHead>
                <TableHead className="text-right">{t("entries")}</TableHead>
                <TableHead className="text-right">{t("fix")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orphans.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline">{r.reference_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_id}</TableCell>
                    <TableCell className="text-right">{r.entry_count}</TableCell>
                    <TableCell className="text-right">
                      <Link to={`/ledger?ref=${r.reference_id}`}>
                        <Button size="sm" variant="ghost" className="h-7"><ExternalLink className="h-3 w-3 mr-1" />{t("openLedger")}</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Missing accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {t("missingAccountLinks")} <Badge variant={missingAccts.length === 0 ? "secondary" : "destructive"}>{missingAccts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missingAccts.length === 0 ? (
            <p className="text-sm text-primary">✅ {t("allEntriesHaveAccount")}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{missingAccts.length} {t("entriesWithoutAccountId")}</p>
              <Link to="/accounts"><Button size="sm" variant="outline">{t("openChartOfAccounts")}</Button></Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center px-3">
      <div className={`text-2xl font-bold tabular-nums ${value > 0 ? "text-destructive" : "text-primary"}`}>{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
    </div>
  );
}

function FixLink({ refType }: { refType: string }) {
  const { t } = useLang();
  const path = REF_TO_PATH[refType];
  if (!path) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Link to={path}>
      <Button size="sm" variant="ghost" className="h-7"><ExternalLink className="h-3 w-3 mr-1" />{t("open")}</Button>
    </Link>
  );
}
