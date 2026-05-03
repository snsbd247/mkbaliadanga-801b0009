import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { exportExcel, exportTablePDF } from "@/lib/exports";
import { useAuth } from "@/auth/AuthProvider";

const PAGE_SIZE = 50;

export default function VoterAudit() {
  const { isSuper } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [farmersMap, setFarmersMap] = useState<Record<string, any>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [officesMap, setOfficesMap] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    document.title = "Voter Audit Logs";
    supabase.from("offices").select("id,name").order("name").then(r => {
      setOffices((r.data as any[]) ?? []);
      setOfficesMap(Object.fromEntries(((r.data as any[]) ?? []).map(o => [o.id, o])));
    });
  }, []);

  async function load() {
    setLoading(true);
    let q = supabase.from("voter_audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (farmerId) q = q.eq("farmer_id", farmerId);
    if (officeId && officeId !== "all") q = q.eq("office_id", officeId);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to + "T23:59:59");
    const { data } = await q;
    const list = (data as any[]) ?? [];
    setRows(list);
    setPage(0);

    const fids = Array.from(new Set(list.map(r => r.farmer_id).filter(Boolean)));
    const uids = Array.from(new Set(list.map(r => r.changed_by).filter(Boolean)));
    if (fids.length) {
      const { data: fs } = await supabase.from("farmers").select("id,name_en,name_bn,account_number,farmer_code").in("id", fids);
      setFarmersMap(Object.fromEntries(((fs as any[]) ?? []).map(f => [f.id, f])));
    } else setFarmersMap({});
    if (uids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", uids);
      setProfilesMap(Object.fromEntries(((ps as any[]) ?? []).map(p => [p.id, p])));
    } else setProfilesMap({});
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId, officeId, from, to]);

  const pageRows = useMemo(() => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [rows, page]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  function buildExportRows() {
    return rows.map(r => {
      const f = farmersMap[r.farmer_id] ?? {};
      const p = profilesMap[r.changed_by] ?? {};
      const o = officesMap[r.office_id] ?? {};
      return {
        Date: new Date(r.created_at).toLocaleString(),
        Farmer: f.name_en ?? "",
        Account: r.account_number ?? f.account_number ?? "",
        OldVoter: r.voter_number_old ?? "",
        NewVoter: r.voter_number_new ?? "",
        IsVoter: `${r.is_voter_old ?? "—"} → ${r.is_voter_new ?? "—"}`,
        ChangedBy: p.full_name || p.email || (r.changed_by ? r.changed_by.slice(0, 8) : "system"),
        Office: o.name ?? "",
      };
    });
  }

  function onExportExcel() {
    exportExcel("voter-audit-logs", "Voter Audit", buildExportRows(), { from, to });
  }
  function onExportPDF() {
    const data = buildExportRows();
    exportTablePDF("Voter Audit Logs",
      ["Date", "Farmer", "Account", "Old Voter", "New Voter", "Changed By", "Office"],
      data.map(r => [r.Date, r.Farmer, r.Account, r.OldVoter, r.NewVoter, r.ChangedBy, r.Office]),
      { from, to });
  }

  return (
    <>
      <PageHeader title="Voter Audit Logs" description="History of every voter number assignment / change." />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Farmer</Label>
            <FarmerSearchSelect value={farmerId} onChange={(id) => setFarmerId(id)} />
          </div>
          {isSuperAdmin && (
            <div>
              <Label>Office</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onExportExcel} disabled={!rows.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPDF} disabled={!rows.length}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <span className="ml-auto text-xs text-muted-foreground self-center">{rows.length} record(s)</span>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Farmer</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Old → New Voter</TableHead>
              <TableHead>Is Voter</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Office</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No records</TableCell></TableRow>
            )}
            {pageRows.map(r => {
              const f = farmersMap[r.farmer_id] ?? {};
              const p = profilesMap[r.changed_by] ?? {};
              const o = officesMap[r.office_id] ?? {};
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{f.name_en ?? "—"}{f.name_bn ? ` (${f.name_bn})` : ""}</TableCell>
                  <TableCell className="font-mono text-xs">{r.account_number ?? f.account_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.voter_number_old || "—"} → {r.voter_number_new || "—"}</TableCell>
                  <TableCell className="text-xs">{String(r.is_voter_old ?? "—")} → {String(r.is_voter_new ?? "—")}</TableCell>
                  <TableCell className="text-xs">{p.full_name || p.email || (r.changed_by ? r.changed_by.slice(0, 8) : "system")}</TableCell>
                  <TableCell className="text-xs">{o.name ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-2 border-t text-xs">
            <span>Page {page + 1} / {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
