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
import { Label } from "@/components/ui/label";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { Eye, Download, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ENTITY_OPTIONS = [
  "qr_tokens",
  "payments",
  "farmers",
  "loans",
  "loan_payments",
  "savings_transactions",
  "irrigation_charges",
  "expenses",
  "journal_entries",
];

const PAGE_LIMIT = 1000;

export default function AuditLogs() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [offices, setOffices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [farmerQuery, setFarmerQuery] = useState("");
  const [farmerId, setFarmerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(monthAgo.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState<string>(today.toISOString().slice(0, 10));

  useEffect(() => {
    document.title = `${t("auditLogs")} — ${t("appName")}`;
    (async () => {
      const [prof, ofcs] = await Promise.all([
        supabase.from("profiles").select("id,full_name,username"),
        supabase.from("offices").select("id,name"),
      ]);
      setProfiles(Object.fromEntries((prof.data ?? []).map((p: any) => [p.id, p])));
      setOffices(Object.fromEntries((ofcs.data ?? []).map((o: any) => [o.id, o])));
      await runQuery();
    })();
    // eslint-disable-next-line
  }, []);

  async function resolveFarmer(): Promise<string | null> {
    const q = farmerQuery.trim();
    if (!q) return null;
    const { data } = await supabase
      .from("farmers")
      .select("id, farmer_code, name_en, name_bn")
      .or(`farmer_code.ilike.%${q}%,name_en.ilike.%${q}%,name_bn.ilike.%${q}%`)
      .limit(1)
      .maybeSingle();
    if (!data) {
      toast.error(`No farmer matched "${q}"`);
      return null;
    }
    setFarmerId(data.id);
    return data.id;
  }

  async function runQuery() {
    setLoading(true);
    try {
      let fid = farmerId;
      if (farmerQuery && !fid) {
        fid = (await resolveFarmer()) ?? "";
      } else if (!farmerQuery) {
        fid = "";
        setFarmerId("");
      }

      let q = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", `${dateFrom}T00:00:00.000Z`)
        .lte("created_at", `${dateTo}T23:59:59.999Z`)
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (entityFilter !== "all") q = q.eq("entity", entityFilter);
      if (officeFilter !== "all") q = q.eq("office_id", officeFilter);
      if (fid) q = q.eq("entity_id", fid);

      const { data, error } = await q;
      if (error) toast.error(error.message);
      setList(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((l) => {
      const u = profiles[l.user_id];
      const hay = `${l.entity ?? ""} ${l.action ?? ""} ${u?.full_name ?? ""} ${u?.username ?? ""} ${l.entity_id ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [list, search, profiles]);

  async function exportCsv() {
    const rows = filtered;
    if (rows.length === 0) { toast.error("Nothing to export"); return; }

    // Prefetch farmer names for any entity_id that maps to a farmer-related entity.
    const farmerEntities = new Set(["farmers", "qr_tokens"]);
    const farmerIds = Array.from(new Set(
      rows.filter((r) => farmerEntities.has(r.entity)).map((r) => r.entity_id).filter(Boolean),
    ));
    const farmerMap: Record<string, { code?: string; name_en?: string; name_bn?: string }> = {};
    if (farmerIds.length > 0) {
      const { data: fs } = await supabase
        .from("farmers")
        .select("id, farmer_code, name_en, name_bn")
        .in("id", farmerIds);
      for (const f of fs ?? []) {
        farmerMap[(f as any).id] = { code: (f as any).farmer_code, name_en: (f as any).name_en, name_bn: (f as any).name_bn };
      }
    }

    // Bilingual headers (EN / BN). Bangla strings are placed in row 2 so Excel splits cleanly.
    const headersEn = ["Date/Time", "Action", "Entity", "Office", "Farmer Code", "Farmer Name", "User", "Entity ID", "Old Values", "New Values"];
    const headersBn = ["তারিখ/সময়", "কার্যক্রম", "বিষয়", "অফিস", "কৃষক কোড", "কৃষকের নাম", "ব্যবহারকারী", "রেকর্ড আইডি", "পুরাতন তথ্য", "নতুন তথ্য"];

    const escape = (v: any) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };

    const lines: string[] = [
      headersEn.map(escape).join(","),
      headersBn.map(escape).join(","),
    ];

    for (const l of rows) {
      const u = profiles[l.user_id];
      const o = offices[l.office_id];
      const f = farmerMap[l.entity_id];
      const farmerName = f ? (f.name_bn ? `${f.name_en ?? ""} / ${f.name_bn}` : (f.name_en ?? "")) : "";
      const cells = [
        new Date(l.created_at).toISOString(),
        l.action ?? "",
        l.entity ?? "",
        o?.name ?? "",
        f?.code ?? "",
        farmerName,
        u?.full_name ?? u?.username ?? (l.user_id ? l.user_id.slice(0, 8) : "system"),
        l.entity_id ?? "",
        JSON.stringify(l.old_values ?? null),
        JSON.stringify(l.new_values ?? null),
      ];
      lines.push(cells.map(escape).join(","));
    }

    const csv = lines.join("\n");
    // UTF-8 BOM ensures Excel renders Bangla & headers correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} entries`);
  }

  return (
    <>
      <PageHeader
        title={t("auditLogs")}
        description="Search QR token events, scans, and payments by office, farmer, and date range"
        actions={
          <div className="flex gap-2">
            <Button onClick={runQuery} variant="outline" size="sm" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh
            </Button>
            <Button onClick={exportCsv} size="sm" disabled={loading || filtered.length === 0}>
              <Download className="h-4 w-4" />Export CSV
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Office</Label>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {Object.values(offices).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Farmer (code or name)</Label>
            <Input
              value={farmerQuery}
              onChange={(e) => { setFarmerQuery(e.target.value); setFarmerId(""); }}
              placeholder="2026-00000123 or Rahim"
            />
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="scan">Scan</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="revoke">Revoke</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {ENTITY_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Quick search (in current results)</Label>
            <Input placeholder="Filter loaded rows…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {list.length} loaded entries
          {list.length === PAGE_LIMIT && ` (capped at ${PAGE_LIMIT}; narrow filters for more)`}
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
              <TableHead>Ledger</TableHead>
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
                    <Badge variant={l.action === "delete" || l.action === "revoke" ? "destructive" : l.action === "update" ? "secondary" : "default"}>
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{l.entity}</TableCell>
                  <TableCell className="text-xs">{u?.full_name ?? u?.username ?? <span className="font-mono text-muted-foreground">{l.user_id?.slice(0, 8) ?? "system"}</span>}</TableCell>
                  <TableCell className="text-xs">{o?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><DiffDialog log={l} /></TableCell>
                  <TableCell><LedgerLinkButton log={l} /></TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{loading ? "Loading…" : t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

const ENTITY_TO_REF: Record<string, string> = {
  savings_transactions: "savings",
  loans: "loan",
  loan_payments: "loan_payment",
  irrigation_charges: "irrigation",
  expenses: "expense",
  journal_entries: "journal",
};

function LedgerLinkButton({ log }: { log: any }) {
  const refType = ENTITY_TO_REF[log.entity];
  const refId = log.entity_id;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  if (!refType || !refId) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Dialog open={open} onOpenChange={async (o) => {
      setOpen(o);
      if (o && rows.length === 0) {
        const { data } = await supabase
          .from("ledger_entries")
          .select("entry_date,debit,credit,description,account_id,accounts(code,name)")
          .eq("reference_type", refType).eq("reference_id", refId)
          .order("entry_date");
        setRows(data ?? []);
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View ledger</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Ledger entries — {refType}</DialogTitle></DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead><tr className="border-b">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Account</th>
              <th className="text-left p-2">Description</th>
              <th className="text-right p-2">Debit</th>
              <th className="text-right p-2">Credit</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{fmtDate(r.entry_date)}</td>
                  <td className="p-2">{r.accounts?.code} {r.accounts?.name}</td>
                  <td className="p-2">{r.description ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.debit) ? Number(r.debit).toLocaleString() : ""}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.credit) ? Number(r.credit).toLocaleString() : ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="text-center p-4 text-muted-foreground">No ledger entries linked.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
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
