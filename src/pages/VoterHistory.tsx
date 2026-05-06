import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { exportExcel, exportTablePDF } from "@/lib/exports";
import { useAuth } from "@/auth/AuthProvider";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  id: string;
  created_at: string;
  farmer_id: string;
  event: "cancel" | "reactivate";
  reason: string | null;
  changed_by: string | null;
  office_id: string | null;
};

export default function VoterHistory() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [farmersMap, setFarmersMap] = useState<Record<string, any>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [officesMap, setOfficesMap] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string>("all");
  const [event, setEvent] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    document.title = "Voter Cancel/Reactivate History";
    supabase.from("offices").select("id,name").order("name").then(r => {
      setOffices((r.data as any[]) ?? []);
      setOfficesMap(Object.fromEntries(((r.data as any[]) ?? []).map(o => [o.id, o])));
    });
  }, []);

  async function load() {
    setLoading(true);
    let q = supabase.from("farmers")
      .select("id,name_en,name_bn,member_no,farmer_code,office_id,voter_cancelled_at,voter_cancelled_by,voter_cancel_reason,voter_reactivated_at,voter_reactivated_by,voter_reactivate_reason")
      .or("voter_cancelled_at.not.is.null,voter_reactivated_at.not.is.null")
      .order("voter_cancelled_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (farmerId) q = q.eq("id", farmerId);
    if (officeId !== "all") q = q.eq("office_id", officeId);
    const { data } = await q;
    const farmers = (data as any[]) ?? [];

    // Flatten to events
    const events: Row[] = [];
    for (const f of farmers) {
      if (f.voter_cancelled_at) events.push({
        id: `${f.id}-c`, created_at: f.voter_cancelled_at, farmer_id: f.id,
        event: "cancel", reason: f.voter_cancel_reason, changed_by: f.voter_cancelled_by, office_id: f.office_id,
      });
      if (f.voter_reactivated_at) events.push({
        id: `${f.id}-r`, created_at: f.voter_reactivated_at, farmer_id: f.id,
        event: "reactivate", reason: f.voter_reactivate_reason, changed_by: f.voter_reactivated_by, office_id: f.office_id,
      });
    }
    let filtered = events;
    if (event !== "all") filtered = filtered.filter(e => e.event === event);
    if (from) filtered = filtered.filter(e => e.created_at >= from);
    if (to) filtered = filtered.filter(e => e.created_at <= to + "T23:59:59");
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));

    setRows(filtered);
    setFarmersMap(Object.fromEntries(farmers.map(f => [f.id, f])));

    const uids = Array.from(new Set(filtered.map(r => r.changed_by).filter(Boolean))) as string[];
    if (uids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", uids);
      setProfilesMap(Object.fromEntries(((ps as any[]) ?? []).map(p => [p.id, p])));
    } else setProfilesMap({});
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId, officeId, event, from, to]);

  const exportRows = useMemo(() => rows.map(r => {
    const f = farmersMap[r.farmer_id] ?? {};
    const p = r.changed_by ? profilesMap[r.changed_by] ?? {} : {};
    return {
      Date: new Date(r.created_at).toLocaleString(),
      Event: r.event,
      Farmer: f.name_en ?? "",
      MemberNo: f.member_no ?? f.farmer_code ?? "",
      Reason: r.reason ?? "",
      ChangedBy: p.full_name || p.email || (r.changed_by ? r.changed_by.slice(0, 8) : "system"),
      Office: officesMap[r.office_id ?? ""]?.name ?? "",
    };
  }), [rows, farmersMap, profilesMap, officesMap]);

  return (
    <>
      <PageHeader title={t("p5c_pageTitle" as any)} description={t("p5c_pageDesc" as any)} />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>{t("p5_farmerLabel")}</Label><FarmerSearchSelect value={farmerId} onChange={(id) => setFarmerId(id)} /></div>
          <div>
            <Label>{t("pgEvent")}</Label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("p5c_allEvents")}</SelectItem>
                <SelectItem value="cancel">{t("p5c_cancelOnly")}</SelectItem>
                <SelectItem value="reactivate">{t("p5c_reactivateOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isSuper && (
            <div>
              <Label>{t("office")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("p5c_allOffices")}</SelectItem>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>{t("pgFromDate")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("pgToDate")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("refresh" as any)}
          </Button>
          <Button variant="outline" size="sm" disabled={!rows.length}
            onClick={() => exportExcel("voter-history", "Voter History", exportRows, { from, to })}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />{t("pgExcel")}
          </Button>
          <Button variant="outline" size="sm" disabled={!rows.length}
            onClick={() => exportTablePDF("Voter Cancel/Reactivate History",
              ["Date", "Event", "Farmer", "Farmer ID", "Reason", "Changed By", "Office"],
              exportRows.map(r => [r.Date, r.Event, r.Farmer, r.MemberNo, r.Reason, r.ChangedBy, r.Office]),
              { from, to })}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <span className="ml-auto text-xs text-muted-foreground self-center">{rows.length} event(s)</span>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>{t("p5_farmerLabel")}</TableHead>
              <TableHead>{t("p5c_farmerId")}</TableHead>
              <TableHead>{t("rejectionReason")}</TableHead>
              <TableHead>{t("p5c_changedBy")}</TableHead>
              <TableHead>{t("office")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">{t("p5c_noEvents")}</TableCell></TableRow>
            )}
            {rows.map(r => {
              const f = farmersMap[r.farmer_id] ?? {};
              const p = r.changed_by ? profilesMap[r.changed_by] ?? {} : {};
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={r.event === "cancel" ? "destructive" : "default"}>{r.event}</Badge></TableCell>
                  <TableCell className="text-sm">{f.name_en ?? "—"}{f.name_bn ? ` (${f.name_bn})` : ""}</TableCell>
                  <TableCell className="font-mono text-xs">{f.member_no ?? f.farmer_code ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.full_name || p.email || (r.changed_by ? r.changed_by.slice(0, 8) : "system")}</TableCell>
                  <TableCell className="text-xs">{officesMap[r.office_id ?? ""]?.name ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
