import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { logAudit } from "@/lib/audit";
import { FileDown, FileSpreadsheet, Loader2, AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";

type Kind = "SAV" | "LOAN" | "IRR" | "COMBO" | "PAY" | "ALL";

type Row = {
  id: string;
  receipt_no: string;
  serial: number | null;
  prefix: string;
  created_at: string;
  amount: number;
  status: string | null;
  farmer: string;
  collected_by: string | null;
  office_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

const KINDS: Kind[] = ["ALL", "SAV", "LOAN", "IRR", "COMBO", "PAY"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default function MonthlyReceiptRegister() {
  const now = new Date();
  const { roles } = useAuth();
  const canVoid = !!roles?.some((r) => r === "super_admin" || r === "admin" || r === "developer");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [kind, setKind] = useState<Kind>("ALL");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [voidTarget, setVoidTarget] = useState<Row | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const from = `${year}-${pad2(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;

      let q = db
        .from("payments")
        .select("id,receipt_no,created_at,amount,status,kind,collected_by,office_id,voided_at,void_reason,farmers(name_en,farmer_code,member_no)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .is("deleted_at", null)
        .order("receipt_no", { ascending: true })
        .limit(5000);

      if (kind !== "ALL") q = q.like("receipt_no", `${kind}-%`);

      const { data, error } = await q;
      if (error) throw error;

      const parsed: Row[] = (data ?? []).map((p: any) => {
        const rn: string = p.receipt_no ?? "";
        const m = rn.match(/^([A-Z]+)-\d{4}-\d{2}-(\d+)$/);
        return {
          id: p.id,
          receipt_no: rn || "—",
          prefix: m?.[1] ?? (p.kind ?? "—").toUpperCase(),
          serial: m ? Number(m[2]) : null,
          created_at: p.created_at,
          amount: Number(p.amount) || 0,
          status: p.status,
          collected_by: p.collected_by ?? null,
          office_id: p.office_id ?? null,
          voided_at: p.voided_at ?? null,
          void_reason: p.void_reason ?? null,
          farmer: `${p.farmers?.name_en ?? "—"}${p.farmers?.member_no || p.farmers?.farmer_code ? ` (${p.farmers.member_no || p.farmers.farmer_code})` : ""}`,
        };
      });
      setRows(parsed);
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    if (!voidReason.trim()) { toast.error("কারণ লিখুন"); return; }
    setVoiding(true);
    try {
      const { error } = await db.rpc("void_receipt_and_recycle", {
        p_receipt_no: voidTarget.receipt_no,
        p_office_id: voidTarget.office_id,
        p_reason: voidReason.trim(),
      });
      if (error) throw error;
      logAudit({
        office_id: voidTarget.office_id, module: "receipt", action_type: "void",
        reference_id: voidTarget.id,
        new_data: { receipt_no: voidTarget.receipt_no, reason: voidReason.trim() },
      });
      toast.success(`রশিদ ${voidTarget.receipt_no} বাতিল হয়েছে — নম্বরটি পুনঃব্যবহার হবে`);
      setVoidTarget(null);
      setVoidReason("");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Void failed");
    } finally {
      setVoiding(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year, month, kind]);

  // Per-prefix grouping → detect duplicates and serial gaps
  const analysis = useMemo(() => {
    const byPrefix = new Map<string, Row[]>();
    for (const r of rows) {
      if (!byPrefix.has(r.prefix)) byPrefix.set(r.prefix, []);
      byPrefix.get(r.prefix)!.push(r);
    }
    const duplicates = new Set<string>();
    const gaps: { prefix: string; missing: number[] }[] = [];
    const summary: { prefix: string; count: number; total: number; first: number | null; last: number | null }[] = [];

    for (const [prefix, list] of byPrefix.entries()) {
      const seen = new Map<string, number>();
      for (const r of list) {
        if (r.receipt_no && r.receipt_no !== "—") {
          seen.set(r.receipt_no, (seen.get(r.receipt_no) ?? 0) + 1);
        }
      }
      for (const [rn, c] of seen) if (c > 1) duplicates.add(rn);

      const serials = list.map(r => r.serial).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
      if (serials.length) {
        const first = serials[0], last = serials[serials.length - 1];
        const have = new Set(serials);
        const missing: number[] = [];
        for (let i = first; i <= last; i++) if (!have.has(i)) missing.push(i);
        if (missing.length) gaps.push({ prefix, missing });
        summary.push({ prefix, count: list.length, total: list.reduce((s, r) => s + r.amount, 0), first, last });
      } else {
        summary.push({ prefix, count: list.length, total: list.reduce((s, r) => s + r.amount, 0), first: null, last: null });
      }
    }
    return { duplicates, gaps, summary };
  }, [rows]);

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const title = `Monthly Receipt Register — ${year}-${pad2(month)}${kind !== "ALL" ? ` (${kind})` : ""}`;

  async function onPdf() {
    setPdfBusy(true);
    try {
      const head = ["Date", "Receipt #", "Kind", "Farmer", "Status", "Amount"];
      const body: any[][] = rows.map(r => [
        fmtDate(r.created_at),
        r.receipt_no + (analysis.duplicates.has(r.receipt_no) ? "  [DUP]" : ""),
        r.prefix,
        r.farmer,
        r.status ?? "—",
        money(r.amount),
      ]);
      body.push(["", "", "", "", "Total", money(grandTotal)]);
      if (analysis.gaps.length) {
        body.push(["", "", "", "", "", ""]);
        body.push(["", "Gaps:", "", analysis.gaps.map(g => `${g.prefix}: ${g.missing.join(", ")}`).join("  |  "), "", ""]);
      }
      await exportTablePDF(title, head, body, { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-31` });
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally { setPdfBusy(false); }
  }

  function onExcel() {
    try {
      const data = rows.map(r => ({
        Date: r.created_at.slice(0, 10),
        "Receipt #": r.receipt_no,
        Kind: r.prefix,
        Farmer: r.farmer,
        Status: r.status ?? "",
        Amount: r.amount,
        Duplicate: analysis.duplicates.has(r.receipt_no) ? "YES" : "",
      }));
      data.push({ Date: "", "Receipt #": "", Kind: "", Farmer: "", Status: "Total", Amount: grandTotal, Duplicate: "" } as any);
      exportExcel(`receipt-register-${year}-${pad2(month)}`, title.slice(0, 28), data, { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-31` });
    } catch (e: any) {
      toast.error(e.message ?? "Excel export failed");
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <>
      <PageHeader
        title="Monthly Receipt Register"
        description="Type-wise monthly receipt list with duplicate & gap detection."
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{pad2(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kind</Label>
            <Select value={kind} onValueChange={v => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-2 flex gap-2 justify-end">
            <Button onClick={onPdf} disabled={pdfBusy || !rows.length} variant="secondary">
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button onClick={onExcel} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary per prefix */}
      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold mb-2">Summary</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {analysis.summary.length === 0 && <div className="text-sm text-muted-foreground">No receipts in this period.</div>}
          {analysis.summary.map(s => (
            <div key={s.prefix} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{s.prefix}</Badge>
                <div className="text-xs text-muted-foreground">{s.count} receipts</div>
              </div>
              <div className="text-lg font-semibold mt-1">{money(s.total)}</div>
              {s.first !== null && (
                <div className="text-xs text-muted-foreground mt-1 font-mono">
                  #{String(s.first).padStart(4, "0")} – #{String(s.last).padStart(4, "0")}
                </div>
              )}
            </div>
          ))}
        </div>

        {(analysis.duplicates.size > 0 || analysis.gaps.length > 0) && (
          <div className="mt-3 space-y-2">
            {analysis.duplicates.size > 0 && (
              <div className="flex items-start gap-2 text-sm rounded border border-destructive/40 bg-destructive/5 p-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
                <div>
                  <div className="font-medium">Duplicate receipts ({analysis.duplicates.size})</div>
                  <div className="font-mono text-xs">{Array.from(analysis.duplicates).join(", ")}</div>
                </div>
              </div>
            )}
            {analysis.gaps.length > 0 && (
              <div className="flex items-start gap-2 text-sm rounded border border-amber-500/40 bg-amber-500/5 p-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                <div>
                  <div className="font-medium">Serial gaps</div>
                  {analysis.gaps.map(g => (
                    <div key={g.prefix} className="font-mono text-xs">
                      {g.prefix}: missing {g.missing.map(n => `#${String(n).padStart(4, "0")}`).join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Farmer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canVoid && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={canVoid ? 7 : 6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={canVoid ? 7 : 6} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {rows.map(r => {
                  const isDup = analysis.duplicates.has(r.receipt_no);
                  const isVoid = !!r.voided_at;
                  return (
                    <TableRow key={r.id} className={isVoid ? "bg-destructive/10 opacity-70" : isDup ? "bg-destructive/5" : ""}>
                      <TableCell>{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className={isVoid ? "line-through" : ""}>{r.receipt_no}</span>
                        {isDup && <Badge variant="destructive" className="ml-2">DUP</Badge>}
                        {isVoid && <Badge variant="destructive" className="ml-2">বাতিল</Badge>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.prefix}</Badge></TableCell>
                      <TableCell>{r.farmer}</TableCell>
                      <TableCell>{isVoid ? <span className="text-destructive" title={r.void_reason ?? ""}>বাতিল</span> : (r.status ?? "—")}</TableCell>
                      <TableCell className="text-right">{money(r.amount)}</TableCell>
                      {canVoid && (
                        <TableCell className="text-right">
                          {!isVoid && r.receipt_no !== "—" && (
                            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => { setVoidTarget(r); setVoidReason(""); }}>
                              <Ban className="h-3.5 w-3.5 mr-1" />বাতিল
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={canVoid ? 6 : 5}>Total ({rows.length} receipts)</TableCell>
                  <TableCell className="text-right">{money(grandTotal)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>রশিদ বাতিল করুন — {voidTarget?.receipt_no}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              বাতিল করলে রশিদটি কালেকশন রিপোর্টে "বাতিল" দেখাবে এবং নম্বরটি পরের এন্ট্রিতে পুনঃব্যবহার হবে।
            </p>
            <Label>বাতিলের কারণ *</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="যেমন: কৃষক টাকা আনেনি / ভুল এন্ট্রি" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>বাতিল</Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={voiding}>
              {voiding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
