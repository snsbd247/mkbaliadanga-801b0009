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
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";
import { Plus, Trash2, Printer, FileDown, FileSpreadsheet } from "lucide-react";
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
    father_name: "",
    village: "",
    mobile: "",
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
    if (form.payer_name.trim().length > 100) { toast.error(tx("Name too long", "নাম খুব বড়")); return; }
    if (form.father_name?.trim().length > 100) { toast.error(tx("Father's name too long", "পিতার নাম খুব বড়")); return; }
    if (form.village?.trim().length > 100) { toast.error(tx("Village too long", "গ্রাম খুব বড়")); return; }
    const mob = form.mobile?.trim();
    if (mob && !/^[0-9+\-\s]{6,20}$/.test(mob)) { toast.error(tx("Invalid mobile number", "সঠিক মোবাইল নম্বর দিন")); return; }
    if (!(Number(form.amount) > 0)) { toast.error(tx("Amount must be greater than 0", "টাকা ০-এর বেশি দিন")); return; }
    setSaving(true);
    try {
      let receiptNo = form.receipt_no.trim();
      // সেচ রশিদের একই সিরিয়াল ধারা ব্যবহার করা হয়।
      if (!receiptNo) receiptNo = await nextUnifiedReceiptNo(form.office_id || null, "IRR", crypto.randomUUID());
      const { error } = await (supabase as any).from("office_incomes").insert({
        office_id: form.office_id || null,
        receipt_no: receiptNo,
        income_type: form.income_type,
        payer_name: form.payer_name.trim(),
        father_name: form.father_name?.trim() || null,
        village: form.village?.trim() || null,
        mobile: form.mobile?.trim() || null,
        amount: Number(form.amount),
        received_on: form.received_on,
        stream: form.stream,
        note: form.note?.trim() || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success(tx("Income recorded", "আয় সংরক্ষিত হয়েছে"));
      setOpen(false);
      setForm({ ...form, payer_name: "", father_name: "", village: "", mobile: "", amount: "", receipt_no: "", note: "" });
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
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${r.receipt_no}</title>
      <style>
        @page{size:A4 portrait;margin:18mm}
        *{box-sizing:border-box}
        body{font-family:'Noto Sans Bengali',Arial,sans-serif;color:#1a1a1a;margin:0}
        .sheet{border:2px solid #1f4e79;padding:28px 32px;border-radius:6px}
        .head{text-align:center;border-bottom:2px solid #1f4e79;padding-bottom:12px;margin-bottom:18px}
        .org{font-size:24px;font-weight:800;color:#1f4e79;letter-spacing:.3px}
        .doc{display:inline-block;margin-top:10px;background:#1f4e79;color:#fff;padding:4px 18px;border-radius:20px;font-size:13px;font-weight:700}
        .meta{display:flex;justify-content:space-between;font-size:13px;color:#444;margin:14px 0 18px}
        table{width:100%;border-collapse:collapse;font-size:14px}
        td{padding:9px 8px;border-bottom:1px solid #e3e3e3}
        .lbl{color:#555;width:38%;font-weight:600}
        .amtrow td{border-top:2px solid #1f4e79;border-bottom:none;padding-top:14px}
        .amt{text-align:right;font-size:22px;font-weight:800;color:#1f4e79}
        .signs{display:flex;justify-content:space-between;margin-top:64px}
        .sig{width:42%;text-align:center;border-top:1px solid #999;padding-top:6px;font-size:12px;color:#555}
        .foot{text-align:center;margin-top:26px;font-size:11px;color:#888}
      </style></head><body onload="window.print()">
      <div class="sheet">
        <div class="head">
          <div class="org">${officeName || tx("Office", "অফিস")}</div>
          <div class="doc">${tx("OFFICE INCOME RECEIPT", "অফিস আয় রশিদ")}</div>
        </div>
        <div class="meta">
          <span>${tx("Receipt No", "রশিদ নং")}: <b>${r.receipt_no}</b></span>
          <span>${tx("Date", "তারিখ")}: <b>${fmtDate(r.received_on)}</b></span>
        </div>
        <table>
          <tr><td class="lbl">${tx("Name", "নাম")}</td><td>${r.payer_name ?? "N/A"}</td></tr>
          <tr><td class="lbl">${tx("Father's name", "পিতার নাম")}</td><td>${r.father_name || "N/A"}</td></tr>
          <tr><td class="lbl">${tx("Village", "গ্রাম")}</td><td>${r.village || "N/A"}</td></tr>
          <tr><td class="lbl">${tx("Mobile", "মোবাইল")}</td><td>${r.mobile || "N/A"}</td></tr>
          <tr><td class="lbl">${tx("Mouza", "মৌজা")}</td><td>N/A</td></tr>
          <tr><td class="lbl">${tx("Land", "জমি")}</td><td>N/A</td></tr>
          <tr><td class="lbl">${tx("Income Type", "আয়ের ধরন")}</td><td>${typeLabel(r.income_type)}</td></tr>
          <tr><td class="lbl">${tx("Stream", "স্ট্রিম")}</td><td>${streamLabel(r.stream)}</td></tr>
          <tr><td class="lbl">${tx("Remark", "রিমার্ক")}</td><td>${r.note || "N/A"}</td></tr>
          <tr class="amtrow"><td class="lbl">${tx("Amount Received", "প্রাপ্ত টাকা")}</td><td class="amt">${money(Number(r.amount))}</td></tr>
        </table>
        <div class="signs">
          <div class="sig">${tx("Payer Signature", "প্রদানকারীর স্বাক্ষর")}</div>
          <div class="sig">${tx("Authorised Signature", "অনুমোদিত স্বাক্ষর")}</div>
        </div>
        <div class="foot">${tx("This is a system-generated receipt.", "এটি সিস্টেম-জেনারেটেড রশিদ।")}</div>
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
  };


  const NA = "N/A";
  const exportHead = () => [
    tx("Receipt No", "রশিদ নং"), tx("Date", "তারিখ"), tx("Name", "নাম"),
    tx("Father's name", "পিতার নাম"), tx("Village", "গ্রাম"), tx("Mobile", "মোবাইল"),
    tx("Mouza", "মৌজা"), tx("Land", "জমি"), tx("Type", "ধরন"), tx("Stream", "স্ট্রিম"),
    tx("Remark", "রিমার্ক"), tx("Amount", "টাকা"),
  ];
  const exportRow = (r: any) => [
    r.receipt_no, fmtDate(r.received_on), r.payer_name || NA,
    r.father_name || NA, r.village || NA, r.mobile || NA,
    NA, NA, typeLabel(r.income_type), streamLabel(r.stream),
    r.note || NA, money(Number(r.amount)),
  ];

  const exportList = () => {
    const head = exportHead();
    exportTablePDF(
      tx("Office Income Statement", "অফিস আয় বিবরণী"),
      head,
      [
        ...rows.map(exportRow),
        ["", "", "", "", "", "", "", "", "", "", tx("Total", "মোট"), money(total)],
      ],
      undefined,
      { signatures: [tx("Prepared by", "প্রস্তুতকারী"), tx("Manager", "ম্যানেজার"), tx("President", "সভাপতি"), tx("Auditor", "নিরীক্ষক")], landscape: true },
    );
  };

  const exportXlsx = () => {
    const head = exportHead();
    const data = rows.map((r) => {
      const cells = exportRow(r);
      return head.reduce((o: any, h, i) => { o[h] = cells[i]; return o; }, {});
    });
    exportExcel("office-income", tx("Office Income", "অফিস আয়"), data);
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
            <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}><FileSpreadsheet className="mr-1 h-4 w-4" />{tx("Export Excel", "এক্সেল")}</Button>
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
                <Label>{tx("Father's name", "পিতার নাম")}</Label>
                <Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
              </div>
              <div>
                <Label>{tx("Village", "গ্রাম")}</Label>
                <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{tx("Mobile", "মোবাইল")}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
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
              <Label>{tx("Remark", "রিমার্ক")}</Label>
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
