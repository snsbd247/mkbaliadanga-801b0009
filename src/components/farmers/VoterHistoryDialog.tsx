import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface Props {
  farmerId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function VoterHistoryDialog({ farmerId, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !farmerId) return;
    setLoading(true);
    supabase.from("voter_audit_logs")
      .select("*")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { setRows((data as any[]) ?? []); setLoading(false); });
  }, [open, farmerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Voter Number History</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No history yet</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Old → New</TableHead>
                  <TableHead>Is Voter</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.voter_number_old || "—"} → {r.voter_number_new || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{String(r.is_voter_old ?? "—")} → {String(r.is_voter_new ?? "—")}</TableCell>
                    <TableCell className="text-xs">{r.changed_by ? r.changed_by.slice(0, 8) : "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
