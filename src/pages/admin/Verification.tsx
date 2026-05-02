import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, Database } from "lucide-react";

type Counts = Record<string, number>;

const LOCATION_TABLES = ["divisions", "districts", "upazilas", "unions", "wards", "mouzas"];
const DEMO_TABLES = [
  "offices", "farmers", "lands", "land_relations",
  "seasons", "irrigation_charges",
  "loans", "loan_payments",
  "savings_transactions", "expenses",
  "payments", "payment_allocations",
  "ledger_entries", "audit_logs",
];

async function countTable(name: string): Promise<number> {
  const { count, error } = await (supabase.from as any)(name).select("*", { count: "exact", head: true });
  if (error) return -1;
  return count ?? 0;
}

export default function Verification() {
  const { isSuper, isAdmin, rolesLoaded } = useAuth();
  const [loc, setLoc] = useState<Counts>({});
  const [demo, setDemo] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [ledgerOk, setLedgerOk] = useState<boolean | null>(null);
  const [ledgerSummary, setLedgerSummary] = useState<any>(null);

  async function load() {
    setLoading(true);
    const lc: Counts = {};
    const dc: Counts = {};
    await Promise.all([
      ...LOCATION_TABLES.map(async (t) => { lc[t] = await countTable(t); }),
      ...DEMO_TABLES.map(async (t) => { dc[t] = await countTable(t); }),
    ]);
    setLoc(lc);
    setDemo(dc);
    // Ledger integrity (super admin only — function is security definer though)
    try {
      const { data } = await supabase.rpc("ledger_integrity_summary" as any);
      setLedgerSummary(data);
      const s = data as any;
      setLedgerOk(s && s.unbalanced === 0 && s.orphan === 0 && s.missing_account === 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { document.title = "Verification Report"; if (rolesLoaded) load(); }, [rolesLoaded]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const Row = ({ name, n, expected }: { name: string; n: number; expected?: string }) => (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <div>
        <div className="font-medium capitalize">{name.replace(/_/g, " ")}</div>
        {expected && <div className="text-xs text-muted-foreground">expected: {expected}</div>}
      </div>
      <div className="text-right">
        <div className={`font-mono text-lg ${n < 0 ? "text-destructive" : n === 0 ? "text-muted-foreground" : "text-foreground"}`}>
          {n < 0 ? "—" : n.toLocaleString()}
        </div>
        {n < 0 && <div className="text-xs text-destructive">no access / RLS blocked</div>}
      </div>
    </div>
  );

  const totalLoc = Object.values(loc).reduce((a, b) => a + Math.max(b, 0), 0);
  const totalDemo = Object.values(demo).reduce((a, b) => a + Math.max(b, 0), 0);

  return (
    <>
      <PageHeader
        title="Verification Report"
        description="Counts of imported locations and demo records visible to your account under RLS."
        actions={<Button onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}/>Refresh</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4"/> Locations ({totalLoc.toLocaleString()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row name="divisions" n={loc.divisions ?? 0} expected="8"/>
            <Row name="districts" n={loc.districts ?? 0} expected="64"/>
            <Row name="upazilas" n={loc.upazilas ?? 0} expected="~492"/>
            <Row name="unions" n={loc.unions ?? 0} expected="sample 5"/>
            <Row name="wards" n={loc.wards ?? 0} expected="sample 9"/>
            <Row name="mouzas" n={loc.mouzas ?? 0} expected="sample 5"/>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4"/> Demo entities ({totalDemo.toLocaleString()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {DEMO_TABLES.map((t) => <Row key={t} name={t} n={demo[t] ?? 0}/>)}
          </CardContent>
        </Card>
      </div>

      {isSuper && ledgerSummary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {ledgerOk ? <CheckCircle2 className="h-5 w-5 text-emerald-600"/> : <AlertTriangle className="h-5 w-5 text-amber-600"/>}
              Ledger integrity
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><div className="text-muted-foreground text-xs">Total entries</div><div className="font-mono">{ledgerSummary.total_entries}</div></div>
            <div><div className="text-muted-foreground text-xs">Unbalanced refs</div><div className={`font-mono ${ledgerSummary.unbalanced > 0 ? "text-destructive" : ""}`}>{ledgerSummary.unbalanced}</div></div>
            <div><div className="text-muted-foreground text-xs">Orphan refs</div><div className={`font-mono ${ledgerSummary.orphan > 0 ? "text-destructive" : ""}`}>{ledgerSummary.orphan}</div></div>
            <div><div className="text-muted-foreground text-xs">Missing account</div><div className={`font-mono ${ledgerSummary.missing_account > 0 ? "text-destructive" : ""}`}>{ledgerSummary.missing_account}</div></div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        Note: A "—" or "no access" value means the current account cannot read that table under RLS — that's expected for non-super roles on certain tables.
      </div>
    </>
  );
}
