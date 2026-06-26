// Live land-transfer integrity report for the Demo Manager.
// Fetches transfers, recipients and the referenced lands, then runs the pure
// checker in src/lib/landTransferIntegrity.ts and renders the result.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import {
  checkLandTransferIntegrity, summarizeIntegrity,
  type IntegrityViolation, type IntegritySummary,
} from "@/lib/landTransferIntegrity";

const sb = supabase as any;

export default function LandTransferVerifyCard() {
  const { tx } = useLang();
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<IntegrityViolation[] | null>(null);
  const [summary, setSummary] = useState<IntegritySummary | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const [{ data: transfers, error: e1 }, { data: recipients, error: e2 }] = await Promise.all([
        sb.from("land_transfers").select(
          "id,source_land_id,source_farmer_id,transfer_type,source_dag_no,source_mouza,source_land_size,source_owner_name,source_owner_code,transferred_at"),
        sb.from("land_transfer_recipients").select("id,transfer_id,recipient_farmer_id,new_land_id,area_decimal"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      // Collect referenced land ids (source + new) to validate existence/archival.
      const landIds = new Set<string>();
      (transfers ?? []).forEach((t: any) => t.source_land_id && landIds.add(t.source_land_id));
      (recipients ?? []).forEach((r: any) => r.new_land_id && landIds.add(r.new_land_id));

      let lands: any[] = [];
      const ids = Array.from(landIds);
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from("lands")
          .select("id,farmer_id,dag_no,land_size,deleted_at")
          .in("id", ids.slice(i, i + 200));
        lands = lands.concat(data ?? []);
      }

      const input = { transfers: transfers ?? [], recipients: recipients ?? [], lands };
      const v = checkLandTransferIntegrity(input);
      setViolations(v);
      setSummary(summarizeIntegrity(input, v));
      if (!v.length) toast.success(tx("All land transfers are consistent.", "সব জমি হস্তান্তর সঠিক আছে।"));
      else toast.warning(`${v.length} ${tx("issue(s) found", "টি সমস্যা পাওয়া গেছে")}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {summary
            ? (summary.allOk ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />)
            : null}
          {tx("Land Transfer Integrity", "জমি হস্তান্তর যাচাই")}
          {summary && <span className="text-muted-foreground text-sm font-normal">({summary.total})</span>}
        </CardTitle>
        <CardDescription>
          {tx("Verify borga / sale / inheritance / split transfers and that both farmers' profiles show the correct land.",
            "বর্গা / বিক্রয় / উত্তরাধিকার / স্প্লিট হস্তান্তর এবং উভয় কৃষকের প্রোফাইলে সঠিক জমি দেখায় কিনা যাচাই করুন।")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {tx("Run verification", "যাচাই চালান")}
        </Button>

        {summary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{tx("Transfers", "হস্তান্তর")}: {summary.total}</Badge>
            <Badge variant="outline">{tx("With recipients", "প্রাপকসহ")}: {summary.withRecipients}</Badge>
            <Badge variant={summary.errors ? "destructive" : "default"}>{tx("Errors", "ত্রুটি")}: {summary.errors}</Badge>
            <Badge variant="secondary">{tx("Warnings", "সতর্কতা")}: {summary.warnings}</Badge>
            {Object.entries(summary.byType).map(([k, n]) => (
              <Badge key={k} variant="outline">{k}: {n}</Badge>
            ))}
          </div>
        )}

        {violations && violations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">{tx("Severity", "মাত্রা")}</th>
                  <th className="p-2 text-left">{tx("Transfer", "হস্তান্তর")}</th>
                  <th className="p-2 text-left">{tx("Issue", "সমস্যা")}</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v, i) => (
                  <tr key={i} className={`border-t ${v.severity === "error" ? "bg-destructive/5" : ""}`}>
                    <td className="p-2">
                      {v.severity === "error"
                        ? <Badge variant="destructive">ERROR</Badge>
                        : <Badge variant="secondary">warn</Badge>}
                    </td>
                    <td className="p-2 font-mono text-[10px]">{v.transfer_id.slice(0, 8)}</td>
                    <td className="p-2">{tx(v.message_en, v.message_bn)}{v.detail ? <span className="text-muted-foreground"> · {v.detail.slice(0, 8)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {violations && violations.length === 0 && (
          <div className="text-sm text-primary">{tx("No issues — both profiles consistent.", "কোনো সমস্যা নেই — উভয় প্রোফাইল সঠিক।")}</div>
        )}
      </CardContent>
    </Card>
  );
}
