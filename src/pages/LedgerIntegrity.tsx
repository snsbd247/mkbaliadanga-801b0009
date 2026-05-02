import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";

export default function LedgerIntegrity() {
  const [unbalanced, setUnbalanced] = useState<any[]>([]);
  const [orphans, setOrphans] = useState<any[]>([]);
  const [missingAccts, setMissingAccts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: u }, { data: o }, { data: m }] = await Promise.all([
        supabase.rpc("ledger_unbalanced_refs"),
        supabase.rpc("ledger_orphan_refs"),
        supabase.from("ledger_entries").select("id,account_id").is("account_id", null).limit(100),
      ]);
      setUnbalanced((u as any[]) || []);
      setOrphans((o as any[]) || []);
      setMissingAccts((m as any[]) || []);
    })();
  }, []);

  const ok = (n: number) => <Badge variant={n === 0 ? "secondary" : "destructive"}>{n}</Badge>;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Ledger Integrity Check" description="Unbalanced postings, orphan references, and missing accounts" />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Unbalanced postings {ok(unbalanced.length)}</CardTitle>
        </CardHeader>
        <CardContent>
          {unbalanced.length === 0 ? (
            <p className="text-sm text-primary">✅ All references are balanced.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Reference Type</TableHead><TableHead>Reference ID</TableHead>
                <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Diff</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {unbalanced.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.reference_type}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_id}</TableCell>
                    <TableCell className="text-right">{money(r.total_debit)}</TableCell>
                    <TableCell className="text-right">{money(r.total_credit)}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">{money(r.diff)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Orphan references {ok(orphans.length)}</CardTitle></CardHeader>
        <CardContent>
          {orphans.length === 0 ? (
            <p className="text-sm text-primary">✅ Every ledger entry points to an existing source row.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Reference Type</TableHead><TableHead>Reference ID</TableHead><TableHead className="text-right">Entries</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orphans.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.reference_type}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_id}</TableCell>
                    <TableCell className="text-right">{r.entry_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Missing account links {ok(missingAccts.length)}</CardTitle></CardHeader>
        <CardContent>
          {missingAccts.length === 0
            ? <p className="text-sm text-primary">✅ All entries reference an existing account.</p>
            : <p className="text-sm text-destructive">{missingAccts.length} entries have no account_id.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
