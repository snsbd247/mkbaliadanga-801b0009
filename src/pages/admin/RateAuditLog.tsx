import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

type Row = {
  id: string;
  office_id: string | null;
  irrigation_season_id: string | null;
  land_type_id: string | null;
  old_rate: number | null;
  new_rate: number | null;
  changed_by: string | null;
  changed_at: string;
  action: string;
  change_reason: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  insert: "নতুন",
  update: "পরিবর্তন",
  delete: "মুছে ফেলা",
};
const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

export default function RateAuditLog() {
  const { isSuper } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [landTypes, setLandTypes] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [seasonId, setSeasonId] = useState("all");
  const [landTypeId, setLandTypeId] = useState("all");
  const [officeId, setOfficeId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    document.title = "রেট পরিবর্তন ইতিহাস";
    Promise.all([
      supabase.from("irrigation_season_types" as any).select("id,name,name_bn,code").is("deleted_at", null),
      supabase.from("land_types" as any).select("id,name,name_bn,code").is("deleted_at", null),
      supabase.from("offices").select("id,name"),
    ]).then(([s, l, o]) => {
      setSeasons((s.data as any) ?? []);
      setLandTypes((l.data as any) ?? []);
      setOffices((o.data as any) ?? []);
    });
  }, []);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("irrigation_rate_audit_logs" as any)
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(1000);
    if (seasonId !== "all") q = q.eq("irrigation_season_id", seasonId);
    if (landTypeId !== "all") q = q.eq("land_type_id", landTypeId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    if (from) q = q.gte("changed_at", from);
    if (to) q = q.lte("changed_at", to + "T23:59:59");
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); }, [seasonId, landTypeId, officeId, from, to]);

  const seasonName = (id: string | null) => seasons.find((s) => s.id === id)?.name_bn || seasons.find((s) => s.id === id)?.name || "—";
  const landTypeName = (id: string | null) => landTypes.find((s) => s.id === id)?.name_bn || landTypes.find((s) => s.id === id)?.name || "—";
  const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name || (id ? id.slice(0, 6) : "সব অফিস");

  function exportCsv() {
    const header = ["Changed At", "Action", "Office", "Season", "Land Type", "Old Rate", "New Rate", "Changed By"];
    const lines = rows.map((r) => [
      r.changed_at,
      r.action,
      officeName(r.office_id),
      seasonName(r.irrigation_season_id),
      landTypeName(r.land_type_id),
      r.old_rate ?? "",
      r.new_rate ?? "",
      r.changed_by ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rate-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <>
      <PageHeader
        title="রেট পরিবর্তন ইতিহাস"
        description="সিজন রেট কনফিগারেশনে কখন, কে, কোন রেট পরিবর্তন করেছে — সম্পূর্ণ ইতিহাস।"
      />
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label>সিজন</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_bn || s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>জমির ধরন</Label>
              <Select value={landTypeId} onValueChange={setLandTypeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  {landTypes.map((l) => <SelectItem key={l.id} value={l.id}>{l.name_bn || l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isSuper && (
              <div>
                <Label>অফিস</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব</SelectItem>
                    {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>থেকে</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>পর্যন্ত</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rows.length} টি এন্ট্রি {loading && "(লোড হচ্ছে…)"}</p>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-1" /> CSV এক্সপোর্ট
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>সময়</TableHead>
                  <TableHead>অ্যাকশন</TableHead>
                  <TableHead>অফিস</TableHead>
                  <TableHead>সিজন</TableHead>
                  <TableHead>জমির ধরন</TableHead>
                  <TableHead className="text-right">পুরোনো রেট</TableHead>
                  <TableHead className="text-right">নতুন রেট</TableHead>
                  <TableHead className="text-right">পার্থক্য</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const diff = (r.new_rate ?? 0) - (r.old_rate ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{fmtDate(r.changed_at)}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[r.action] ?? "outline"}>{ACTION_LABEL[r.action] ?? r.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{officeName(r.office_id)}</TableCell>
                      <TableCell className="text-xs">{seasonName(r.irrigation_season_id)}</TableCell>
                      <TableCell className="text-xs">{landTypeName(r.land_type_id)}</TableCell>
                      <TableCell className="text-right">{r.old_rate != null ? money(r.old_rate) : "—"}</TableCell>
                      <TableCell className="text-right">{r.new_rate != null ? money(r.new_rate) : "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : ""}`}>
                        {r.old_rate != null && r.new_rate != null ? (diff > 0 ? `+${money(diff)}` : money(diff)) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">কোন এন্ট্রি নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
