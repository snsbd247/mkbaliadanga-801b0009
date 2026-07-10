import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { namesMatchMouza, resolvePaymentMouzas } from "@/lib/mouzaQuery";
import { toast } from "sonner";

/**
 * Dev/debug screen for the Receipts mouza filter. Loads recent irrigation
 * payments, resolves each one's mouza (invoice→land→mouza, then farmer-land
 * fallback) and shows the exact name variants used for matching, so a mismatch
 * between the selected filter and the stored name_bn/name/text is easy to spot.
 */
type Row = {
  id: string;
  receipt_no: string | null;
  farmer: string;
  source: "invoice-payment" | "reference-invoice" | "farmer-invoice" | "farmer-land" | "none";
  mouzaId: string | null;
  resolved: string;
  variants: string[];
};

export default function ReceiptMouzaDebug() {
  const { t, tx } = useLang();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [mouza, setMouza] = useState("");

  useEffect(() => { document.title = `${tx("Receipt Mouza Debug", "রশিদ মৌজা ডিবাগ")} — ${t("appName")}`; }, [t, tx]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    const { data: pays, error } = await db
      .from("payments")
      .select("id, receipt_no, farmer_id, kind, farmers(name_bn,name_en,farmer_code)")
      .eq("kind", "irrigation")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const irr = pays ?? [];
    const payIds = irr.map((p: any) => p.id);

    const resolved = payIds.length ? await resolvePaymentMouzas(irr as any[]) : {};

    setRows(irr.map((p: any) => {
      const r = resolved[p.id];
      return {
        id: p.id,
        receipt_no: p.receipt_no,
        farmer: `${p.farmers?.name_bn || p.farmers?.name_en || "—"} (${p.farmers?.farmer_code ?? ""})`,
        source: r?.source ?? "none",
        mouzaId: r?.mouzaId ?? null,
        resolved: r?.name ?? "",
        variants: r?.variants ?? [],
      };
    }));
    setLoading(false);
  }

  const filtered = useMemo(
    () => rows.map((r) => ({ ...r, matches: namesMatchMouza(r.variants, mouza) })),
    [rows, mouza],
  );
  const matchCount = filtered.filter((r) => r.matches).length;
  const noMouza = rows.filter((r) => r.source === "none").length;

  return (
    <>
      <PageHeader
        title={tx("Receipt Mouza Debug", "রশিদ মৌজা ডিবাগ")}
        description={tx("Inspect which receipts match a selected mouza and why", "কোন রশিদ কোন মৌজায় ম্যাচ করছে তা যাচাই")}
        actions={<Button variant="outline" size="sm" onClick={load}>{tx("Refresh", "রিফ্রেশ")}</Button>}
      />
      <div className="p-4 space-y-4">
        <Card className="p-4 grid gap-3 sm:grid-cols-3 items-end">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{tx("Test mouza filter", "মৌজা ফিল্টার টেস্ট")}</div>
            <MouzaSelect value={mouza} onChange={setMouza} placeholder={tx("Any mouza", "যেকোনো মৌজা")} />
          </div>
          <div><div className="text-xs text-muted-foreground">{tx("Matching receipts", "ম্যাচ করা রশিদ")}</div><div className="text-2xl font-bold">{mouza ? matchCount : rows.length}</div></div>
          <div><div className="text-xs text-muted-foreground">{tx("No mouza resolved", "মৌজা পাওয়া যায়নি")}</div><div className="text-2xl font-bold text-destructive">{noMouza}</div></div>
        </Card>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Receipt #", "রশিদ নং")}</TableHead>
                <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
                <TableHead>{tx("Resolved mouza", "প্রকৃত মৌজা")}</TableHead>
                <TableHead>{tx("Mouza ID", "মৌজা আইডি")}</TableHead>
                <TableHead>{tx("Variants", "ভ্যারিয়েন্ট")}</TableHead>
                <TableHead>{tx("Source", "উৎস")}</TableHead>
                <TableHead>{tx("Matches filter", "ফিল্টার ম্যাচ")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No irrigation receipts", "কোনো সেচ রশিদ নেই")}</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className={mouza && !r.matches ? "opacity-50" : ""}>
                    <TableCell>{r.receipt_no ?? "—"}</TableCell>
                    <TableCell>{r.farmer}</TableCell>
                    <TableCell>{r.resolved || "—"}</TableCell>
                    <TableCell className="text-xs">{r.variants.join(" · ") || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.source === "none" ? "destructive" : r.source === "farmer-land" || r.source === "farmer-invoice" ? "secondary" : "outline"}>
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.mouzaId ?? "—"}</TableCell>
                    <TableCell>{mouza ? (r.matches ? "✅" : "—") : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
