import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string | null;
  invoiced_due: number;       // sum(irrigation_invoices.due_amount)
  collected_split: number;    // sum(iip.current_invoice_collected + iip.previous_due_collected)
  legacy_collected: number;   // sum(iip.collected_amount)
  delta: number;              // |invoiced_due - (legacy_collected - collected_split adjustments)|
};

export default function IrrigationDueMismatch() {
  const { tx } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // Fetch invoices grouped by farmer
      const { data: invs } = await supabase
        .from("irrigation_invoices")
        .select("farmer_id,due_amount,paid_amount,payable_amount,farmers(name_en,farmer_code)")
        .is("deleted_at", null)
        .neq("invoice_status", "cancelled")
        .limit(20000);

      const { data: iips } = await supabase
        .from("irrigation_invoice_payments")
        .select("invoice_id,collected_amount,current_invoice_collected,previous_due_collected,irrigation_invoices(farmer_id)")
        .limit(20000);

      const byFarmer = new Map<string, Row>();
      (invs ?? []).forEach((r: any) => {
        const cur = byFarmer.get(r.farmer_id) ?? {
          farmer_id: r.farmer_id,
          farmer_name: r.farmers?.name_en ?? "—",
          farmer_code: r.farmers?.farmer_code ?? null,
          invoiced_due: 0, collected_split: 0, legacy_collected: 0, delta: 0,
        };
        cur.invoiced_due += Number(r.due_amount || 0);
        byFarmer.set(r.farmer_id, cur);
      });
      (iips ?? []).forEach((r: any) => {
        const fId = r.irrigation_invoices?.farmer_id;
        if (!fId) return;
        const cur = byFarmer.get(fId);
        if (!cur) return;
        cur.collected_split += Number(r.current_invoice_collected || 0) + Number(r.previous_due_collected || 0);
        cur.legacy_collected += Number(r.collected_amount || 0);
      });

      const out: Row[] = [];
      byFarmer.forEach((r) => {
        // Mismatch when: split breakdown ≠ legacy aggregate (drift between modes)
        const delta = Math.abs(r.legacy_collected - r.collected_split);
        if (delta > 0.01) out.push({ ...r, delta });
      });
      out.sort((a, b) => b.delta - a.delta);
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { document.title = tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল"); load(); }, []);

  return (
    <>
      <PageHeader
        title={tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল")}
        right={<Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}</Button>}
      />
      <Card className="p-3 mb-3 text-sm flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {tx(
          "Compares legacy collected_amount vs new split (current + previous) per farmer. Non-zero delta = data drift.",
          "প্রতিটি ফার্মারের জন্য পুরাতন collected_amount ও নতুন বিভাজন (বর্তমান + পূর্বের) এর মধ্যে তুলনা।",
        )}
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead className="text-right">{tx("Invoiced Due", "ইনভয়েস বকেয়া")}</TableHead>
              <TableHead className="text-right">{tx("Legacy Collected", "পুরাতন গ্রহণ")}</TableHead>
              <TableHead className="text-right">{tx("Split (Cur+Prev)", "বিভাজিত")}</TableHead>
              <TableHead className="text-right">{tx("Δ Delta", "পার্থক্য")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No mismatches found ✓", "কোনো অমিল নেই ✓")}</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.farmer_id}>
                <TableCell>{r.farmer_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{money(r.invoiced_due)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.legacy_collected)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.collected_split)}</TableCell>
                <TableCell className="text-right font-mono"><Badge variant="destructive">{money(r.delta)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
