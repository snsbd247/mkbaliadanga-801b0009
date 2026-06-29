// Live land-transfer integrity report for the Demo Manager.
// Fetches transfers, recipients and the referenced lands, then runs the pure
// checker in src/lib/landTransferIntegrity.ts and renders the result.
// Supports office + date-range filtering, async (background-style) status,
// run-logging to land_transfer_integrity_runs, and Admin/Super-Admin gating.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, RefreshCw, Loader2, FileSpreadsheet, FileText, ExternalLink, History } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import {
  checkLandTransferIntegrity, summarizeIntegrity,
  type IntegrityViolation, type IntegritySummary,
} from "@/lib/landTransferIntegrity";
import { exportIntegrityExcel, exportIntegrityPdf } from "@/lib/landTransferIntegrityExport";

const sb = db as any;

type RunStatus = "idle" | "running" | "completed" | "failed";

/** Record an admin notification + audit log when integrity errors are found. */
async function reportViolations(errors: IntegrityViolation[]) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    await sb.from("system_audit_logs").insert({
      user_id: uid,
      module: "land_transfers",
      action_type: "integrity_violation",
      new_data: { count: errors.length, violations: errors.slice(0, 50) },
    });
    if (uid) {
      await sb.from("notifications").insert({
        user_id: uid,
        kind: "warning",
        title: `জমি হস্তান্তর যাচাই: ${errors.length} টি ত্রুটি`,
        body: errors.slice(0, 5).map((e) => `${e.code} (${e.transfer_id.slice(0, 8)})`).join(", "),
        link: errors[0]?.farmer_id ? `/farmers/${errors[0].farmer_id}` : "/admin/demo-manager",
      });
    }
  } catch {
    /* best-effort — never block the report */
  }
}

export default function LandTransferVerifyCard({ autoRunKey }: { autoRunKey?: number | string }) {
  const { tx } = useLang();
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [violations, setViolations] = useState<IntegrityViolation[] | null>(null);
  const [summary, setSummary] = useState<IntegritySummary | null>(null);

  // Filters applied before fetching / exporting.
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    sb.from("offices").select("id,name").order("name").then(({ data }: any) => {
      setOffices(data ?? []);
    });
  }, []);

  const loading = status === "running";

  /** Persist a run result so the admin log can show history + re-exports. */
  async function logRun(
    runType: "manual" | "auto",
    runStatus: "completed" | "failed",
    v: IntegrityViolation[] | null,
    s: IntegritySummary | null,
    errorMessage?: string,
  ) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      await sb.from("land_transfer_integrity_runs").insert({
        run_type: runType,
        status: runStatus,
        office_id: officeId === "all" ? null : officeId,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        total_transfers: s?.total ?? 0,
        error_count: s?.errors ?? 0,
        warning_count: s?.warnings ?? 0,
        summary: s ?? null,
        violations: (v ?? []).slice(0, 500),
        error_message: errorMessage ?? null,
        created_by: auth?.user?.id ?? null,
      });
    } catch {
      /* best-effort */
    }
  }

  const run = async (runType: "manual" | "auto" = "manual") => {
    setStatus("running");
    setProgress(10);
    try {
      let tq = sb.from("land_transfers").select(
        "id,source_land_id,source_farmer_id,transfer_type,source_dag_no,source_mouza,source_land_size,source_owner_name,source_owner_code,transferred_at,office_id");
      if (officeId !== "all") tq = tq.eq("office_id", officeId);
      if (dateFrom) tq = tq.gte("transferred_at", dateFrom);
      if (dateTo) tq = tq.lte("transferred_at", `${dateTo}T23:59:59`);

      const { data: transfers, error: e1 } = await tq;
      if (e1) throw e1;
      setProgress(40);

      const transferIds = (transfers ?? []).map((t: any) => t.id);
      let recipients: any[] = [];
      for (let i = 0; i < transferIds.length; i += 200) {
        const { data, error: e2 } = await sb.from("land_transfer_recipients")
          .select("id,transfer_id,recipient_farmer_id,new_land_id,area_decimal")
          .in("transfer_id", transferIds.slice(i, i + 200));
        if (e2) throw e2;
        recipients = recipients.concat(data ?? []);
      }
      setProgress(65);

      // Collect referenced land ids (source + new) to validate existence/archival.
      const landIds = new Set<string>();
      (transfers ?? []).forEach((t: any) => t.source_land_id && landIds.add(t.source_land_id));
      recipients.forEach((r: any) => r.new_land_id && landIds.add(r.new_land_id));

      let lands: any[] = [];
      const ids = Array.from(landIds);
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from("lands")
          .select("id,farmer_id,dag_no,land_size,deleted_at,owner_type")
          .in("id", ids.slice(i, i + 200));
        lands = lands.concat(data ?? []);
      }
      setProgress(85);

      // Unified borga model: load active land_relations for source lands and
      // any orphaned owner_type='borgadar' land rows.
      let relations: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from("land_relations")
          .select("id,land_id,owner_farmer_id,sharecropper_farmer_id,area_decimal,valid_to,deleted_at")
          .in("land_id", ids.slice(i, i + 200));
        relations = relations.concat(data ?? []);
      }
      const { data: borgadarLands } = await sb.from("lands")
        .select("id,farmer_id,dag_no,land_size,deleted_at,owner_type")
        .eq("owner_type", "borgadar")
        .is("deleted_at", null);

      const input = {
        transfers: transfers ?? [],
        recipients,
        lands,
        relations,
        borgadarLands: borgadarLands ?? [],
      };
      const v = checkLandTransferIntegrity(input);

      const s = summarizeIntegrity(input, v);
      setViolations(v);
      setSummary(s);
      setProgress(100);
      setStatus("completed");

      if (!v.length) {
        toast.success(tx("All land transfers are consistent.", "সব জমি হস্তান্তর সঠিক আছে।"));
      } else {
        toast.warning(`${v.length} ${tx("issue(s) found", "টি সমস্যা পাওয়া গেছে")}`);
        const errs = v.filter((x) => x.severity === "error");
        if (errs.length) await reportViolations(errs);
      }
      await logRun(runType, "completed", v, s);
    } catch (err: any) {
      setStatus("failed");
      setProgress(0);
      toast.error(err?.message ?? "Failed");
      await logRun(runType, "failed", null, null, err?.message ?? "Failed");
    }
  };

  // Auto-run when the parent signals a finished demo import (changed autoRunKey).
  useEffect(() => {
    if (autoRunKey !== undefined && autoRunKey !== "" && autoRunKey !== 0) run("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

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
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{tx("Office", "অফিস")}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tx("From", "শুরু")}</Label>
            <Input type="date" className="h-8" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tx("To", "শেষ")}</Label>
            <Input type="date" className="h-8" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={() => run("manual")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {tx("Run verification", "যাচাই চালান")}
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" disabled={!violations}
                onClick={() => { if (!isAdmin) { toast.error(tx("Not authorized to export", "এক্সপোর্ট করার অনুমতি নেই")); return; } exportIntegrityExcel(violations ?? [], summary); }}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button size="sm" variant="outline" disabled={!violations}
                onClick={() => { if (!isAdmin) { toast.error(tx("Not authorized to export", "এক্সপোর্ট করার অনুমতি নেই")); return; } exportIntegrityPdf(violations ?? [], summary); }}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin/integrity-runs"><History className="h-4 w-4 mr-1" /> {tx("Run log", "রান লগ")}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Background-style status / progress */}
        {status !== "idle" && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{tx("Status", "অবস্থা")}:</span>
              {status === "running" && <Badge variant="secondary">{tx("Running…", "চলছে…")}</Badge>}
              {status === "completed" && <Badge variant="default">{tx("Completed", "সম্পন্ন")}</Badge>}
              {status === "failed" && <Badge variant="destructive">{tx("Failed", "ব্যর্থ")}</Badge>}
            </div>
            {(status === "running" || status === "completed") && <Progress value={progress} className="h-1.5" />}
          </div>
        )}

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
                  <th className="p-2 text-left">{tx("Link", "লিঙ্ক")}</th>
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
                    <td className="p-2">
                      {isAdmin && (v.recipient_farmer_id || v.farmer_id) ? (
                        <Link
                          to={`/farmers/${v.recipient_farmer_id || v.farmer_id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          target="_blank" rel="noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {tx("Open farmer", "কৃষক খুলুন")}
                        </Link>
                      ) : null}
                    </td>
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
