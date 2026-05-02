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

const OPERATIONAL_TABLES = [
  "farmers", "loans", "loan_payments", "savings_transactions",
  "irrigation_charges", "payments", "payment_allocations",
  "expenses", "lands", "land_relations", "shares", "receipts",
] as const;

const REFERENCE_TABLES = ["offices", "seasons", "company_settings", "user_roles", "user_permissions", "profiles", "notifications", "audit_logs"] as const;

type Probe = { table: string; op: "select" | "count"; ok: boolean; status?: number; code?: string; message?: string; rows?: number };

export default function Diagnostics() {
  const { isSuper, user, officeId, rolesLoaded } = useAuth();
  const [errors, setErrors] = useState<RlsErrorEntry[]>(getRlsErrors());
  const [probes, setProbes] = useState<Probe[]>([]);
  const [running, setRunning] = useState(false);
  const [iso, setIso] = useState<any>(null);
  const [isoBusy, setIsoBusy] = useState(false);

  useEffect(() => { document.title = "Diagnostics — RLS"; }, []);
  useEffect(() => {
    const h = () => setErrors(getRlsErrors());
    window.addEventListener("rls-errors-changed", h);
    return () => window.removeEventListener("rls-errors-changed", h);
  }, []);

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
    const tables = ["farmers", "loans", "savings_transactions", "payments", "irrigation_charges", "expenses"] as const;
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
      ? "super_admin সব office এর ডাটা দেখতে পাচ্ছে — isolation policy super_admin bypass সঠিক।"
      : "শুধুমাত্র এক office এর ডাটা দৃশ্যমান (অথবা ডাটা নেই অন্য office-এ)।";
    setIso(result);
    setIsoBusy(false);
  }

  const errorStats = useMemo(() => {
    const byCode: Record<string, number> = {};
    errors.forEach(e => { const k = e.code || `HTTP ${e.status}`; byCode[k] = (byCode[k] || 0) + 1; });
    return byCode;
  }, [errors]);

  return (
    <>
      <PageHeader title="RLS Diagnostics" />

      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors">Recent Errors {errors.length > 0 && <Badge variant="destructive" className="ml-2">{errors.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="health">RLS Health Check</TabsTrigger>
          <TabsTrigger value="isolation">Office Isolation</TabsTrigger>
        </TabsList>

        <TabsContent value="errors">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                {errors.length === 0 ? "এখনো কোনো RLS error capture হয়নি।" :
                  `${errors.length} টি সাম্প্রতিক error · ${Object.entries(errorStats).map(([k, v]) => `${k}:${v}`).join(" · ")}`}
              </div>
              <Button variant="outline" size="sm" onClick={() => { clearRlsErrors(); setErrors([]); }}>
                <Trash2 className="h-4 w-4 mr-1" />Clear
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>Table / RPC</TableHead><TableHead>Method</TableHead>
                <TableHead>Status</TableHead><TableHead>Code</TableHead><TableHead>Message / Hint</TableHead>
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
                      {e.policyHint && <div className="text-amber-600 dark:text-amber-400 mt-1">💡 {e.policyHint}</div>}
                    </TableCell>
                  </TableRow>
                ))}
                {errors.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">কোনো error নেই।</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">প্রতিটা টেবিলে SELECT permission test করা হবে।</div>
              <Button onClick={runHealthCheck} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Run health check
              </Button>
            </div>
            {probes.length > 0 && (
              <Alert className="mb-3">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Result</AlertTitle>
                <AlertDescription>
                  {probes.filter(p => p.ok).length} pass · {probes.filter(p => !p.ok).length} fail
                </AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader><TableRow>
                <TableHead>Table</TableHead><TableHead>Op</TableHead>
                <TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Error</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {probes.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{p.table}</TableCell>
                    <TableCell>{p.op}</TableCell>
                    <TableCell>
                      {p.ok ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />OK</Badge>
                            : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />FAIL</Badge>}
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
                লগইন user: <span className="font-mono">{user?.email}</span> · office: <span className="font-mono">{officeId || "(none / super_admin)"}</span>
              </div>
              <Button onClick={runIsolationTest} disabled={isoBusy}>
                {isoBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Run isolation test
              </Button>
            </div>
            {iso && (
              <>
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Verdict</AlertTitle>
                  <AlertDescription>{iso.verdict}</AlertDescription>
                </Alert>
                <div className="text-sm">
                  <div className="font-semibold mb-2">All offices ({iso.all_offices.length}):</div>
                  <ul className="text-xs space-y-1 mb-3">
                    {iso.all_offices.map((o: any) => <li key={o.id} className="font-mono">{o.id.slice(0, 8)} — {o.name}</li>)}
                  </ul>
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Table</TableHead><TableHead>Rows</TableHead><TableHead>Distinct office_ids visible</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(iso.tables).map(([t, v]: any) => (
                      <TableRow key={t}>
                        <TableCell className="font-mono text-xs">{t}</TableCell>
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
                  <AlertTitle>Cross-office isolation নিয়ম</AlertTitle>
                  <AlertDescription className="text-xs">
                    Non-super user যখন লগইন করবে, প্রতিটা টেবিলে শুধু একটা office_id দেখা উচিত (তার নিজের)। Super admin সব office দেখতে পারে।
                    Test করতে চাইলে: একজন admin/staff role এর user দিয়ে লগইন করে এই পেজ চালান।
                  </AlertDescription>
                </Alert>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
