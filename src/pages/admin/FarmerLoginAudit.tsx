// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

interface Row {
  id: string;
  identifier: string;
  farmer_id: string | null;
  office_id: string | null;
  success: boolean;
  error_reason: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function FarmerLoginAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    let qb = db
      .from("farmer_login_attempts")
      .select("id, identifier, farmer_id, office_id, success, error_reason, ip, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filter === "success") qb = qb.eq("success", true);
    if (filter === "failed") qb = qb.eq("success", false);
    const { data } = await qb;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      (r.identifier || "").toLowerCase().includes(needle) ||
      (r.ip || "").toLowerCase().includes(needle) ||
      (r.error_reason || "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const total = rows.length;
    const ok = rows.filter((r) => r.success).length;
    return { total, ok, failed: total - ok };
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader title="Farmer Login Audit" description="Successful and failed farmer portal login attempts." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Successful</div><div className="text-2xl font-semibold text-green-600">{stats.ok}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Failed</div><div className="text-2xl font-semibold text-destructive">{stats.failed}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <CardTitle className="text-base">Attempts (last 500)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {(["all","success","failed"] as const).map((k) => (
                <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{k}</Button>
              ))}
            </div>
            <Input placeholder="Search ID / IP / reason" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
            <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Office</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No attempts</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{r.identifier}</TableCell>
                  <TableCell>
                    {r.success
                      ? <Badge className="bg-green-600 hover:bg-green-600">success</Badge>
                      : <Badge variant="destructive">failed</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{r.error_reason ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ip ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.office_id ? r.office_id.slice(0, 8) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
