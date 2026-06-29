import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle, FileSpreadsheet, FileText, Wrench, ExternalLink } from "lucide-react";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { exportExcel } from "@/lib/exports";
import { downloadCsv } from "@/lib/csvExport";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

type Row = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string | null;
  invoiced_due: number;
  invoiced_paid: number;
  collected_split: number;
  legacy_collected: number;
  delta: number;
};

export default function IrrigationDueMismatch() {
  const { tx } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalcId, setRecalcId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: invs } = await db
        .from("irrigation_invoices")
        .select("farmer_id,due_amount,paid_amount,payable_amount,farmers!irrigation_invoices_farmer_id_fkey(name_en,farmer_code)")
        .is("deleted_at", null)
        .neq("invoice_status", "cancelled")
        .limit(20000);

      const { data: iips } = await db
        .from("irrigation_invoice_payments")
        .select("invoice_id,collected_amount,current_invoice_collected,previous_due_collected,irrigation_invoices(farmer_id)")
        .limit(20000);

      const byFarmer = new Map<string, Row>();
      (invs ?? []).forEach((r: any) => {
        const cur = byFarmer.get(r.farmer_id) ?? {
          farmer_id: r.farmer_id,
          farmer_name: r.farmers?.name_en ?? "—",
          farmer_code: r.farmers?.farmer_code ?? null,
          invoiced_due: 0, invoiced_paid: 0, collected_split: 0, legacy_collected: 0, delta: 0,
        };
        cur.invoiced_due += Number(r.due_amount || 0);
        cur.invoiced_paid += Number(r.paid_amount || 0);
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
        // Drift between invoice.paid_amount and split-payments aggregate
        const delta = Math.max(
          Math.abs(r.legacy_collected - r.collected_split),
          Math.abs(r.invoiced_paid - r.legacy_collected),
        );
        if (delta > 0.01) out.push({ ...r, delta });
      });
      out.sort((a, b) => b.delta - a.delta);
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { document.title = tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল"); load(); }, []);

  function exportXlsx() {
    if (!rows.length) return toast.error(tx("Nothing to export", "এক্সপোর্ট করার মতো কিছু নেই"));
    exportExcel("irrigation-due-mismatch.xlsx", "Mismatch", rows.map(r => ({
      "Farmer": r.farmer_name,
      "Code": r.farmer_code ?? "",
      "Invoiced Due": r.invoiced_due,
      "Invoice Paid": r.invoiced_paid,
      "Legacy Collected": r.legacy_collected,
      "Split (Cur+Prev)": r.collected_split,
      "Delta": r.delta,
    })));
  }
  function exportCsv() {
    if (!rows.length) return toast.error(tx("Nothing to export", "এক্সপোর্ট করার মতো কিছু নেই"));
    downloadCsv(`irrigation-due-mismatch-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Farmer ID", accessor: r => r.farmer_id },
      { header: "Farmer", accessor: r => r.farmer_name },
      { header: "Code", accessor: r => r.farmer_code ?? "" },
      { header: "Invoiced Due", accessor: r => r.invoiced_due },
      { header: "Invoice Paid", accessor: r => r.invoiced_paid },
      { header: "Legacy Collected", accessor: r => r.legacy_collected },
      { header: "Split (Cur+Prev)", accessor: r => r.collected_split },
      { header: "Delta", accessor: r => r.delta },
    ]);
  }

  async function recalcFarmer(farmerId: string) {
    setRecalcId(farmerId);
    const tid = toast.loading(tx("Recalculating…", "রিক্যালকুলেট হচ্ছে…"));
    try {
      // Pull invoices + payment splits for this farmer; rederive paid_amount + due_amount
      const { data: invs, error: e1 } = await db
        .from("irrigation_invoices")
        .select("id,payable_amount,office_id")
        .eq("farmer_id", farmerId)
        .is("deleted_at", null)
        .neq("invoice_status", "cancelled");
      if (e1) throw e1;

      const ids = (invs ?? []).map(i => i.id);
      const { data: pays } = ids.length
        ? await db
            .from("irrigation_invoice_payments")
            .select("invoice_id,current_invoice_collected,previous_due_collected,collected_amount")
            .in("invoice_id", ids)
        : { data: [] as any[] };

      const sumByInv = new Map<string, number>();
      (pays ?? []).forEach((p: any) => {
        const split = Number(p.current_invoice_collected || 0) + Number(p.previous_due_collected || 0);
        // Trust split if non-zero, else fallback to legacy collected_amount
        const v = split > 0 ? split : Number(p.collected_amount || 0);
        sumByInv.set(p.invoice_id, (sumByInv.get(p.invoice_id) || 0) + v);
      });

      let updated = 0;
      for (const inv of invs ?? []) {
        const paid = Math.min(Number(inv.payable_amount || 0), sumByInv.get(inv.id) || 0);
        const due = Math.max(0, Number(inv.payable_amount || 0) - paid);
        const { error: eUp } = await db
          .from("irrigation_invoices")
          .update({ paid_amount: paid, due_amount: due })
          .eq("id", inv.id);
        if (!eUp) {
          updated++;
          await db.from("irrigation_invoice_audit").insert({
            invoice_id: inv.id,
            office_id: inv.office_id,
            action: "recalculate",
            note: "Mismatch report — recalculated paid/due from irrigation_invoice_payments",
          } as any);
          logAudit({
            module: "irrigation_invoice",
            action_type: "recalculate",
            office_id: inv.office_id,
            reference_id: inv.id,
            new_data: { paid_amount: paid, due_amount: due, source: "mismatch_report" },
          });
        }
      }
      toast.success(tx(`Recalculated ${updated} invoices`, `${updated}টি ইনভয়েস রিক্যালকুলেট হয়েছে`), { id: tid });
      await load();
    } catch (e: any) {
      toast.error(e?.message || tx("Recalculate failed", "রিক্যালকুলেট ব্যর্থ"), { id: tid });
    } finally {
      setRecalcId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={tx("Irrigation Due Mismatch", "সেচ বকেয়া অমিল")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <FileText className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1" />{tx("Refresh", "রিফ্রেশ")}
            </Button>
          </div>
        }
      />
      <Card className="p-3 mb-3 text-sm flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {tx(
          "Compares invoice paid_amount vs split-payments aggregate per farmer. Non-zero delta = data drift; use Recalculate to repair.",
          "ইনভয়েসের paid_amount ও বিভাজন-পেমেন্ট মোটের তুলনা। অমিল থাকলে রিক্যালকুলেট করুন।",
        )}
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead className="text-right">{tx("Invoiced Due", "ইনভয়েস বকেয়া")}</TableHead>
              <TableHead className="text-right">{tx("Invoice Paid", "ইনভয়েস পরিশোধিত")}</TableHead>
              <TableHead className="text-right">{tx("Legacy Coll.", "পুরাতন গ্রহণ")}</TableHead>
              <TableHead className="text-right">{tx("Split (Cur+Prev)", "বিভাজিত")}</TableHead>
              <TableHead className="text-right">{tx("Δ", "পার্থক্য")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No mismatches found ✓", "কোনো অমিল নেই ✓")}</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.farmer_id}>
                <TableCell>{r.farmer_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{money(r.invoiced_due)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.invoiced_paid)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.legacy_collected)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.collected_split)}</TableCell>
                <TableCell className="text-right font-mono"><Badge variant="destructive">{money(r.delta)}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Link to={`/farmers/${r.farmer_id}`}>
                      <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />{tx("View", "দেখুন")}</Button>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => recalcFarmer(r.farmer_id)}
                      disabled={recalcId === r.farmer_id}
                    >
                      {recalcId === r.farmer_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        : <Wrench className="h-3.5 w-3.5 mr-1" />}
                      {tx("Recalc", "রিক্যাল")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
