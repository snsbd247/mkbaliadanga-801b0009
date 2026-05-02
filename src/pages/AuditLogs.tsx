import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { Eye } from "lucide-react";

export default function AuditLogs() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  useEffect(() => {
    document.title = `${t("auditLogs")} — ${t("appName")}`;
    (async () => {
      const [logs, prof, ofcs] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id,full_name,username"),
        supabase.from("offices").select("id,name"),
      ]);
      setList(logs.data ?? []);
      setProfiles(Object.fromEntries((prof.data ?? []).map((p: any) => [p.id, p])));
      setOffices(Object.fromEntries((ofcs.data ?? []).map((o: any) => [o.id, o])));
    })();
  }, []);

  const entities = useMemo(() => Array.from(new Set(list.map(l => l.entity).filter(Boolean))), [list]);

  const filtered = list.filter(l => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (entityFilter !== "all" && l.entity !== entityFilter) return false;
    if (search) {
      const hay = `${l.entity} ${l.action} ${profiles[l.user_id]?.full_name ?? ""} ${profiles[l.user_id]?.username ?? ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader title={t("auditLogs")} description="Every critical action recorded with before/after values" />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="insert">Insert</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">{filtered.length} entries</div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Diff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => {
              const u = profiles[l.user_id];
              const o = offices[l.office_id];
              return (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(l.created_at)} <span className="text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span></TableCell>
                  <TableCell>
                    <Badge variant={l.action === "delete" ? "destructive" : l.action === "update" ? "secondary" : "default"}>
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{l.entity}</TableCell>
                  <TableCell className="text-xs">{u?.full_name ?? u?.username ?? <span className="font-mono text-muted-foreground">{l.user_id?.slice(0, 8) ?? "system"}</span>}</TableCell>
                  <TableCell className="text-xs">{o?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <DiffDialog log={l} />
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function DiffDialog({ log }: { log: any }) {
  const [open, setOpen] = useState(false);
  const fields = new Set<string>([...(log.old_values ? Object.keys(log.old_values) : []), ...(log.new_values ? Object.keys(log.new_values) : [])]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{log.action} — {log.entity}</DialogTitle></DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="text-left p-2">Field</th><th className="text-left p-2">Old</th><th className="text-left p-2">New</th></tr></thead>
            <tbody>
              {Array.from(fields).sort().map(k => {
                const o = log.old_values?.[k];
                const n = log.new_values?.[k];
                const changed = JSON.stringify(o) !== JSON.stringify(n);
                if (!changed && log.action === "update") return null;
                return (
                  <tr key={k} className={`border-b ${changed ? "bg-warning/5" : ""}`}>
                    <td className="p-2 font-mono">{k}</td>
                    <td className="p-2 text-destructive">{o == null ? "—" : typeof o === "object" ? JSON.stringify(o) : String(o)}</td>
                    <td className="p-2 text-success">{n == null ? "—" : typeof n === "object" ? JSON.stringify(n) : String(n)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
