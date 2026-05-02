import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { type LocationLevel } from "@/lib/locationValidation";

const ALL = "__all__";
const LEVELS: LocationLevel[] = [
  "division", "district", "upazila", "union", "ward", "village", "mouza",
];

type Rejection = {
  id: string;
  created_at: string;
  user_id: string | null;
  office_id: string | null;
  farmer_id: string | null;
  operation: string;       // INSERT | UPDATE
  failed_level: string;    // LocationLevel
  reason: string;          // missing_parent | mismatch
  attempted: Record<string, any>;
  error_message: string;
};

export default function FarmerRejectionsReport() {
  const { t } = useLang();
  const { isAdmin, rolesLoaded } = useAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [level, setLevel] = useState<string>(ALL);
  const [op, setOp] = useState<string>(ALL);
  const [rows, setRows] = useState<Rejection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `Rejected Farmer Submissions — ${t("appName")}`;
  }, [t]);

  useEffect(() => {
    if (!rolesLoaded) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, level, op, rolesLoaded]);

  async function load() {
    setLoading(true);
    try {
      let q: any = supabase
        .from("farmer_rejections" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      if (level !== ALL) q = q.eq("failed_level", level);
      if (op !== ALL) q = q.eq("operation", op);
      const { data, error } = await q;
      if (error) {
        // RLS will hide the table from non-admins; fail silently.
        setRows([]);
      } else {
        setRows((data as Rejection[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const byLevel = new Map<string, number>();
    for (const r of rows) byLevel.set(r.failed_level, (byLevel.get(r.failed_level) ?? 0) + 1);
    return { total: rows.length, byLevel: Array.from(byLevel.entries()).sort((a, b) => b[1] - a[1]) };
  }, [rows]);

  const levelLabel = (lv: string) => {
    const map: Record<string, string> = {
      division: t("division"), district: t("district"), upazila: t("upazila"),
      union: t("union"), ward: t("ward"), village: t("village"), mouza: t("mouza"),
    };
    return map[lv] || lv;
  };

  const reasonLabel = (r: string) =>
    r === "missing_parent" ? "Missing parent" : r === "mismatch" ? "Hierarchy mismatch" : r;

  const tableHead = [
    "Timestamp", "Operation", "Failed Level", "Reason",
    "Attempted Name", "User ID", "Office ID", "Farmer ID",
  ];
  const tableRows = (r: Rejection) => [
    fmtDate(r.created_at) + " " + new Date(r.created_at).toLocaleTimeString(),
    r.operation,
    levelLabel(r.failed_level),
    reasonLabel(r.reason),
    r.attempted?.name_en ?? "—",
    r.user_id ? r.user_id.slice(0, 8) : "—",
    r.office_id ? r.office_id.slice(0, 8) : "—",
    r.farmer_id ? r.farmer_id.slice(0, 8) : "—",
  ];

  if (rolesLoaded && !isAdmin) {
    return (
      <Card className="p-6 m-4">
        <p className="text-muted-foreground">You don't have permission to view this report.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Rejected Farmer Submissions"
        description="Audit trail of farmer save attempts blocked by location hierarchy validation."
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Failed Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {LEVELS.map((lv) => (
                  <SelectItem key={lv} value={lv}>{levelLabel(lv)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operation</Label>
            <Select value={op} onValueChange={setOp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                <SelectItem value="INSERT">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setLevel(ALL); setOp(ALL); }}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total rejections:</span>{" "}
            <span className="font-semibold">{summary.total}</span>
          </div>
          {summary.byLevel.map(([lv, n]) => (
            <Badge key={lv} variant="secondary">
              {levelLabel(lv)}: <span className="ml-1 font-mono">{n}</span>
            </Badge>
          ))}
          {loading && <span className="text-muted-foreground">Loading…</span>}
        </div>
      </Card>

      <div className="flex justify-end gap-2 mb-2">
        <Button
          variant="outline" size="sm"
          onClick={() => exportExcel(
            "farmer-rejections",
            "Rejections",
            rows.map((r) => ({
              Timestamp: r.created_at,
              Operation: r.operation,
              "Failed Level": levelLabel(r.failed_level),
              Reason: reasonLabel(r.reason),
              "Attempted Name": r.attempted?.name_en ?? "",
              "User ID": r.user_id ?? "",
              "Office ID": r.office_id ?? "",
              "Farmer ID": r.farmer_id ?? "",
              "Attempted Division": r.attempted?.division_id ?? "",
              "Attempted District": r.attempted?.district_id ?? "",
              "Attempted Upazila": r.attempted?.upazila_id ?? "",
              "Attempted Union": r.attempted?.union_id ?? "",
              "Attempted Ward": r.attempted?.ward_id ?? "",
              "Attempted Village": r.attempted?.village_id ?? "",
              "Attempted Mouza": r.attempted?.mouza_id ?? "",
              Error: r.error_message,
            })),
            { from, to },
          )}
        >Export Excel</Button>
        <Button
          variant="outline" size="sm"
          onClick={() => exportTablePDF(
            "Rejected Farmer Submissions",
            tableHead,
            rows.map(tableRows),
            { from, to },
          )}
        >Export PDF</Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Failed Level</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Attempted Name</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Farmer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {fmtDate(r.created_at)} {new Date(r.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <Badge variant={r.operation === "INSERT" ? "default" : "secondary"}>
                    {r.operation}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">{levelLabel(r.failed_level)}</Badge>
                </TableCell>
                <TableCell className="text-xs">{reasonLabel(r.reason)}</TableCell>
                <TableCell>{r.attempted?.name_en ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.user_id ? r.user_id.slice(0, 8) : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.office_id ? r.office_id.slice(0, 8) : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_id ? r.farmer_id.slice(0, 8) : "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No rejected submissions for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
