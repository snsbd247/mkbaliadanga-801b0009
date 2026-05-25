import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRlsErrors, clearRlsErrors, RlsErrorEntry } from "@/lib/rlsLogger";
import { Loader2, RefreshCw, Trash2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

// Office-scoped operational tables (have office_id column)
const OPERATIONAL_TABLES = [
  // Core
  "farmers", "lands", "land_relations", "land_history", "land_change_log", "land_types",
  "patwaris", "shares", "receipts", "receipt_sequences", "voucher_sequences", "vouchers",
  // Loans
  "loans", "loan_payments", "loan_plans", "loan_installments",
  "loan_delay_fee_settings", "loan_installment_delay_audit",
  // Savings
  "savings_transactions", "savings_plans", "savings_yearly_opening", "farmer_savings_plans",
  // Irrigation
  "irrigation_charges", "irrigation_invoices", "irrigation_invoice_payments", "irrigation_invoice_audit",
  "irrigation_categories", "irrigation_category_rates", "irrigation_charge_settings",
  "irrigation_rates", "irrigation_rate_overrides", "irrigation_rate_audit_logs",
  "irrigation_season_rates", "irrigation_season_types",
  "irrigation_due_promises", "irrigation_delay_fee_audit", "irrigation_sms_logs",
  // Payments / expenses
  "payments", "payment_allocations", "expenses", "public_payment_intents",
  // Accounting
  "accounting_periods", "journal_entries", "ledger_entries",
  "bank_accounts", "bank_transactions",
  // Assets
  "assets", "asset_categories", "asset_purchases", "asset_movements", "asset_installations",
  "asset_maintenance_logs", "asset_maintenance_schedules", "asset_damage_reports",
  "asset_disposals", "asset_depreciation_schedule", "asset_depreciation_settings",
  "asset_stocks", "asset_alerts", "asset_audit_logs", "asset_scan_logs",
  // Misc
  "farmer_rejections", "farmer_login_attempts",
  "sms_logs", "sms_office_settings",
  "audit_logs", "system_audit_logs", "voter_audit_logs", "import_audit_logs",
  "background_retry_jobs", "profiles",
] as const;

// Global / shared reference tables (no office_id)
const REFERENCE_TABLES = [
  "offices", "seasons", "company_settings", "user_roles", "user_permissions",
  "role_permissions", "permission_audit_logs", "notifications",
  "accounts", "journal_entry_lines",
  "divisions", "districts", "upazilas", "mouzas",
  "card_settings", "cashbook_submissions",
  "farmer_notes", "farmer_otps", "farmer_portal_sessions",
  "qr_tokens", "qr_rotation_settings",
  "receipt_counters", "receipt_settings",
  "sms_settings", "sms_templates", "sms_provider_secrets",
  "demo_operations_log", "developer_update_logs",
] as const;


type Probe = { table: string; op: "select" | "count"; ok: boolean; status?: number; code?: string; message?: string; rows?: number };

export default function Diagnostics() {
  const { isSuper, user, officeId, rolesLoaded } = useAuth();
  const { t } = useLang();
  const [errors, setErrors] = useState<RlsErrorEntry[]>(getRlsErrors());
  const [probes, setProbes] = useState<Probe[]>([]);
  const [running, setRunning] = useState(false);
  const [iso, setIso] = useState<any>(null);
  const [isoBusy, setIsoBusy] = useState(false);
  const [scan, setScan] = useState<any>(null);
  const [scanBusy, setScanBusy] = useState(false);

  useEffect(() => { document.title = t("diag_pageTitle" as any); }, [t]);
  useEffect(() => {
    const h = () => setErrors(getRlsErrors());
    window.addEventListener("rls-errors-changed", h);
    return () => window.removeEventListener("rls-errors-changed", h);
  }, []);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("diag_loading" as any)}</div>;
  if (!isSuper) return <Navigate to="/" replace />;

  async function runHealthCheck() {
    setRunning(true);
    const out: Probe[] = [];
    for (const tbl of [...OPERATIONAL_TABLES, ...REFERENCE_TABLES]) {
      const { data, error, count, status } = await supabase
        .from(tbl as any).select("*", { count: "exact", head: true });
      if (error) {
        out.push({ table: tbl, op: "count", ok: false, status, code: (error as any).code, message: error.message });
      } else {
        out.push({ table: tbl, op: "count", ok: true, status, rows: count ?? 0 });
      }
    }
    setProbes(out);
    setRunning(false);
  }

  async function runIsolationTest() {
    setIsoBusy(true);
    // 1. Distinct office_ids visible to current user
    const tables = [
      "farmers", "loans", "loan_payments", "savings_transactions",
      "payments", "payment_allocations", "expenses",
      "irrigation_charges", "irrigation_invoices", "irrigation_invoice_payments",
      "lands", "land_relations", "shares", "receipts",
      "assets", "bank_accounts", "bank_transactions",
      "journal_entries", "ledger_entries",
    ] as const;
    const result: Record<string, any> = { user_office: officeId, is_super: true, tables: {} };
    for (const t of tables) {
      const { data, error } = await supabase.from(t as any).select("office_id");
      if (error) { result.tables[t] = { error: error.message, code: (error as any).code }; continue; }
      const set = new Set((data ?? []).map((r: any) => r.office_id));
      result.tables[t] = { offices_visible: Array.from(set), rows: data?.length ?? 0 };
    }
    // 2. Offices list (super admin sees all)
    const { data: offs } = await supabase.from("offices").select("id,name");
    result.all_offices = offs ?? [];
    // 3. Verdict: super admin should see >=2 offices' data when present
    const visibleOfficeSets = Object.values(result.tables).map((v: any) => (v.offices_visible || []).length);
    result.verdict = visibleOfficeSets.some(n => n >= 2)
      ? t("superAdminAllOfficesOk")
      : t("onlyOneOfficeVisible");
    setIso(result);
    setIsoBusy(false);
  }

  async function runIntegrityScan() {
    setScanBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-integrity-scan", { body: {} });
      if (error) throw error;
      setScan(data?.report ?? null);
    } catch (e: any) {
      setScan({ error: e?.message ?? String(e) });
    } finally {
      setScanBusy(false);
    }
  }

  const errorStats = useMemo(() => {
    const byCode: Record<string, number> = {};
    errors.forEach(e => { const k = e.code || `HTTP ${e.status}`; byCode[k] = (byCode[k] || 0) + 1; });
    return byCode;
  }, [errors]);

  return (
    <>
      <PageHeader title={t("diag_title" as any)} />

      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors">{t("diag_recentErrors" as any)} {errors.length > 0 && <Badge variant="destructive" className="ml-2">{errors.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="health">{t("diag_healthCheck" as any)}</TabsTrigger>
          <TabsTrigger value="isolation">{t("diag_isolation" as any)}</TabsTrigger>
          <TabsTrigger value="integrity">{t("diag_integrity" as any)}</TabsTrigger>
        </TabsList>

        <TabsContent value="errors">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                {errors.length === 0 ? t("noRlsErrorsCaptured") :
                  t("recentErrorsSummary").replace("{count}", String(errors.length)).replace("{stats}", Object.entries(errorStats).map(([k, v]) => `${k}:${v}`).join(" · "))}
              </div>
              <Button variant="outline" size="sm" onClick={() => { clearRlsErrors(); setErrors([]); }}>
                <Trash2 className="h-4 w-4 mr-1" />{t("diag_clear" as any)}
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("diag_time" as any)}</TableHead><TableHead>{t("diag_tableRpc" as any)}</TableHead><TableHead>{t("diag_method" as any)}</TableHead>
                <TableHead>{t("diag_status" as any)}</TableHead><TableHead>{t("diag_code" as any)}</TableHead><TableHead>{t("diag_msgHint" as any)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(e.ts).toLocaleTimeString()}</TableCell>
                    <TableCell className="font-mono text-xs">{e.table || (e.rpc ? `rpc:${e.rpc}` : "—")}</TableCell>
                    <TableCell><Badge variant="outline">{e.method}</Badge></TableCell>
                    <TableCell><Badge variant="destructive">{e.status}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.code || "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div>{e.message}</div>
                      {e.policyHint && <div className="text-amber-600 dark:text-amber-400 mt-1">💡 {t(e.policyHint as any)}</div>}
                    </TableCell>
                  </TableRow>
                ))}
                {errors.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noErrors")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">{t("rlsHealthCheckDesc")}</div>
              <Button onClick={runHealthCheck} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {t("diag_runHealth" as any)}
              </Button>
            </div>
            {probes.length > 0 && (
              <Alert className="mb-3">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>{t("diag_result" as any)}</AlertTitle>
                <AlertDescription>
                  {t("diag_passFail" as any).replace("{pass}", String(probes.filter(p => p.ok).length)).replace("{fail}", String(probes.filter(p => !p.ok).length))}
                </AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("diag_table" as any)}</TableHead><TableHead>{t("diag_op" as any)}</TableHead>
                <TableHead>{t("diag_status" as any)}</TableHead><TableHead>{t("diag_rows" as any)}</TableHead><TableHead>{t("diag_error" as any)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {probes.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{p.table}</TableCell>
                    <TableCell>{p.op}</TableCell>
                    <TableCell>
                      {p.ok ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />{t("diag_ok" as any)}</Badge>
                            : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{t("diag_fail" as any)}</Badge>}
                    </TableCell>
                    <TableCell>{p.rows ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.code ? `[${p.code}] ${p.message}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="isolation">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("loggedInUser")}: <span className="font-mono">{user?.email}</span> · {t("office")}: <span className="font-mono">{officeId || "(none / super_admin)"}</span>
              </div>
              <Button onClick={runIsolationTest} disabled={isoBusy}>
                {isoBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {t("diag_runIsolation" as any)}
              </Button>
            </div>
            {iso && (
              <>
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{t("diag_verdict" as any)}</AlertTitle>
                  <AlertDescription>{iso.verdict}</AlertDescription>
                </Alert>
                <div className="text-sm">
                  <div className="font-semibold mb-2">{t("diag_allOffices" as any)} ({iso.all_offices.length}):</div>
                  <ul className="text-xs space-y-1 mb-3">
                    {iso.all_offices.map((o: any) => <li key={o.id} className="font-mono">{o.id.slice(0, 8)} — {o.name}</li>)}
                  </ul>
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("diag_table" as any)}</TableHead><TableHead>{t("diag_rows" as any)}</TableHead><TableHead>{t("diag_distinctOffices" as any)}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(iso.tables).map(([tn, v]: any) => (
                      <TableRow key={tn}>
                        <TableCell className="font-mono text-xs">{tn}</TableCell>
                        <TableCell>{v.error ? <Badge variant="destructive">{v.code}</Badge> : v.rows}</TableCell>
                        <TableCell className="text-xs">
                          {v.error ? v.error :
                            (v.offices_visible.length === 0 ? "—" :
                              v.offices_visible.map((id: string) => <span key={id} className="font-mono mr-2">{id?.slice(0, 8) || "null"}</span>))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Alert>
                  <AlertTitle>{t("crossOfficeIsolationRule")}</AlertTitle>
                  <AlertDescription className="text-xs">
                    {t("crossOfficeIsolationDesc")}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="integrity">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("integrityScanDesc")}
              </div>
              <Button onClick={runIntegrityScan} disabled={scanBusy}>
                {scanBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {t("diag_runIntegrity" as any)}
              </Button>
            </div>
            {scan?.error && (
              <Alert variant="destructive"><AlertTitle>{t("diag_error" as any)}</AlertTitle><AlertDescription>{scan.error}</AlertDescription></Alert>
            )}
            {scan && !scan.error && (
              <>
                <Alert>
                  {scan.healthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>{scan.healthy ? t("diag_allClear" as any) : t("diag_issuesFound" as any).replace("{count}", String(scan.summary.total_issues))}</AlertTitle>
                  <AlertDescription className="text-xs">{t("diag_generatedAt" as any).replace("{date}", fmtDate(scan.generated_at))}</AlertDescription>
                </Alert>
                <Table>
                  <TableHeader><TableRow><TableHead>{t("diag_check" as any)}</TableHead><TableHead className="text-right">{t("diag_count" as any)}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(scan.summary).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-mono text-xs">{k}</TableCell>
                        <TableCell className="text-right">
                          {Number(v) > 0
                            ? <Badge variant="destructive">{String(v)}</Badge>
                            : <Badge>{String(v)}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {scan.ledger_orphans?.length > 0 && (
                  <div>
                    <div className="font-semibold text-sm mb-2">{t("diag_ledgerOrphans" as any)}</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>{t("diag_type" as any)}</TableHead><TableHead>{t("diag_referenceId" as any)}</TableHead><TableHead className="text-right">{t("diag_entries" as any)}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {scan.ledger_orphans.map((o: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="outline">{o.reference_type}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{o.reference_id}</TableCell>
                            <TableCell className="text-right">{o.entry_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
