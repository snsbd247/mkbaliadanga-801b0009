import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";

const TYPE_LABEL: Record<string, [string, string]> = {
  inheritance: ["Inheritance", "উত্তরাধিকার"],
  sale: ["Sale", "বিক্রয়"],
  borga_transfer: ["Borga Transfer", "বর্গা পরিবর্তন"],
  split: ["Split", "বিভাজন"],
  other: ["Other", "অন্যান্য"],
};

export default function LandTransferHistoryTab({ farmerId }: { farmerId: string }) {
  const { tx } = useLang();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmerId) return;
    (async () => {
      setLoading(true);
      // Transfers where this farmer is source OR is a recipient
      const [{ data: asSource }, { data: asRecipientLinks }] = await Promise.all([
        supabase.from("land_transfers")
          .select("*, source_land:lands!land_transfers_source_land_id_fkey(dag_no,mouza,land_size), source_farmer:farmers!land_transfers_source_farmer_id_fkey(name_en,name_bn,farmer_code), recipients:land_transfer_recipients(*, recipient_farmer:farmers!land_transfer_recipients_recipient_farmer_id_fkey(id,name_en,name_bn,farmer_code))")
          .eq("source_farmer_id", farmerId)
          .order("transferred_at", { ascending: false }),
        supabase.from("land_transfer_recipients")
          .select("transfer_id")
          .eq("recipient_farmer_id", farmerId),
      ]);

      const recipientTransferIds = Array.from(new Set((asRecipientLinks ?? []).map((r: any) => r.transfer_id)));
      let asRecipient: any[] = [];
      if (recipientTransferIds.length) {
        const { data } = await supabase.from("land_transfers")
          .select("*, source_land:lands!land_transfers_source_land_id_fkey(dag_no,mouza,land_size), source_farmer:farmers!land_transfers_source_farmer_id_fkey(name_en,name_bn,farmer_code), recipients:land_transfer_recipients(*, recipient_farmer:farmers!land_transfer_recipients_recipient_farmer_id_fkey(id,name_en,name_bn,farmer_code))")
          .in("id", recipientTransferIds)
          .order("transferred_at", { ascending: false });
        asRecipient = data ?? [];
      }
      const merged = [...(asSource ?? []), ...asRecipient];
      // Dedupe by id
      const seen = new Set<string>();
      const dedup = merged.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      dedup.sort((a, b) => (b.transferred_at || "").localeCompare(a.transferred_at || ""));
      setRows(dedup);
      setLoading(false);
    })();
  }, [farmerId]);

  if (loading) return <div className="text-sm text-muted-foreground p-4">{tx("Loading…", "লোড হচ্ছে…")}</div>;
  if (!rows.length) return <div className="text-sm text-muted-foreground p-4">{tx("No land transfer history.", "কোনো জমি হস্তান্তরের ইতিহাস নেই।")}</div>;

  return (
    <div className="space-y-4">
      {rows.map(r => {
        const isSource = r.source_farmer_id === farmerId;
        const lbl = TYPE_LABEL[r.transfer_type] ?? [r.transfer_type, r.transfer_type];
        return (
          <div key={r.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={isSource ? "destructive" : "default"}>{isSource ? tx("Given out", "প্রদানকৃত") : tx("Received", "প্রাপ্ত")}</Badge>
                <Badge variant="outline">{tx(lbl[0], lbl[1])}</Badge>
                <span className="text-xs text-muted-foreground">{fmtDate(r.transferred_at)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {tx("Source dag:", "মূল দাগ:")} <b>{r.source_land?.dag_no ?? "—"}</b> ({r.source_land?.mouza ?? "—"}) — {Number(r.source_land?.land_size ?? 0).toFixed(2)} {tx("decimal", "শতক")}
              </div>
            </div>
            <div className="text-xs mb-2">
              {tx("From:", "থেকে:")} <Link to={`/farmers/${r.source_farmer_id}`} className="underline text-primary">{r.source_farmer?.name_bn || r.source_farmer?.name_en || "—"}</Link>
              {r.source_farmer?.farmer_code && <span className="text-muted-foreground"> ({r.source_farmer.farmer_code})</span>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Recipient", "প্রাপক")}</TableHead>
                  <TableHead className="text-right">{tx("Area (decimal)", "পরিমাণ (শতক)")}</TableHead>
                  <TableHead>{tx("New Land", "নতুন জমি")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(r.recipients ?? []).map((rc: any) => (
                  <TableRow key={rc.id}>
                    <TableCell>
                      <Link to={`/farmers/${rc.recipient_farmer_id}`} className="underline text-primary">
                        {rc.recipient_farmer?.name_bn || rc.recipient_farmer?.name_en || "—"}
                      </Link>
                      {rc.recipient_farmer?.farmer_code && <span className="text-xs text-muted-foreground"> ({rc.recipient_farmer.farmer_code})</span>}
                    </TableCell>
                    <TableCell className="text-right">{Number(rc.area_decimal).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      {rc.new_land_id ? <Link to={`/lands/${rc.new_land_id}`} className="underline">{rc.new_land_id.slice(0, 8)}</Link> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {r.remark && <div className="mt-2 text-xs italic text-muted-foreground">{tx("Remark:", "মন্তব্য:")} {r.remark}</div>}
          </div>
        );
      })}
    </div>
  );
}
