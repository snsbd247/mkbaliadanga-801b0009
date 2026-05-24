// Admin page to view and process public payment intents (P-E3).
// i18n-ignore-file — admin/utility page
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate, money } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ExternalLink, Download } from "lucide-react";

const sb = supabase as any;

const TYPES = ["all", "irrigation", "loan", "savings", "other"];

export default function PublicPaymentIntents() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  const [dateFrom, setDateFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));

  async function load() {
    let q = sb.from("public_payment_intents").select("*")
      .gte("created_at", `${dateFrom}T00:00:00.000Z`)
      .lte("created_at", `${dateTo}T23:59:59.999Z`)
      .order("created_at", { ascending: false }).limit(1000);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (typeFilter !== "all") q = q.eq("allocation_hint", typeFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [statusFilter, typeFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      (r.farmer_code ?? "").toLowerCase().includes(s) ||
      (r.phone ?? "").toLowerCase().includes(s) ||
      (r.note ?? "").toLowerCase().includes(s),
    );
  }, [rows, search]);

  async function mark(id: string, status: string) {
    const { error } = await sb.from("public_payment_intents").update({
      status, processed_by: user?.id, processed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status);
    load();
  }

  function exportCsv() {
    if (!filtered.length) return toast.error("Nothing to export");
    const escape = (v: any) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ["Date", "Farmer Code", "Phone", "Amount", "Type", "Note", "Status", "Processed At"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        new Date(r.created_at).toISOString(),
        r.farmer_code, r.phone ?? "", r.amount,
        r.allocation_hint ?? "", r.note ?? "", r.status,
        r.processed_at ? new Date(r.processed_at).toISOString() : "",
      ].map(escape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payment-intents-${dateFrom}-to-${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  }

  return (
    <>
      <PageHeader
        title="পাবলিক পেমেন্ট অনুরোধ"
        description="অনলাইন পোর্টালের মাধ্যমে জমা দেওয়া পেমেন্ট অনুরোধ"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/farmer/dashboard" target="_blank" className="text-xs text-primary inline-flex items-center gap-1">কৃষক পোর্টাল <ExternalLink className="h-3 w-3" /></Link>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
        }
      />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Payment type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Search (code / phone / note)</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="…" />
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Showing {filtered.length} of {rows.length}</div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Farmer Code</TableHead><TableHead>Phone</TableHead>
            <TableHead>Amount</TableHead><TableHead>For</TableHead><TableHead>Note</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code}</TableCell>
                <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{money(r.amount)}</TableCell>
                <TableCell className="text-xs">{r.allocation_hint}</TableCell>
                <TableCell className="text-xs max-w-xs truncate">{r.note ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "processed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => mark(r.id, "processed")}>Mark processed</Button>
                      <Button size="sm" variant="ghost" onClick={() => mark(r.id, "rejected")}>Reject</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
