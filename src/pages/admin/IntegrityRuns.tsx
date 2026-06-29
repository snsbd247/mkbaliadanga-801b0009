// Admin log view for Land Transfer Integrity verification runs.
// Lists every manual/auto run with status, failure counts and re-export links.
// Restricted to Admin / Super Admin via the route guard AND an in-page check,
// so deep links cannot trigger export generation for unauthorized roles.
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { exportIntegrityExcel, exportIntegrityPdf } from "@/lib/landTransferIntegrityExport";
import type { IntegrityViolation, IntegritySummary } from "@/lib/landTransferIntegrity";

const sb = db as any;

type RunRow = {
  id: string;
  run_type: string;
  status: string;
  office_id: string | null;
  date_from: string | null;
  date_to: string | null;
  total_transfers: number;
  error_count: number;
  warning_count: number;
  summary: IntegritySummary | null;
  violations: IntegrityViolation[] | null;
  error_message: string | null;
  created_at: string;
};

const ALL = "__all__";

export default function IntegrityRuns() {
  const { tx } = useLang();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [offices, setOffices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [fOffice, setFOffice] = useState<string>(ALL);
  const [fType, setFType] = useState<string>(ALL);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: offs }] = await Promise.all([
        sb.from("land_transfer_integrity_runs").select("*").order("created_at", { ascending: false }).limit(500),
        sb.from("offices").select("id,name"),
      ]);
      if (error) throw error;
      setRows(data ?? []);
      const map: Record<string, string> = {};
      (offs ?? []).forEach((o: any) => { map[o.id] = o.name; });
      setOffices(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (fOffice !== ALL && (r.office_id ?? "") !== fOffice) return false;
    if (fType !== ALL && r.run_type !== fType) return false;
    if (fStatus !== ALL && r.status !== fStatus) return false;
    if (fFrom && r.created_at.slice(0, 10) < fFrom) return false;
    if (fTo && r.created_at.slice(0, 10) > fTo) return false;
    return true;
  }), [rows, fOffice, fType, fStatus, fFrom, fTo]);

  const resetFilters = () => { setFOffice(ALL); setFType(ALL); setFStatus(ALL); setFFrom(""); setFTo(""); };
  const hasFilters = fOffice !== ALL || fType !== ALL || fStatus !== ALL || !!fFrom || !!fTo;

  // Re-check role at call time so a deep link cannot trigger generation.
  const guardedExport = (fn: () => void) => () => {
    if (!isAdmin) { toast.error(tx("Not authorized to export", "এক্সপোর্ট করার অনুমতি নেই")); return; }
    fn();
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {tx("Integrity Run Log", "ইন্টিগ্রিটি রান লগ")}
          </CardTitle>
          <CardDescription>
            {tx("Every manual and automatic Land Transfer Integrity verification, with failure counts and re-exportable reports.",
              "প্রতিটি ম্যানুয়াল ও স্বয়ংক্রিয় জমি হস্তান্তর যাচাই — ব্যর্থতার সংখ্যা ও পুনরায় এক্সপোর্টযোগ্য রিপোর্টসহ।")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5 mb-3">
            <div>
              <Label className="text-xs">{tx("Office", "অফিস")}</Label>
              <Select value={fOffice} onValueChange={setFOffice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tx("All", "সব")}</SelectItem>
                  {Object.entries(offices).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tx("Run type", "ধরন")}</Label>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tx("All", "সব")}</SelectItem>
                  <SelectItem value="manual">{tx("Manual", "ম্যানুয়াল")}</SelectItem>
                  <SelectItem value="auto">{tx("Auto", "স্বয়ংক্রিয়")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tx("Status", "অবস্থা")}</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tx("All", "সব")}</SelectItem>
                  <SelectItem value="completed">{tx("Completed", "সম্পন্ন")}</SelectItem>
                  <SelectItem value="failed">{tx("Failed", "ব্যর্থ")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tx("From", "থেকে")}</Label>
              <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{tx("To", "পর্যন্ত")}</Label>
              <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {tx("Refresh", "রিফ্রেশ")}
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />{tx("Clear filters", "ফিল্টার মুছুন")}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {tx("Showing", "দেখানো হচ্ছে")} {filtered.length} / {rows.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">{tx("When", "সময়")}</th>
                  <th className="p-2 text-left">{tx("Type", "ধরন")}</th>
                  <th className="p-2 text-left">{tx("Status", "অবস্থা")}</th>
                  <th className="p-2 text-left">{tx("Office", "অফিস")}</th>
                  <th className="p-2 text-left">{tx("Date range", "তারিখ পরিসর")}</th>
                  <th className="p-2 text-right">{tx("Transfers", "হস্তান্তর")}</th>
                  <th className="p-2 text-right">{tx("Errors", "ত্রুটি")}</th>
                  <th className="p-2 text-right">{tx("Warnings", "সতর্কতা")}</th>
                  <th className="p-2 text-left">{tx("Report", "রিপোর্ট")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-t ${r.status === "failed" ? "bg-destructive/5" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2">
                      <Badge variant={r.run_type === "auto" ? "secondary" : "outline"}>{r.run_type}</Badge>
                    </td>
                    <td className="p-2">
                      {r.status === "completed"
                        ? <Badge variant="default">{tx("Completed", "সম্পন্ন")}</Badge>
                        : <Badge variant="destructive">{tx("Failed", "ব্যর্থ")}</Badge>}
                    </td>
                    <td className="p-2">{r.office_id ? (offices[r.office_id] ?? "—") : tx("All", "সব")}</td>
                    <td className="p-2 whitespace-nowrap">{r.date_from || "—"} → {r.date_to || "—"}</td>
                    <td className="p-2 text-right">{r.total_transfers}</td>
                    <td className="p-2 text-right">
                      {r.error_count > 0 ? <span className="text-destructive font-semibold">{r.error_count}</span> : 0}
                    </td>
                    <td className="p-2 text-right">{r.warning_count}</td>
                    <td className="p-2">
                      {r.violations && r.violations.length ? (
                        isAdmin ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              title="Excel"
                              onClick={guardedExport(() => exportIntegrityExcel(r.violations ?? [], r.summary))}>
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              title="PDF"
                              onClick={guardedExport(() => exportIntegrityPdf(r.violations ?? [], r.summary))}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{tx("Restricted", "সীমাবদ্ধ")}</span>
                        )
                      ) : r.error_message ? (
                        <span className="text-destructive">{r.error_message.slice(0, 60)}</span>
                      ) : (
                        <span className="text-muted-foreground">{tx("No issues", "সমস্যা নেই")}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">{tx("No runs match the filters", "ফিল্টারের সাথে মেলে এমন কোনো রান নেই")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
