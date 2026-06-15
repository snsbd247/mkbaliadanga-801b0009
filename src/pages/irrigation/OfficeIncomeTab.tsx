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
import { Plus, Trash2, Printer, FileDown, FileSpreadsheet, Eye, FileText } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { officeIncomeHeaders } from "@/lib/officeIncomeColumns";
import { canExportOfficeIncome, canCreateOfficeIncome } from "@/lib/officeIncomePermissions";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/auth/AuthProvider";
import { downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import { IrrigationReceiptPreviewDialog } from "@/components/receipts/IrrigationReceiptPreviewDialog";

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
  const { roles } = useAuth();
  const role = roles?.includes("super_admin") || roles?.includes("developer")
    ? "super_admin"
    : roles?.includes("admin") ? "admin"
    : roles?.includes("staff") ? "staff" : null;
  const canExport = canExportOfficeIncome(role as any);
  const canCreate = canCreateOfficeIncome(role as any);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    const errs: Record<string, string> = {};
    if (!form.payer_name.trim()) errs.payer_name = tx("Payer name required", "প্রদানকারীর নাম দিন");
    else if (form.payer_name.trim().length > 100) errs.payer_name = tx("Name too long (max 100)", "নাম খুব বড় (সর্বোচ্চ ১০০)");
    if (form.father_name?.trim().length > 100) errs.father_name = tx("Father's name too long (max 100)", "পিতার নাম খুব বড় (সর্বোচ্চ ১০০)");
    if (form.village?.trim().length > 100) errs.village = tx("Village too long (max 100)", "গ্রাম খুব বড় (সর্বোচ্চ ১০০)");
    const mob = form.mobile?.trim();
    if (mob && !/^[0-9+\-\s]{6,20}$/.test(mob)) errs.mobile = tx("Invalid mobile number", "সঠিক মোবাইল নম্বর দিন");
    if (!(Number(form.amount) > 0)) errs.amount = tx("Amount must be greater than 0", "টাকা ০-এর বেশি দিন");
    setFieldErrors(errs);
    if (Object.keys(errs).length) { toast.error(tx("Please fix the highlighted fields", "চিহ্নিত ঘরগুলো ঠিক করুন")); return; }
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
      setFieldErrors({});
      setForm({ ...form, payer_name: "", father_name: "", village: "", mobile: "", amount: "", receipt_no: "", note: "" });
      load();
    } catch (e: any) {
      // Map server-side validation messages to friendly field errors.
      const msg: string = e?.message ?? "";
      const map: Record<string, { key: string; en: string; bn: string }> = {
        father_name: { key: "father_name", en: "Father's name is invalid (max 100 chars)", bn: "পিতার নাম সঠিক নয় (সর্বোচ্চ ১০০ অক্ষর)" },
        village: { key: "village", en: "Village is invalid (max 100 chars)", bn: "গ্রাম সঠিক নয় (সর্বোচ্চ ১০০ অক্ষর)" },
        mobile: { key: "mobile", en: "Mobile number format is invalid", bn: "মোবাইল নম্বরের ফরম্যাট সঠিক নয়" },
        payer_name: { key: "payer_name", en: "Payer name is invalid", bn: "প্রদানকারীর নাম সঠিক নয়" },
        amount: { key: "amount", en: "Amount must be greater than 0", bn: "টাকা ০-এর বেশি দিন" },
      };
      const hit = Object.values(map).find((m) => msg.includes(m.key));
      if (hit) {
        setFieldErrors({ [hit.key]: tx(hit.en, hit.bn) });
        toast.error(tx(hit.en, hit.bn));
      } else {
        toast.error(msg || tx("Failed to save", "সংরক্ষণ ব্যর্থ"));
      }
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

  // Build a bnReceipts (irrigation payment receipt) payload from an office-income row.
  // Heading/labels auto-switch by stream (সেচ → irrigation, সেভিং → savings);
  // জমি ও মৌজা are locked to N/A via the office_income flag.
  const buildBnData = (r: any): BnReceiptData => {
    const officeName = offices.find((o) => o.id === r.office_id)?.name ?? "";
    return {
      kind: r.stream === "saving" ? "savings" : "irrigation",
      office_income: true,
      receipt_no: r.receipt_no,
      date: r.received_on,
      bill_info: typeLabel(r.income_type),
      company_name_bn: officeName,
      company_name: officeName,
      org: officeName ? { name: officeName, name_bn: officeName } : null,
      farmer: {
        name: r.payer_name || "N/A",
        father_or_husband: r.father_name || null,
        village: r.village || null,
        mobile: r.mobile || null,
      },
      remark: r.note || null,
      collected_amount: Number(r.amount),
    };
  };

  const printReceipt = async (r: any) => {
    if (!canExport) { toast.error(tx("You don't have permission to print", "প্রিন্টের অনুমতি নেই")); return; }
    logAudit({ office_id: r.office_id ?? null, module: "receipt", action_type: "export", reference_id: r.id, new_data: { action: "pdf_download", receipt_no: r.receipt_no } });
    await downloadBnReceiptPdf(buildBnData(r), "both");
  };

  const downloadReceiptPdf = (r: any) => printReceipt(r);



  const NA = "N/A";
  const exportHead = () => officeIncomeHeaders(tx);
  const exportRow = (r: any) => [
    r.receipt_no, fmtDate(r.received_on), r.payer_name || NA,
    r.father_name || NA, r.village || NA, r.mobile || NA,
    NA, NA, typeLabel(r.income_type), streamLabel(r.stream),
    r.note || NA, money(Number(r.amount)),
  ];

  const auditExport = (action: string) =>
    logAudit({ office_id: offices[0]?.id ?? null, module: "receipt", action_type: "export", new_data: { action, count: rows.length } });

  const exportList = () => {
    if (!canExport) { toast.error(tx("You don't have permission to export", "এক্সপোর্টের অনুমতি নেই")); return; }
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
    auditExport("pdf");
  };

  const exportXlsx = () => {
    if (!canExport) { toast.error(tx("You don't have permission to export", "এক্সপোর্টের অনুমতি নেই")); return; }
    const head = exportHead();
    const data = rows.map((r) => {
      const cells = exportRow(r);
      return head.reduce((o: any, h, i) => { o[h] = cells[i]; return o; }, {});
    });
    exportExcel("office-income", tx("Office Income", "অফিস আয়"), data);
    auditExport("excel");
  };

  // Blank A4-style Excel template with the exact column order & headers (one N/A sample row).
  const exportTemplate = () => {
    if (!canExport) { toast.error(tx("You don't have permission to export", "এক্সপোর্টের অনুমতি নেই")); return; }
    const head = exportHead();
    const sample = head.reduce((o: any, h) => { o[h] = "N/A"; return o; }, {});
    exportExcel("office-income-template", tx("Office Income Template", "অফিস আয় টেমপ্লেট"), [sample]);
    auditExport("template");
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
            {canExport && <Button variant="outline" onClick={exportList} disabled={!rows.length}><FileDown className="mr-1 h-4 w-4" />{tx("Export PDF", "পিডিএফ")}</Button>}
            {canExport && <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}><FileSpreadsheet className="mr-1 h-4 w-4" />{tx("Export Excel", "এক্সেল")}</Button>}
            {canExport && <Button variant="outline" onClick={exportTemplate}><FileText className="mr-1 h-4 w-4" />{tx("Excel Template", "টেমপ্লেট")}</Button>}
            {canCreate && <Button onClick={() => setOpen(true)}><Plus className="mr-1" />{tx("Add income", "আয় যোগ")}</Button>}
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
                    <Button variant="ghost" size="icon" onClick={() => setPreview(r)}><Eye className="h-4 w-4" /></Button>
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
              <Input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} aria-invalid={!!fieldErrors.payer_name} />
              {fieldErrors.payer_name && <p className="mt-1 text-xs text-destructive">{fieldErrors.payer_name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Father's name", "পিতার নাম")}</Label>
                <Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} aria-invalid={!!fieldErrors.father_name} />
                {fieldErrors.father_name && <p className="mt-1 text-xs text-destructive">{fieldErrors.father_name}</p>}
              </div>
              <div>
                <Label>{tx("Village", "গ্রাম")}</Label>
                <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} aria-invalid={!!fieldErrors.village} />
                {fieldErrors.village && <p className="mt-1 text-xs text-destructive">{fieldErrors.village}</p>}
              </div>
            </div>
            <div>
              <Label>{tx("Mobile", "মোবাইল")}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} aria-invalid={!!fieldErrors.mobile} />
              {fieldErrors.mobile && <p className="mt-1 text-xs text-destructive">{fieldErrors.mobile}</p>}
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

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tx("Receipt preview", "রশিদ প্রিভিউ")}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-1 text-sm">
              {([
                [tx("Receipt No", "রশিদ নং"), preview.receipt_no],
                [tx("Date", "তারিখ"), fmtDate(preview.received_on)],
                [tx("Name", "নাম"), preview.payer_name || "N/A"],
                [tx("Father's name", "পিতার নাম"), preview.father_name || "N/A"],
                [tx("Village", "গ্রাম"), preview.village || "N/A"],
                [tx("Mobile", "মোবাইল"), preview.mobile || "N/A"],
                [tx("Mouza", "মৌজা"), "N/A"],
                [tx("Land", "জমি"), "N/A"],
                [tx("Income Type", "আয়ের ধরন"), typeLabel(preview.income_type)],
                [tx("Stream", "স্ট্রিম"), streamLabel(preview.stream)],
                [tx("Remark", "রিমার্ক"), preview.note || "N/A"],
                [tx("Amount Received", "প্রাপ্ত টাকা"), money(Number(preview.amount))],
              ] as [string, any][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>{tx("Close", "বন্ধ")}</Button>
            {canExport && <Button variant="outline" onClick={() => downloadReceiptPdf(preview)}><FileDown className="mr-1 h-4 w-4" />{tx("Download PDF", "পিডিএফ ডাউনলোড")}</Button>}
            {canExport && <Button onClick={() => { printReceipt(preview); }}><Printer className="mr-1 h-4 w-4" />{tx("Print", "প্রিন্ট")}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Card>
  );
}
