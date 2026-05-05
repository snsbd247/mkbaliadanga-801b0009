import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Plus, Check, X, FileSpreadsheet, FileText, Upload, AlertCircle, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 1000000;

type Row = {
  id: string;
  farmer_id: string;
  amount: number;
  txn_date: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  reject_reason?: string | null;
  created_at: string;
  farmers?: { name_en: string; farmer_code: string; member_no?: string | null };
};

export default function ShareCollection() {
  const { user, isCommittee, isSuper } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [form, setForm] = useState({
    farmer_id: "",
    amount: "",
    txn_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    note: "",
  });
  const [batchText, setBatchText] = useState("");
  const [batchReport, setBatchReport] = useState<{ ok: number; errors: { line: number; raw: string; reason: string }[] } | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [period, setPeriod] = useState<"all" | "daily" | "monthly">("all");
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", txn_date: "", note: "" });

  useEffect(() => { document.title = "Share Collection"; load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("savings_transactions")
      .select("id,farmer_id,amount,txn_date,status,note,reject_reason,created_at,farmers(name_en,farmer_code,member_no)")
      .eq("type", "share_collection")
      .is("deleted_at", null)
      .order("txn_date", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }

  function validate(amount: number): string | null {
    if (!Number.isFinite(amount) || amount <= 0) return "Amount must be positive";
    if (amount < MIN_AMOUNT) return `Minimum amount is ৳${MIN_AMOUNT}`;
    if (amount > MAX_AMOUNT) return `Maximum amount is ৳${MAX_AMOUNT.toLocaleString()}`;
    return null;
  }

  async function save() {
    const amt = Number(form.amount);
    const err = validate(amt);
    if (err) return toast.error(err);
    if (!form.farmer_id) return toast.error("Select a farmer");

    const { error } = await supabase.from("savings_transactions").insert({
      farmer_id: form.farmer_id,
      type: "share_collection" as any,
      amount: amt,
      txn_date: form.txn_date,
      status: "pending" as any,
      note: form.note || `Share collection (${form.method})`,
      created_by: user?.id,
    });
    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message))
        return toast.error("This farmer already has a share collection on this date");
      return toast.error(error.message);
    }
    toast.success("Submitted for approval");
    setOpen(false);
    setForm({ farmer_id: "", amount: "", txn_date: form.txn_date, method: "cash", note: "" });
    load();
  }

  async function batchSubmit() {
    setBatchReport(null);
    // CSV format: farmer_code,amount,date(optional),note(optional)
    const rawLines = batchText.split(/\r?\n/);
    const lines = rawLines.map((l, i) => ({ raw: l, idx: i + 1 })).filter(l => l.raw.trim());
    if (!lines.length) return toast.error("Paste at least one line");
    const today = new Date().toISOString().slice(0, 10);

    const codes = Array.from(new Set(lines.map(l => l.raw.split(",")[0]?.trim()).filter(Boolean)));
    const { data: fs } = await supabase.from("farmers").select("id,farmer_code").in("farmer_code", codes);
    const map = new Map<string, string>((fs ?? []).map((f: any) => [f.farmer_code, f.id]));

    const payload: any[] = [];
    const errors: { line: number; raw: string; reason: string }[] = [];
    const seen = new Set<string>();
    lines.forEach(({ raw, idx }) => {
      const parts = raw.split(",").map(s => s?.trim() ?? "");
      const [code, amtStr, dateStr, note] = parts;
      if (!code) { errors.push({ line: idx, raw, reason: "Missing farmer_code" }); return; }
      const fid = map.get(code);
      if (!fid) { errors.push({ line: idx, raw, reason: `Unknown farmer_code "${code}"` }); return; }
      const amt = Number(amtStr);
      const v = validate(amt);
      if (v) { errors.push({ line: idx, raw, reason: v }); return; }
      const d = dateStr || today;
      if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        errors.push({ line: idx, raw, reason: `Invalid date "${dateStr}" (use YYYY-MM-DD)` }); return;
      }
      const key = `${fid}|${d}`;
      if (seen.has(key)) { errors.push({ line: idx, raw, reason: "Duplicate farmer+date in batch" }); return; }
      seen.add(key);
      payload.push({
        farmer_id: fid, type: "share_collection", amount: amt, txn_date: d,
        status: "pending", note: note || "Batch share collection", created_by: user?.id,
      });
    });

    if (!payload.length) {
      setBatchReport({ ok: 0, errors });
      return toast.error(`All ${errors.length} rows failed validation`);
    }

    const { error, data } = await supabase.from("savings_transactions").insert(payload).select("id");
    if (error) {
      // Surface DB-side errors (e.g., unique violations) in the report
      errors.push({ line: 0, raw: "(database)", reason: error.message });
      setBatchReport({ ok: 0, errors });
      return toast.error(error.message);
    }
    const ok = data?.length ?? payload.length;
    setBatchReport({ ok, errors });
    toast.success(`Submitted ${ok} entries${errors.length ? `, ${errors.length} skipped` : ""}`);
    if (!errors.length) { setBatchOpen(false); setBatchText(""); }
    load();
  }

  async function decide(id: string, status: "approved" | "rejected") {
    let reject_reason: string | null = null;
    if (status === "rejected") {
      reject_reason = window.prompt("Reason for rejection:")?.trim() || null;
      if (!reject_reason) return toast.error("Reason required");
    }
    const patch: any = { status, approved_by: user?.id, decided_at: new Date().toISOString() };
    if (reject_reason) patch.reject_reason = reject_reason;
    const { error } = await supabase
      .from("savings_transactions")
      .update(patch)
      .eq("id", id)
      .eq("status", "pending");
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  function startEdit(r: Row) {
    setEditRow(r);
    setEditForm({ amount: String(r.amount), txn_date: r.txn_date, note: r.note ?? "" });
  }
  async function saveEdit() {
    if (!editRow) return;
    const amt = Number(editForm.amount);
    const v = validate(amt);
    if (v) return toast.error(v);
    const { error } = await supabase.from("savings_transactions")
      .update({ amount: amt, txn_date: editForm.txn_date, note: editForm.note || null })
      .eq("id", editRow.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditRow(null);
    load();
  }
  async function deleteRow(r: Row) {
    if (!window.confirm(`Delete share collection of ${money(r.amount)} for ${r.farmers?.name_en}?`)) return;
    const { error } = await supabase.from("savings_transactions")
      .update({ deleted_at: new Date().toISOString() } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (range.from && r.txn_date < range.from) return false;
      if (range.to && r.txn_date > range.to) return false;
      return true;
    });
  }, [rows, range]);

  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    filtered.filter(r => r.status === "approved").forEach(r => {
      const key = period === "monthly" ? r.txn_date.slice(0, 7) : r.txn_date;
      m.set(key, (m.get(key) ?? 0) + Number(r.amount));
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, period]);

  function exportReport(kind: "pdf" | "xlsx") {
    if (period === "all") {
      const head = ["Date", "Farmer", "Code", "Amount", "Status", "Note"];
      const body = filtered.map(r => [
        fmtDate(r.txn_date), r.farmers?.name_en ?? "", r.farmers?.farmer_code ?? "",
        Number(r.amount), r.status, r.note ?? "",
      ]);
      if (kind === "pdf") exportTablePDF("Share Collection", head, body, range);
      else exportExcel("Share Collection", "Collections", body.map(b => ({
        Date: b[0], Farmer: b[1], Code: b[2], Amount: b[3], Status: b[4], Note: b[5],
      })), range);
      return;
    }
    const head = [period === "monthly" ? "Month" : "Date", "Total Amount"];
    const body = grouped.map(([k, v]) => [k, v]);
    if (kind === "pdf") exportTablePDF(`Share Collection (${period})`, head, body, range);
    else exportExcel(`Share Collection ${period}`, "Summary",
      grouped.map(([k, v]) => ({ Period: k, Total: v })), range);
  }

  const pending = filtered.filter(r => r.status === "pending");
  const approved = filtered.filter(r => r.status === "approved");
  const rejected = filtered.filter(r => r.status === "rejected");
  const totalApproved = approved.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader title="Share Collection" description="Collect and track share capital contributions from farmers." actions={
        <div className="flex gap-2">
          <Dialog open={batchOpen} onOpenChange={(v) => { setBatchOpen(v); if (!v) setBatchReport(null); }}>
            <DialogTrigger asChild><Button variant="outline"><Upload className="h-4 w-4 mr-1" />Batch CSV</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Batch Share Collection</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>One entry per line: <code className="text-xs">farmer_code,amount,date(YYYY-MM-DD,optional),note(optional)</code></Label>
                <Textarea rows={8} value={batchText} onChange={e => setBatchText(e.target.value)}
                  placeholder={"MK-0001,500,2026-05-05,May share\nMK-0002,500\nMK-0003,1000"} />
                <p className="text-xs text-muted-foreground">All entries submitted as pending; admin must approve.</p>

                {batchReport && (
                  <div className="rounded-md border bg-muted/40 p-3 space-y-2 max-h-64 overflow-auto">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" />{batchReport.ok} accepted</span>
                      <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-4 w-4" />{batchReport.errors.length} failed</span>
                    </div>
                    {batchReport.errors.length > 0 && (
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-12">Line</TableHead><TableHead>Row</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {batchReport.errors.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{e.line || "-"}</TableCell>
                              <TableCell className="font-mono text-xs break-all">{e.raw}</TableCell>
                              <TableCell className="text-xs text-destructive">{e.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchOpen(false)}>Close</Button>
                <Button onClick={batchSubmit}>Submit Batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Collection</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Share Collection Entry</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Farmer</Label>
                  <FarmerSearchSelect value={form.farmer_id || null} onChange={(id) => setForm({ ...form, farmer_id: id ?? "" })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount (৳)</Label>
                    <Input type="number" min={MIN_AMOUNT} max={MAX_AMOUNT} value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div><Label>Date</Label>
                    <Input type="date" value={form.txn_date} onChange={e => setForm({ ...form, txn_date: e.target.value })} />
                  </div>
                </div>
                <div><Label>Payment Method</Label>
                  <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="mobile">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Note (optional)</Label>
                  <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">Min ৳{MIN_AMOUNT}. One entry per farmer per day. Pending approval required.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />

      <Card className="p-3 mb-3 grid gap-3 md:grid-cols-5">
        <div><Label className="text-xs">From</Label>
          <Input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} />
        </div>
        <div><Label className="text-xs">To</Label>
          <Input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} />
        </div>
        <div><Label className="text-xs">Group</Label>
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Detailed (All rows)</SelectItem>
              <SelectItem value="daily">Daily Summary</SelectItem>
              <SelectItem value="monthly">Monthly Summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <Button variant="outline" size="sm" onClick={() => exportReport("pdf")}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportReport("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <span className="ml-auto text-sm text-muted-foreground">Approved Total: <strong className="text-foreground">{money(totalApproved)}</strong></span>
        </div>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="summary">Summary ({grouped.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><RowsTable rows={pending} canDecide={isCommittee} onDecide={decide} canManage={isSuper} onEdit={startEdit} onDelete={deleteRow} /></TabsContent>
        <TabsContent value="approved"><RowsTable rows={approved} canManage={isSuper} onEdit={startEdit} onDelete={deleteRow} /></TabsContent>
        <TabsContent value="rejected"><RowsTable rows={rejected} canManage={isSuper} onEdit={startEdit} onDelete={deleteRow} /></TabsContent>
        <TabsContent value="summary" className="space-y-3">
          <Card className="p-3">
            <div className="text-sm font-medium mb-2">{period === "monthly" ? "Monthly" : "Daily"} approved totals</div>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={[...grouped].reverse().map(([k, v]) => ({ period: k, total: v }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>{period === "monthly" ? "Month" : "Date"}</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {grouped.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                {grouped.map(([k, v]) => (
                  <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{money(v)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
      {loading && <p className="text-xs text-muted-foreground mt-2">Loading…</p>}
    </>
  );
}

function RowsTable({ rows, canDecide, onDecide }: {
  rows: Row[]; canDecide?: boolean; onDecide?: (id: string, s: "approved" | "rejected") => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Farmer</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead><TableHead>Note</TableHead>
          {canDecide && <TableHead></TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={canDecide ? 6 : 5} className="text-center text-muted-foreground">No entries</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{fmtDate(r.txn_date)}</TableCell>
              <TableCell>{r.farmers?.farmer_code} — {r.farmers?.name_en}</TableCell>
              <TableCell className="text-right">{money(r.amount)}</TableCell>
              <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.reject_reason || r.note}</TableCell>
              {canDecide && (
                <TableCell className="flex gap-1 justify-end">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="default" onClick={() => onDecide?.(r.id, "approved")}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => onDecide?.(r.id, "rejected")}><X className="h-3 w-3" /></Button>
                    </>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
