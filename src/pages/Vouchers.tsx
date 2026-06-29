import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Paperclip, Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF } from "@/lib/exports";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";


const sb = db as any;
const TYPES = [
  { v: "payment", label: "Payment (PV)" },
  { v: "receipt", label: "Receipt (RV)" },
  { v: "journal", label: "Journal (JV)" },
  { v: "contra", label: "Contra (CV)" },
] as const;

export default function Vouchers() {
  const { user } = useAuth();
  const { tx } = useLang();

  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    voucher_type: "payment", voucher_date: new Date().toISOString().slice(0, 10),
    amount: 0, payee: "", narration: "",
  });

  useEffect(() => { document.title = "Vouchers — MK Baliadanga"; load(); }, [filter]);

  async function load() {
    let q = sb.from("vouchers").select("*").order("voucher_date", { ascending: false }).limit(300);
    if (filter !== "all") q = q.eq("voucher_type", filter);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  }

  async function save() {
    if (f.amount <= 0) return toast.error("Amount required");
    setSaving(true);
    try {
      // 1) get office for current user
      const { data: prof } = await sb.from("profiles").select("office_id").eq("id", user?.id).maybeSingle();
      const office_id = prof?.office_id ?? null;

      // 2) generate voucher_no via RPC
      const { data: vno, error: rpcErr } = await sb.rpc("next_voucher_no", { _office: office_id, _type: f.voucher_type });
      if (rpcErr) throw rpcErr;

      // 3) upload file (optional)
      let attachment_path: string | null = null;
      let attachment_mime: string | null = null;
      if (file) {
        const path = `${office_id ?? "global"}/${vno}-${file.name}`;
        const { error: upErr } = await sb.storage.from("vouchers").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        attachment_path = path; attachment_mime = file.type;
      }

      const { error } = await sb.from("vouchers").insert({
        ...f, voucher_no: vno, office_id, attachment_path, attachment_mime, created_by: user?.id,
      });
      if (error) throw error;
      toast.success(`Saved as ${vno}`);
      setOpen(false); setFile(null);
      setF({ voucher_type: "payment", voucher_date: new Date().toISOString().slice(0, 10), amount: 0, payee: "", narration: "" });
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setSaving(false); }
  }

  async function download(path: string) {
    const { data, error } = await sb.storage.from("vouchers").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  function exportPdf() {
    // #8 — stream/type-specific heading on each voucher register.
    const typeLabel = filter === "all" ? tx("All Vouchers", "সকল ভাউচার") : (TYPES.find(t => t.v === filter)?.label ?? filter);
    const total = rows.reduce((s, v) => s + Number(v.amount || 0), 0);
    exportTablePDF(
      `${tx("Voucher Register", "ভাউচার রেজিস্টার")} — ${typeLabel}`,
      [tx("Voucher No", "ভাউচার নং"), tx("Type", "ধরন"), tx("Date", "তারিখ"), tx("Payee", "প্রাপক/প্রদানকারী"), tx("Narration", "বিবরণ"), tx("Amount", "টাকা")],
      [
        ...rows.map(v => [v.voucher_no, v.voucher_type, fmtDate(v.voucher_date), v.payee ?? "", v.narration ?? "", money(Number(v.amount || 0))]),
        ["", "", "", "", tx("Total", "মোট"), money(total)],
      ],
      undefined,
      { signatures: [tx("Prepared by", "প্রস্তুতকারী"), tx("Manager", "ম্যানেজার"), tx("President", "সভাপতি"), tx("Auditor", "নিরীক্ষক")] },
    );
  }

  return (
    <>
      <PageHeader
        title={tx("Vouchers", "ভাউচার")}
        description={tx("Payment / Receipt / Journal / Contra vouchers + scan upload", "পেমেন্ট / রিসিট / জার্নাল / কন্ট্রা ভাউচার + স্ক্যান আপলোড")}

        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Voucher</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Voucher</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={f.voucher_type} onValueChange={v => setF({ ...f, voucher_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={f.voucher_date} onChange={e => setF({ ...f, voucher_date: e.target.value })} /></div>
                <div><Label>Amount</Label><Input type="number" value={f.amount || ""} onChange={e => setF({ ...f, amount: +e.target.value })} /></div>
                <div><Label>Payee / Payer</Label><Input value={f.payee} onChange={e => setF({ ...f, payee: e.target.value })} /></div>
                <div className="col-span-2"><Label>Narration</Label><Input value={f.narration} onChange={e => setF({ ...f, narration: e.target.value })} /></div>
                <div className="col-span-2"><Label>Scan / Attachment (PDF, image)</Label>
                  <Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-3 mb-3 flex gap-3 items-end">
        <div><Label>Filter</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportPdf} disabled={!rows.length}>
          <FileDown className="h-4 w-4 mr-1" />{tx("Export PDF", "পিডিএফ")}
        </Button>
      </Card>

      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Voucher No</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Payee</TableHead>
          <TableHead>Narration</TableHead><TableHead>Attachment</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vouchers yet</TableCell></TableRow>}
          {rows.map(v => (
            <TableRow key={v.id}>
              <TableCell className="font-mono text-xs">{v.voucher_no}</TableCell>
              <TableCell><Badge variant="outline">{v.voucher_type}</Badge></TableCell>
              <TableCell>{fmtDate(v.voucher_date)}</TableCell>
              <TableCell className="text-right font-semibold">{money(v.amount)}</TableCell>
              <TableCell>{v.payee}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{v.narration}</TableCell>
              <TableCell>
                {v.attachment_path ? (
                  <Button size="sm" variant="ghost" onClick={() => download(v.attachment_path)}>
                    <Paperclip className="h-3 w-3 mr-1" /><Download className="h-3 w-3" />
                  </Button>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>
    </>
  );
}
