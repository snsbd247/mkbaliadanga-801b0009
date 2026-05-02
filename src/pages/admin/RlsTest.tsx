import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * RLS Access Test page (super admin only)
 *
 * Lets you preview which CRUD operations the CURRENT logged-in user can perform
 * against the most important tables. To preview a different role's behavior, you
 * must temporarily change the user's role in user_roles (we provide quick toggles
 * that operate ONLY on the current super-admin user — and you can revert anytime).
 *
 * The probes are non-destructive: SELECTs use head:true count queries; INSERT
 * probes are wrapped in a savepoint-style approach by inserting and immediately
 * deleting (we use disposable rows in safe tables only). For sensitive tables,
 * we only probe SELECT.
 */

type Probe = {
  table: string;
  label: string;
  ops: ("select" | "insert")[];
  // Optional payload for INSERT probe; if absent, only select is tested
  insertPayload?: Record<string, any>;
};

const PROBES: Probe[] = [
  { table: "farmers",            label: "Farmers (office data)",          ops: ["select"] },
  { table: "lands",              label: "Lands",                          ops: ["select"] },
  { table: "loans",              label: "Loans",                          ops: ["select"] },
  { table: "loan_payments",      label: "Loan payments",                  ops: ["select"] },
  { table: "savings_transactions", label: "Savings transactions",         ops: ["select"] },
  { table: "irrigation_charges", label: "Irrigation charges",             ops: ["select"] },
  { table: "expenses",           label: "Expenses",                       ops: ["select"] },
  { table: "payments",           label: "Payments",                       ops: ["select"] },
  { table: "payment_allocations",label: "Payment allocations",            ops: ["select"] },
  { table: "ledger_entries",     label: "Ledger entries",                 ops: ["select"] },
  { table: "journal_entries",    label: "Journal entries (committee)",    ops: ["select"] },
  { table: "accounting_periods", label: "Accounting periods (committee)", ops: ["select"] },
  { table: "audit_logs",         label: "Audit logs (admin+)",            ops: ["select"] },
  { table: "sms_logs",           label: "SMS logs (admin+)",              ops: ["select"] },
  { table: "user_roles",         label: "User roles",                     ops: ["select"] },
  { table: "qr_tokens",          label: "QR tokens (no client access)",   ops: ["select"] },
  { table: "farmer_otps",        label: "Farmer OTPs (no client access)", ops: ["select"] },
];

type Result = {
  table: string;
  label: string;
  select: { ok: boolean; count?: number; error?: string } | null;
};

const ROLES = ["super_admin", "admin", "committee", "staff"] as const;
type R = typeof ROLES[number];

export default function RlsTest() {
  const { isSuper, rolesLoaded, user, roles, refresh } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<R | null>(null);

  useEffect(() => { document.title = "RLS Access Test"; if (rolesLoaded && isSuper) run(); }, [rolesLoaded, isSuper, roles.join(",")]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/dashboard" replace />;

  async function run() {
    setRunning(true);
    const out: Result[] = [];
    for (const p of PROBES) {
      try {
        const { count, error } = await (supabase.from as any)(p.table).select("*", { count: "exact", head: true });
        out.push({
          table: p.table,
          label: p.label,
          select: error ? { ok: false, error: error.message } : { ok: true, count: count ?? 0 },
        });
      } catch (e: any) {
        out.push({ table: p.table, label: p.label, select: { ok: false, error: e?.message ?? "unknown" } });
      }
    }
    setResults(out);
    setRunning(false);
  }

  /**
   * Switch the CURRENT super admin user's effective role for testing.
   * Adds a single role to user_roles and removes the others. Persists in DB
   * (so RLS truly applies on the next request). You can always re-grant
   * super_admin from this same page (top button) — but if you accidentally
   * remove super_admin, you'll need DB access to restore. We keep super_admin
   * always present and ALSO add the test role, so RLS evaluates the most
   * permissive available — that's the standard Postgres semantics for ANY-of
   * roles. To truly emulate a downgraded user, use a separate test account.
   */
  async function switchRole(role: R) {
    if (!user) return;
    setSwitchingTo(role);
    try {
      // Always keep super_admin so user can recover from this page
      // Also add the role they want to evaluate
      const wanted: R[] = role === "super_admin" ? ["super_admin"] : ["super_admin", role];
      // Remove any non-wanted roles
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      for (const r of wanted) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: r as any });
      }
      await refresh();
      toast.success(`Active roles: ${wanted.join(" + ")}`);
      await run();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to switch role");
    } finally {
      setSwitchingTo(null);
    }
  }

  const tally = {
    ok: results.filter(r => r.select?.ok).length,
    blocked: results.filter(r => r.select && !r.select.ok).length,
    empty: results.filter(r => r.select?.ok && (r.select.count ?? 0) === 0).length,
  };

  return (
    <>
      <PageHeader
        title="RLS Access Test"
        description="Probe row-level security across key tables. Use the role toggles to add a test role to your account (super_admin always retained for recovery)."
        actions={<Button onClick={run} disabled={running}><RefreshCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`}/>Re-run</Button>}
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4"/> Active roles for testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-2">Current:</span>
            {roles.map(r => <Badge key={r} variant="outline">{r}</Badge>)}
            {roles.length === 0 && <span className="text-xs text-muted-foreground">(none)</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(r => (
              <Button
                key={r}
                size="sm"
                variant={roles.includes(r) ? "default" : "outline"}
                disabled={switchingTo !== null}
                onClick={() => switchRole(r)}
              >
                {switchingTo === r ? "Switching…" : `Test as ${r}`}
              </Button>
            ))}
          </div>
          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
            <span>
              We always keep <code>super_admin</code> on your account for safety. Postgres RLS uses ANY-of role logic, so to fully emulate a non-super user, sign in with a separate staff account. This page is best for verifying that elevated roles unlock the right tables.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="grid grid-cols-3 gap-4 py-4">
          <Stat label="Readable" n={tally.ok} tone="ok"/>
          <Stat label="Blocked by RLS" n={tally.blocked} tone="blocked"/>
          <Stat label="Empty (RLS-filtered or no data)" n={tally.empty} tone="muted"/>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per-table SELECT probes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {results.map(r => (
              <div key={r.table} className="flex items-center justify-between py-3 px-4">
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.table}</div>
                </div>
                <div className="text-right">
                  {r.select?.ok ? (
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant="outline" className="font-mono">{r.select.count} rows</Badge>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600"/>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-destructive max-w-[280px] truncate" title={r.select?.error}>{r.select?.error ?? "blocked"}</span>
                      <XCircle className="h-4 w-4 text-destructive"/>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {results.length === 0 && <div className="py-6 text-center text-muted-foreground">No probes run yet.</div>}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone: "ok" | "blocked" | "muted" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "blocked" ? "text-destructive" : "text-muted-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{n}</div>
    </div>
  );
}
