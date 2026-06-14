import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF } from "@/lib/exports";
import { nextMonthlyReceiptNo } from "@/lib/monthlyReceiptNo";
import { Plus, Trash2, Printer, FileDown } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

const INCOME_TYPES = [
  { value: "vangari", en: "Scrap (Vangari)", bn: "ভাঙারি" },
  { value: "haowlat", en: "Loan (Haowlat)", bn: "হাওলাত" },
  { value: "onudan", en: "Grant (Onudan)", bn: "অনুদান" },
  { value: "other", en: "Other", bn: "বিবিধ" },
];
const STREAMS = [
  { value: "sech", en: "Irrigation", bn: "সেচ" },
  { value: "saving", en: "Saving", bn: "সেভিং" },
];

export function OfficeIncomeTab({ offices, userId }: { offices: any[]; userId?: string }) {
  const { tx } = useLang();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    office_id: offices[0]?.id ?? "",
    income_type: "vangari",
    payer_name: "",
    amount: "",
    received_on: new Date().toISOString().slice(0, 10),
    stream: "sech",
    receipt_no: "",
    note: "",
  });

  const typeLabel = (v: string) => { const t = INCOME_TYPES.find((x) => x.value === v); return t ? tx(t.en, t.bn) : v; };
  const streamLabel = (v: string) => { const s = STREAMS.find((x) => x.value === v); return s ? tx(s.en, s.bn) : v; };

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("office_incomes")
      .select("*")
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const save = async () => {
    if (!form.payer_name.trim()) { toast.error(tx("Payer name required", "প্রদানকারীর নাম দিন")); return; }
    if (!(Number(form.amount) > 0)) { toast.error(tx("Amount must be greater than 0", "টাকা ০-এর বেশি দিন")); return; }
    setSaving(true);
    try {
      let receiptNo = form.receipt_no.trim();
      if (!receiptNo) receiptNo = await nextMonthlyReceiptNo("IRR", form.office_id || null, crypto.randomUUID());
      const { error } = await (supabase as any).from("office_incomes").insert({
        office_id: form.office_id || null,
        receipt_no: receiptNo,
        income_type: form.income_type,
        payer_name: form.payer_name.trim(),
        amount: Number(form.amount),
        received_on: form.received_on,
        stream: form.stream,
        note: form.note?.trim() || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success(tx("Income recorded", "আয় সংরক্ষিত হয়েছে"));
      setOpen(false);
      setForm({ ...form, payer_name: "", amount: "", receipt_no: "", note: "" });
      load();
    } catch (e: any) {
      toast.error(e.message ?? tx("Failed to save", "সংরক্ষণ ব্যর্থ"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: any) => {
    const ok = await confirm({
      title: tx("Delete income?", "আয় মুছবেন?"),
      description: `${r.receipt_no} — ${r.payer_name}`,
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("office_incomes").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tx("Deleted", "মুছে ফেলা হয়েছে"));
    load();
  };

  const printReceipt = (r: any) => {
    const officeName = offices.find((o) => o.id === r.office_id)?.name ?? "";
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${r.receipt_no}</title>
      <style>@page{size:A5 landscape;margin:10mm}
      body{font-family:'Noto Sans Bengali',Arial,sans-serif;padding:24px;color:#111}
      h2{text-align:center;margin:0 0 4px}.sub{text-align:center;color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #ddd}
      .lbl{color:#555;width:40%}.amt{text-align:right;font-size:20px;font-weight:bold;padding-top:14px}
      .sign{margin-top:48px;text-align:right}</style></head><body>
      <h2>${officeName || tx("Office Income Receipt", "অফিস আয় রশিদ")}</h2>
      <div class="sub">${tx("Office Income Receipt", "অফিস আয় রশিদ")}</div>
      <table>
        <tr><td class="lbl">${tx("Receipt No", "রশিদ নং")}</td><td>${r.receipt_no}</td></tr>
        <tr><td class="lbl">${tx("Date", "তারিখ")}</td><td>${fmtDate(r.received_on)}</td></tr>
        <tr><td class="lbl">${tx("Payer", "প্রদানকারী")}</td><td>${r.payer_name}</td></tr>
        <tr><td class="lbl">${tx("Type", "ধরন")}</td><td>${typeLabel(r.income_type)}</td></tr>
        <tr><td class="lbl">${tx("Stream", "স্ট্রিম")}</td><td>${streamLabel(r.stream)}</td></tr>
        ${r.note ? `<tr><td class="lbl">${tx("Note", "নোট")}</td><td>${r.note}</td></tr>` : ""}
        <tr><td class="lbl">${tx("Amount", "টাকা")}</td><td class="amt">${money(Number(r.amount))}</td></tr>
      </table>
      <div class="sign">${tx("Authorised signature", "অনুমোদিত স্বাক্ষর")}<br/>____________________</div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportList = () => {
    exportTablePDF(
      tx("Office Income Statement", "অফিস আয় বিবরণী"),
      [tx("Receipt No", "রশিদ নং"), tx("Date", "তারিখ"), tx("Payer", "প্রদানকারী"), tx("Type", "ধরন"), tx("Stream", "স্ট্রিম"), tx("Amount", "টাকা")],
      [
        ...rows.map((r) => [r.receipt_no, fmtDate(r.received_on), r.payer_name, typeLabel(r.income_type), streamLabel(r.stream), money(Number(r.amount))]),
        ["", "", "", "", tx("Total", "মোট"), money(total)],
      ],
      undefined,
      { signatures: [tx("Prepared by", "প্রস্তুতকারী"), tx("Manager", "ম্যানেজার"), tx("President", "সভাপতি"), tx("Auditor", "নিরীক্ষক")] },
    );
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">{tx("Office income (without farmer)", "অফিস আয় (কৃষক ছাড়া)")}</h3>
            <p className="text-sm text-muted-foreground">{tx("Scrap, loan, grant etc. on the irrigation receipt serial.", "ভাঙারি, হাওলাত, অনুদান ইত্যাদি — সেচ রশিদ সিরিয়ালে।")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportList} disabled={!rows.length}><FileDown className="mr-1 h-4 w-4" />{tx("Export PDF", "পিডিএফ")}</Button>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1" />{tx("Add income", "আয় যোগ")}</Button>
          </div>
        </div>

        <div className="text-sm">{tx("Total", "মোট")}: <span className="font-semibold">{money(total)}</span> · {rows.length} {tx("entries", "এন্ট্রি")}</div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Receipt No", "রশিদ নং")}</TableHead>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead>{tx("Payer", "প্রদানকারী")}</TableHead>
                <TableHead>{tx("Type", "ধরন")}</TableHead>
                <TableHead>{tx("Stream", "স্ট্রিম")}</TableHead>
                <TableHead className="text-right">{tx("Amount", "টাকা")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{tx("No income recorded", "কোনো আয় নেই")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.receipt_no}</TableCell>
                  <TableCell>{fmtDate(r.received_on)}</TableCell>
                  <TableCell>{r.payer_name}</TableCell>
                  <TableCell><Badge variant="secondary">{typeLabel(r.income_type)}</Badge></TableCell>
                  <TableCell>{streamLabel(r.stream)}</TableCell>
                  <TableCell className="text-right font-medium">{money(Number(r.amount))}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => printReceipt(r)}><Printer className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tx("Add office income", "অফিস আয় যোগ")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {offices.length > 1 && (
              <div>
                <Label>{tx("Office", "অফিস")}</Label>
                <Select value={form.office_id} onValueChange={(v) => setForm({ ...form, office_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Type", "ধরন")}</Label>
                <Select value={form.income_type} onValueChange={(v) => setForm({ ...form, income_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOME_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tx(t.en, t.bn)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("Stream", "স্ট্রিম")}</Label>
                <Select value={form.stream} onValueChange={(v) => setForm({ ...form, stream: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STREAMS.map((s) => <SelectItem key={s.value} value={s.value}>{tx(s.en, s.bn)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{tx("Payer name", "প্রদানকারীর নাম")}</Label>
              <Input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Amount", "টাকা")}</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>{tx("Date", "তারিখ")}</Label>
                <Input type="date" value={form.received_on} onChange={(e) => setForm({ ...form, received_on: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{tx("Receipt No (blank = auto)", "রশিদ নং (ফাঁকা = অটো)")}</Label>
              <Input value={form.receipt_no} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })} />
            </div>
            <div>
              <Label>{tx("Note", "নোট")}</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? tx("Saving…", "সংরক্ষণ…") : tx("Save", "সংরক্ষণ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Card>
  );
}
