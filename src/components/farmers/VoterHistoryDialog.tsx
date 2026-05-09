import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  farmerId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function VoterHistoryDialog({ farmerId, open, onOpenChange }: Props) {
  const { tx } = useLang();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !farmerId) return;
    setLoading(true);
    setError(null);
    supabase.from("voter_audit_logs")
      .select("*")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          setError(
            /permission|rls|row-level security/i.test(error.message)
              ? tx("You don't have permission to view this farmer's voter history.", "এই কৃষকের ভোটার ইতিহাস দেখার অনুমতি আপনার নেই।")
              : tx("Failed to load history.", "ইতিহাস লোড করা যায়নি।")
          );
          setRows([]);
        } else {
          setRows((data as any[]) ?? []);
        }
        setLoading(false);
      });
  }, [open, farmerId, tx]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tx("Voter Number History", "ভোটার নম্বর ইতিহাস")}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />{tx("Loading…", "লোড হচ্ছে…")}
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive" role="alert">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{tx("No history yet", "এখনো কোনো ইতিহাস নেই")}</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("When", "কখন")}</TableHead>
                  <TableHead>{tx("Old → New", "পুরাতন → নতুন")}</TableHead>
                  <TableHead>{tx("Is Voter", "ভোটার?")}</TableHead>
                  <TableHead>{tx("Changed by", "পরিবর্তনকারী")}</TableHead>
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
