import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

const TABLES = [
  { key: "farmers", after: 10 },
  { key: "lands", after: 10 },
  { key: "loans", after: 1 },
  { key: "loan_payments", after: 0 },
  { key: "payments", after: 0 },
  { key: "savings_transactions", after: 5 },
  { key: "irrigation_charges", after: 0 },
  { key: "expenses", after: 0 },
  { key: "ledger_entries", after: 0 },
  { key: "journal_entries", after: 0 },
  { key: "payment_allocations", after: 0 },
  { key: "receipts", after: 0 },
  { key: "notifications", after: 0 },
  { key: "audit_logs", after: 0 },
];

export default function DemoReset() {
  const { isSuper, rolesLoaded } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isSuper) loadCounts(); }, [isSuper]);

  async function loadCounts() {
    setLoading(true);
    const result: Record<string, number> = {};
    await Promise.all(TABLES.map(async (t) => {
      const { count } = await supabase.from(t.key as any).select("*", { count: "exact", head: true });
      result[t.key] = count ?? 0;
    }));
    setCounts(result);
    setLoading(false);
  }

  async function runReset() {
    if (confirmText !== "RESET") return toast.error("Type RESET to confirm");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("demo-reset", { body: { confirm: "RESET" } });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Reset failed");
      return;
    }
    toast.success(`Demo data restored. ${data?.farmers_inserted ?? 0} farmers seeded.`);
    setConfirmOpen(false); setConfirmText("");
    loadCounts();
  }

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/admin" replace />;

  return (
    <>
      <PageHeader title="Demo Data Reset" description="Wipe transactional data and restore the demo dataset. Locations, offices, users, and settings are preserved." />

      <Alert className="mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          This is destructive for transactional data (farmers, loans, payments, ledger). Locations, offices, users, accounts, and settings are kept intact.
        </AlertDescription>
      </Alert>

      <Card className="mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead className="text-right">Current rows</TableHead>
              <TableHead className="text-right">After reset</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLES.map((t) => {
              const cur = counts[t.key] ?? 0;
              const diff = t.after - cur;
              return (
                <TableRow key={t.key}>
                  <TableCell className="font-mono text-xs">{t.key}</TableCell>
                  <TableCell className="text-right">{loading ? "…" : cur}</TableCell>
                  <TableCell className="text-right">{t.after}</TableCell>
                  <TableCell className={`text-right ${diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={loadCounts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Reset to demo data
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm destructive reset</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Type <code className="bg-muted px-1.5 py-0.5 rounded font-mono">RESET</code> to confirm. All transactional data will be replaced with demo records.</p>
            <Label>Confirmation</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || confirmText !== "RESET"} onClick={runReset}>
              {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Resetting…</> : "Confirm reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
