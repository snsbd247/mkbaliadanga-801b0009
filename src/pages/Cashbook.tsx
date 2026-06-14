import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileDown, FileSpreadsheet, Printer, Pencil, Trash2, Paperclip } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { exportTablePDF, exportExcel, exportCashbookPDF, exportCashbookExcel } from "@/lib/exports";
import { useBranding } from "@/lib/branding";
import { downloadBnReceiptPdf } from "@/lib/bnReceipts";
import { nextMonthlyReceiptNo } from "@/lib/monthlyReceiptNo";
import { autoReceiptNo } from "@/lib/receiptNo";

const sb = supabase as any;

const RECEIPT_KINDS = [
  "irrigation", "bigha_rent", "pond", "crop_sale", "scrap",
  "loan_taken", "donation", "savings_deposit", "share", "other",
] as const;
type Kind = typeof RECEIPT_KINDS[number];

type Stream = "irrigation" | "savings";

function getKindLabel(t: (k: any) => string, k: Kind): string {
  const map: Record<Kind, string> = {
    irrigation: t("kindIrrigation"),
    bigha_rent: t("kindBighaRent"),
    pond: t("kindPond"),
    crop_sale: t("kindCropSale"),
    scrap: t("kindScrap"),
    loan_taken: t("kindLoanTaken"),
    donation: t("kindDonation"),
    savings_deposit: t("savingsDeposit"),
    share: t("kindShare"),
    other: t("kindOther"),
  };
  return map[k] ?? k;
}

// Which receipt kinds feed which cash stream (income side).
const STREAM_INCOME_KINDS: Record<Stream, Set<string>> = {
  irrigation: new Set(["irrigation", "bigha_rent", "pond", "crop_sale", "scrap"]),
  savings: new Set(["savings_deposit", "share", "loan_taken", "donation", "other"]),
};

export default function Cashbook() {
  const { t, tx } = useLang();
  const { user, isAdmin, isCommittee, isSuper, officeId } = useAuth();
  const brand = useBranding();
  const today = new Date();

  // Month for cash-format views / submission
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  const mFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const mTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [farmers, setFarmers] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const [openingCash, setOpeningCash] = useState<Record<Stream, number>>(() => ({
    irrigation: Number(localStorage.getItem("cb_open_irrigation") ?? 0),
    savings: Number(localStorage.getItem("cb_open_savings") ?? 0),
  }));
  function setOpening(stream: Stream, v: number) {
    setOpeningCash(prev => { const next = { ...prev, [stream]: v }; localStorage.setItem(`cb_open_${stream}`, String(v || 0)); return next; });
  }

  // ----- Voucher (expense) dialog -----
  const emptyV = {
    id: "" as string, stream: "irrigation" as Stream, head_id: "", amount: 0,
    payee: "", note: "", expense_date: new Date().toISOString().slice(0, 10),
    method: "cash" as "cash" | "bank", bank_account_id: "",
  };
  const [openV, setOpenV] = useState(false);
  const [v, setV] = useState(emptyV);
  const [file, setFile] = useState<File | null>(null);
  const [savingV, setSavingV] = useState(false);

  // ----- Income receipt dialog -----
  const [openR, setOpenR] = useState(false);
  const [r, setR] = useState({
    kind: "irrigation" as Kind, farmer_id: "", amount: 0, method: "cash",
    note: "", receipt_date: new Date().toISOString().slice(0, 10),
  });

  // ----- Office income dialog -----
  const [openOI, setOpenOI] = useState(false);
  const [oi, setOI] = useState({ kind: "scrap" as Kind, remark: "", amount: 0, receipt_date: new Date().toISOString().slice(0, 10) });
  const OFFICE_INCOME_KINDS: Kind[] = ["scrap", "loan_taken", "donation", "other"];

  useEffect(() => {
    document.title = `${t("cashbook")} — ${t("appName")}`;
    supabase.from("farmers").select("id,name_en,farmer_code,member_no").order("name_en").then(d => setFarmers(d.data ?? []));
    loadHeads();
    sb.from("bank_accounts").select("*").eq("is_active", true).order("bank_name").then((d: any) => setBankAccounts(d.data ?? []));
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  async function loadHeads() {
    const { data } = await sb.from("cashbook_expense_heads").select("*").eq("is_active", true).order("stream").order("sort_order");
    setHeads(data ?? []);
  }

  async function load() {
    const [rec, exp, subs] = await Promise.all([
      sb.from("receipts").select("*, farmers(name_en,farmer_code,member_no)").gte("receipt_date", mFrom).lte("receipt_date", mTo).order("receipt_date", { ascending: false }),
      sb.from("expenses").select("*").is("deleted_at", null).gte("expense_date", mFrom).lte("expense_date", mTo).order("expense_date", { ascending: false }),
      sb.from("cashbook_submissions").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(48),
    ]);
    setReceipts(rec.data ?? []); setExpenses(exp.data ?? []); setSubmissions(subs.data ?? []);
  }

  function isLocked(stream: Stream) {
    return submissions.some(s => s.year === year && s.month === month && s.stream === stream && s.locked);
  }

  function headsFor(stream: Stream) {
    return heads.filter(h => h.stream === stream);
  }

  // ---------- Save voucher (expense) ----------
  async function saveVoucher() {
    if (v.amount <= 0) return toast.error(t("amountMustBePositive"));
    if (!v.head_id) return toast.error(tx("Pick an expense head", "একটি খাত নির্বাচন করুন"));
    if (v.method === "bank" && !v.bank_account_id) return toast.error(tx("Select a bank account", "ব্যাংক একাউন্ট নির্বাচন করুন"));
    if (isLocked(v.stream) && !isSuper) return toast.error(tx("This stream is locked for the month", "এই মাসের ক্যাশ লক করা আছে"));
    setSavingV(true);
    try {
      const head = headsFor(v.stream).find(h => h.id === v.head_id);
      const headName = head?.name_bn || head?.name_en || "";

      // upload scan
      let attachment_path: string | null = null;
      let attachment_mime: string | null = null;
      if (file) {
        const path = `${officeId ?? "global"}/cashbook/${Date.now()}-${file.name}`;
        const { error: upErr } = await sb.storage.from("vouchers").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        attachment_path = path; attachment_mime = file.type;
      }

      const payload: any = {
        expense_date: v.expense_date, head: headName, head_id: v.head_id,
        payee: v.payee || null, amount: v.amount, method: v.method, note: v.note || null,
        stream: v.stream, office_id: officeId ?? null,
        is_bank_deposit: v.method === "bank", bank_account_id: v.method === "bank" ? v.bank_account_id : null,
      };
      if (attachment_path) { payload.attachment_path = attachment_path; payload.attachment_mime = attachment_mime; }

      if (v.id) {
        const { error } = await sb.from("expenses").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data: ins, error } = await sb.from("expenses").insert(payload).select("id").single();
        if (error) throw error;
        // mirror bank deposit into bank_transactions
        if (v.method === "bank") {
          await sb.from("bank_transactions").insert({
            bank_account_id: v.bank_account_id, txn_date: v.expense_date, txn_type: "deposit",
            amount: v.amount, note: `${tx("Cashbook deposit", "ক্যাশবুক জমা")} — ${headName}`,
            office_id: officeId ?? null, created_by: user?.id, reference_no: ins?.id ?? null,
          });
        }
      }
      toast.success(t("saved"));
      setOpenV(false); setV(emptyV); setFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setSavingV(false); }
  }

  function editVoucher(x: any) {
    setV({
      id: x.id, stream: (x.stream as Stream) || "savings", head_id: x.head_id || "",
      amount: Number(x.amount), payee: x.payee || "", note: x.note || "",
      expense_date: x.expense_date, method: x.is_bank_deposit ? "bank" : "cash",
      bank_account_id: x.bank_account_id || "",
    });
    setFile(null); setOpenV(true);
  }

  async function deleteVoucher(x: any) {
    if (isLocked(x.stream) && !isSuper) return toast.error(tx("Locked", "লক করা আছে"));
    if (x.voucher_no && !isSuper) return toast.error(tx("Already serialized; only super-admin can delete", "সিরিয়াল হয়ে গেছে; শুধু সুপার-অ্যাডমিন মুছতে পারবেন"));
    if (!confirm(tx("Delete this voucher?", "এই ভাউচার মুছবেন?"))) return;
    const { error } = await sb.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", x.id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }

  async function downloadScan(path: string) {
    const { data, error } = await sb.storage.from("vouchers").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  // ---------- Monthly final submit per stream ----------
  async function submitStream(stream: Stream) {
    if (isLocked(stream)) return toast.error(tx("Already submitted/locked", "ইতিমধ্যে সাবমিট/লক করা আছে"));
    if (!confirm(`${year}-${String(month).padStart(2, "0")} — ${stream === "irrigation" ? tx("Irrigation", "সেচ") : tx("Savings", "সেভিং")} ${tx("final submit? Vouchers will get permanent serials.", "ফাইনাল সাবমিট করবেন? ভাউচার গুলো স্থায়ী সিরিয়াল পাবে।")}`)) return;

    // assign lifetime serials to expense vouchers without a number
    const toSerialize = expenses
      .filter(e => e.stream === stream && !e.voucher_no)
      .sort((a, b) => (a.expense_date.localeCompare(b.expense_date)) || String(a.id).localeCompare(String(b.id)));
    for (const e of toSerialize) {
      const { data: no, error: rpcErr } = await sb.rpc("next_cashbook_voucher_no", { _office: officeId ?? null, _stream: stream });
      if (rpcErr) return toast.error(rpcErr.message);
      const prefix = stream === "irrigation" ? "IRR-V" : "SAV-V";
      const voucher_no = `${prefix}-${String(no).padStart(5, "0")}`;
      const { error: upErr } = await sb.from("expenses").update({ voucher_no }).eq("id", e.id);
      if (upErr) return toast.error(upErr.message);
    }

    const inc = receipts.filter(x => STREAM_INCOME_KINDS[stream].has(x.kind)).reduce((s, x) => s + Number(x.amount), 0);
    const exp = expenses.filter(x => x.stream === stream).reduce((s, x) => s + Number(x.amount), 0);
    const opening = Number(openingCash[stream] || 0);
    const { error } = await sb.from("cashbook_submissions").insert({
      year, month, stream, opening_cash: opening, total_income: inc, total_expense: exp,
      closing_cash: opening + inc - exp, submitted_by: user?.id, locked: true,
    });
    if (error) return toast.error(error.message);
    toast.success(t("submitted" as any) || "সাবমিট করা হয়েছে");
    load();
  }

  async function unlockSubmission(id: string) {
    if (!isSuper) return;
    if (!confirm("আনলক করবেন?")) return;
    const { error } = await sb.from("cashbook_submissions").update({ locked: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unlocked"); load();
  }

  // ---------- Income receipt ----------
  async function saveReceipt() {
    if (r.amount <= 0) return toast.error(t("amountMustBePositive"));
    if (!r.kind) return toast.error(t("pickAKind"));
    const { error } = await supabase.from("receipts").insert({
      kind: r.kind, farmer_id: r.farmer_id || null, amount: r.amount, method: r.method,
      note: r.note, receipt_date: r.receipt_date, collected_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpenR(false);
    setR({ kind: "irrigation", farmer_id: "", amount: 0, method: "cash", note: "", receipt_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function printOfficeIncomeReceipt(rcpt: { receipt_no: string; receipt_date: string; amount: number; note: string }) {
    await downloadBnReceiptPdf(
      {
        kind: "irrigation", receipt_no: rcpt.receipt_no, date: rcpt.receipt_date,
        company_name: brand.company_name, company_name_bn: brand.company_name_bn, logo_url: brand.logo_url,
        farmer: { name: "N/A" }, total_outstanding: 0, collected_amount: Number(rcpt.amount), remark: rcpt.note,
      },
      "both", { paper: "a5", orientation: "l", lang: "bn" },
    );
  }

  async function saveOfficeIncome(print: boolean) {
    if (oi.amount <= 0) return toast.error(t("amountMustBePositive"));
    if (!oi.remark.trim()) return toast.error(tx("Write a remark / description", "একটি রিমার্ক / বিবরণ লিখুন"));
    const receipt_no = await nextMonthlyReceiptNo("IRR", officeId, `OI-${Date.now()}-${crypto.randomUUID()}`)
      .catch(() => autoReceiptNo("IRR", `${Date.now()}`));
    const { error } = await supabase.from("receipts").insert({
      kind: oi.kind, farmer_id: null, amount: oi.amount, method: "cash", note: oi.remark.trim(),
      receipt_date: oi.receipt_date, collected_by: user?.id, receipt_no,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    if (print) await printOfficeIncomeReceipt({ receipt_no, receipt_date: oi.receipt_date, amount: oi.amount, note: oi.remark.trim() });
    setOpenOI(false);
    setOI({ kind: "scrap", remark: "", amount: 0, receipt_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title={t("cashbook")}
        description={`${brand.company_name} • ${monthLabel}`}
        actions={
          <>
            <Dialog open={openV} onOpenChange={(o) => { setOpenV(o); if (!o) { setV(emptyV); setFile(null); } }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("Voucher", "ভাউচার")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{v.id ? tx("Edit voucher", "ভাউচার সম্পাদনা") : tx("Add expense voucher", "ব্যয় ভাউচার যোগ")}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>{tx("Cash type", "কোন ক্যাশ")}</Label>
                    <Select value={v.stream} onValueChange={(s: Stream) => setV({ ...v, stream: s, head_id: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="irrigation">{tx("Irrigation expense", "সেচ ব্যয়")}</SelectItem>
                        <SelectItem value="savings">{tx("Savings expense", "সেভিং ব্যয়")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{tx("Expense head", "খাত")}</Label>
                    <Select value={v.head_id} onValueChange={val => setV({ ...v, head_id: val })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{headsFor(v.stream).map(h => <SelectItem key={h.id} value={h.id}>{h.name_bn}{h.name_en ? ` (${h.name_en})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("amount")}</Label><Input type="number" value={v.amount || ""} onChange={ev => setV({ ...v, amount: +ev.target.value })} /></div>
                    <div><Label>{t("date")}</Label><Input type="date" value={v.expense_date} onChange={ev => setV({ ...v, expense_date: ev.target.value })} /></div>
                  </div>
                  <div><Label>{t("payee")}</Label><Input value={v.payee} onChange={ev => setV({ ...v, payee: ev.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{tx("Payment via", "পরিশোধের ধরন")}</Label>
                      <Select value={v.method} onValueChange={(m: "cash" | "bank") => setV({ ...v, method: m })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{tx("Cash", "নগদ")}</SelectItem>
                          <SelectItem value="bank">{tx("Bank deposit", "ব্যাংক জমা")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {v.method === "bank" && (
                      <div><Label>{tx("Bank account", "ব্যাংক একাউন্ট")}</Label>
                        <Select value={v.bank_account_id} onValueChange={val => setV({ ...v, bank_account_id: val })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_no}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div><Label>{t("note")} ({tx("description", "বিবরণ")})</Label><Textarea value={v.note} onChange={ev => setV({ ...v, note: ev.target.value })} /></div>
                  <div><Label>{tx("Scan copy (image / PDF)", "স্ক্যান কপি (ছবি / PDF)")}</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={ev => setFile(ev.target.files?.[0] ?? null)} />
                    {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenV(false)}>{t("cancel")}</Button>
                  <Button onClick={saveVoucher} disabled={savingV}>{savingV ? "…" : t("save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openR} onOpenChange={setOpenR}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("receipts")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("addNew")} — {t("receipts")}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>{t("type")}</Label>
                    <Select value={r.kind} onValueChange={(val: any) => setR({ ...r, kind: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RECEIPT_KINDS.map(k => <SelectItem key={k} value={k}>{getKindLabel(t, k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t("farmerName")} <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Select value={r.farmer_id} onValueChange={val => setR({ ...r, farmer_id: val })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("amount")}</Label><Input type="number" value={r.amount || ""} onChange={ev => setR({ ...r, amount: +ev.target.value })} /></div>
                    <div><Label>{t("date")}</Label><Input type="date" value={r.receipt_date} onChange={ev => setR({ ...r, receipt_date: ev.target.value })} /></div>
                    <div><Label>{t("method")}</Label><Input value={r.method} onChange={ev => setR({ ...r, method: ev.target.value })} /></div>
                  </div>
                  <div><Label>{t("note")}</Label><Input value={r.note} onChange={ev => setR({ ...r, note: ev.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenR(false)}>{t("cancel")}</Button><Button onClick={saveReceipt}>{t("save")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openOI} onOpenChange={setOpenOI}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{tx("Office income", "অফিস আয়")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tx("Office income (no farmer)", "অফিস আয় (কৃষক ছাড়া)")}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>{tx("Category", "খাত")}</Label>
                    <Select value={oi.kind} onValueChange={(val: any) => setOI({ ...oi, kind: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{OFFICE_INCOME_KINDS.map(k => <SelectItem key={k} value={k}>{getKindLabel(t, k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{tx("Remark / description", "রিমার্ক / বিবরণ")}</Label>
                    <Input value={oi.remark} onChange={ev => setOI({ ...oi, remark: ev.target.value })} placeholder={tx("e.g. Scrap sale", "যেমন: ভাঙারি বিক্রি")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("amount")}</Label><Input type="number" value={oi.amount || ""} onChange={ev => setOI({ ...oi, amount: +ev.target.value })} /></div>
                    <div><Label>{t("date")}</Label><Input type="date" value={oi.receipt_date} onChange={ev => setOI({ ...oi, receipt_date: ev.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenOI(false)}>{t("cancel")}</Button>
                  <Button variant="outline" onClick={() => saveOfficeIncome(false)}>{t("save")}</Button>
                  <Button onClick={() => saveOfficeIncome(true)}><Printer className="h-4 w-4 mr-1" />{tx("Save & print", "সেভ ও প্রিন্ট")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>{tx("Year", "বছর")}</Label><Input type="number" className="w-28" value={year} onChange={e => setYear(+e.target.value)} /></div>
          <div><Label>{tx("Month", "মাস")}</Label>
            <Select value={String(month)} onValueChange={val => setMonth(+val)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground self-center">{tx("Each stream is a separate cash. Vouchers get a lifetime serial on final submit.", "প্রতিটি স্ট্রিম আলাদা ক্যাশ। ফাইনাল সাবমিটে ভাউচার স্থায়ী সিরিয়াল পায়।")}</p>
        </div>
      </Card>

      <Tabs defaultValue="irrigation">
        <TabsList>
          <TabsTrigger value="irrigation">{tx("Irrigation cash", "সেচ ক্যাশ")}</TabsTrigger>
          <TabsTrigger value="savings">{tx("Savings cash", "সেভিং ক্যাশ")}</TabsTrigger>
          <TabsTrigger value="receipts">{t("receipts")}</TabsTrigger>
          <TabsTrigger value="heads">{tx("Expense heads", "খাত সেটিংস")}</TabsTrigger>
        </TabsList>

        <TabsContent value="irrigation">
          <StreamCashbook
            stream="irrigation" label={tx("Irrigation cash", "সেচ ক্যাশ")}
            month={monthLabel} mFrom={mFrom} mTo={mTo}
            receipts={receipts} expenses={expenses} opening={openingCash.irrigation}
            setOpening={(n) => setOpening("irrigation", n)} locked={isLocked("irrigation")}
            canSubmit={isCommittee} isSuper={isSuper} brand={brand}
            onSubmit={() => submitStream("irrigation")}
            onEdit={editVoucher} onDelete={deleteVoucher} onScan={downloadScan}
            submissions={submissions} onUnlock={unlockSubmission}
          />
        </TabsContent>

        <TabsContent value="savings">
          <StreamCashbook
            stream="savings" label={tx("Savings cash", "সেভিং ক্যাশ")}
            month={monthLabel} mFrom={mFrom} mTo={mTo}
            receipts={receipts} expenses={expenses} opening={openingCash.savings}
            setOpening={(n) => setOpening("savings", n)} locked={isLocked("savings")}
            canSubmit={isCommittee} isSuper={isSuper} brand={brand}
            onSubmit={() => submitStream("savings")}
            onEdit={editVoucher} onDelete={deleteVoucher} onScan={downloadScan}
            submissions={submissions} onUnlock={unlockSubmission}
          />
        </TabsContent>

        <TabsContent value="receipts">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("receiptNo")}</TableHead><TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead><TableHead>{t("farmerName")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("method")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {receipts.map(x => (
                <TableRow key={x.id}>
                  <TableCell className="font-mono text-xs">{x.receipt_no}</TableCell>
                  <TableCell>{fmtDate(x.receipt_date)}</TableCell>
                  <TableCell><Badge variant="outline">{getKindLabel(t, x.kind as Kind)}</Badge></TableCell>
                  <TableCell>{x.farmers?.name_en ?? <span className="text-muted-foreground">{x.note || "—"}</span>}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{money(x.amount)}</TableCell>
                  <TableCell>{x.method}</TableCell>
                </TableRow>
              ))}
              {receipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="heads">
          <ExpenseHeadsManager heads={heads} canManage={isAdmin || isCommittee} officeId={officeId} reload={loadHeads} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ====================== Stream cashbook view ======================
function StreamCashbook(props: {
  stream: Stream; label: string; month: string; mFrom: string; mTo: string;
  receipts: any[]; expenses: any[]; opening: number; setOpening: (n: number) => void;
  locked: boolean; canSubmit: boolean; isSuper: boolean; brand: any;
  onSubmit: () => void; onEdit: (x: any) => void; onDelete: (x: any) => void; onScan: (p: string) => void;
  submissions: any[]; onUnlock: (id: string) => void;
}) {
  const { t, tx } = useLang();
  const { stream, label, month, mFrom, mTo, receipts, expenses, opening, setOpening, locked, canSubmit, isSuper, onSubmit, onEdit, onDelete, onScan, submissions, onUnlock } = props;

  const [consolidated, setConsolidated] = useState(true);

  const streamReceipts = useMemo(() => receipts.filter(x => STREAM_INCOME_KINDS[stream].has(x.kind)), [receipts, stream]);
  const streamExpenses = useMemo(() => expenses.filter(x => x.stream === stream), [expenses, stream]);

  // Income rows — either one row per receipt, or one consolidated row per kind
  // (cash-book style) with description "রশিদ নং X – Y (n টি)".
  const incomeRows = useMemo(() => {
    if (!consolidated) {
      return streamReceipts.map(x => ({
        date: x.receipt_date, kind: "income", ref: x.receipt_no || "—",
        label: getKindLabel(t, x.kind as Kind), desc: x.note || "", amount: Number(x.amount), raw: x,
      }));
    }
    const groups = new Map<string, any[]>();
    streamReceipts.forEach(x => { if (!groups.has(x.kind)) groups.set(x.kind, []); groups.get(x.kind)!.push(x); });
    return Array.from(groups.entries()).map(([kind, list]) => {
      const sorted = [...list].sort((a, b) => String(a.receipt_no || "").localeCompare(String(b.receipt_no || "")));
      const nos = sorted.map(s => s.receipt_no).filter(Boolean);
      const range = nos.length === 0 ? "" : nos.length === 1 ? String(nos[0]) : `${nos[0]} – ${nos[nos.length - 1]}`;
      const desc = `${tx("Receipt no", "রশিদ নং")} ${range} (${list.length}${tx(" pcs", "টি")})`;
      const amount = list.reduce((s, x) => s + Number(x.amount), 0);
      const date = sorted[sorted.length - 1].receipt_date;
      return { date, kind: "income", ref: range || "—", label: getKindLabel(t, kind as Kind), desc, amount, raw: { note: desc } };
    });
  }, [streamReceipts, consolidated, t]);

  const entries = useMemo(() => {
    const rows: any[] = [
      ...incomeRows,
      ...streamExpenses.map(x => ({ date: x.expense_date, kind: "expense", ref: x.voucher_no || "—", label: x.head, desc: x.payee || x.note || "", amount: Number(x.amount), raw: x })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = Number(opening || 0);
    return rows.map(row => { bal += row.kind === "income" ? row.amount : -row.amount; return { ...row, balance: bal }; });
  }, [incomeRows, streamExpenses, opening]);

  const totalIncome = streamReceipts.reduce((s, x) => s + Number(x.amount), 0);
  const totalExpense = streamExpenses.reduce((s, x) => s + Number(x.amount), 0);
  const closing = Number(opening || 0) + totalIncome - totalExpense;

  // Expense by head summary
  const byHead = useMemo(() => {
    const m = new Map<string, number>();
    streamExpenses.forEach(x => m.set(x.head, (m.get(x.head) || 0) + Number(x.amount)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [streamExpenses]);

  const range = { from: mFrom, to: mTo };
  const title = `${label} — ${month}`;

  function cbRows() {
    return entries.map(r => ({
      date: r.date, ref: r.ref === "—" ? "" : r.ref, head: r.label,
      desc: r.desc || r.raw?.payee || r.raw?.note || "",
      income: r.kind === "income" ? r.amount : 0,
      expense: r.kind === "expense" ? r.amount : 0,
      balance: r.balance,
    }));
  }
  function exportPdf() {
    exportCashbookPDF({
      title, monthLabel: month, range,
      opening: Number(opening || 0), rows: cbRows(),
      totalIncome, totalExpense, closing,
    });
  }
  function exportXlsx() {
    exportCashbookExcel({
      title, monthLabel: month, range,
      opening: Number(opening || 0), rows: cbRows(),
      totalIncome, totalExpense, closing,
    });
  }

  const sub = submissions.find(s => s.stream === stream && `${s.year}-${String(s.month).padStart(2, "0")}` === month);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div><Label>{t("openingCash")}</Label><Input type="number" className="w-36" value={opening || ""} onChange={e => setOpening(+e.target.value)} disabled={locked} /></div>
          <div className="text-sm">
            <div>{t("income")}: <span className="font-semibold text-success">{money(totalIncome)}</span></div>
            <div>{t("expense")}: <span className="font-semibold text-destructive">{money(totalExpense)}</span></div>
            <div>{t("closing")}: <span className={`font-bold ${closing < 0 ? "due-text" : ""}`}>{money(closing)}</span></div>
          </div>
          <div className="flex items-center gap-2 self-center">
            <Switch id={`consol-${stream}`} checked={consolidated} onCheckedChange={setConsolidated} />
            <Label htmlFor={`consol-${stream}`} className="text-xs cursor-pointer">{tx("Consolidate income (receipt range)", "আয় একত্র (রশিদ রেঞ্জ)")}</Label>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
            <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("exportExcel")}</Button>
            {canSubmit && (
              locked
                ? <Badge variant="default" className="self-center gap-2">{tx("Submitted", "সাবমিট হয়েছে")}{isSuper && sub && <button className="underline text-[10px]" onClick={() => onUnlock(sub.id)}>unlock</button>}</Badge>
                : <Button size="sm" onClick={onSubmit}>{tx("Final submit", "ফাইনাল সাবমিট")}</Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>{tx("Voucher #", "ভাউচার নং")}</TableHead>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{tx("Head / Type", "খাত / ধরন")}</TableHead>
          <TableHead>{tx("Description", "বিবরণ")}</TableHead>
          <TableHead className="text-right">{t("income")}</TableHead>
          <TableHead className="text-right">{t("expense")}</TableHead>
          <TableHead className="text-right">{t("runningBalance")}</TableHead>
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          <TableRow className="bg-muted/40 font-medium">
            <TableCell>—</TableCell><TableCell>{mFrom}</TableCell>
            <TableCell colSpan={2}>{t("openingCashBalance")}</TableCell>
            <TableCell className="text-right">—</TableCell><TableCell className="text-right">—</TableCell>
            <TableCell className="text-right font-semibold">{money(opening)}</TableCell><TableCell></TableCell>
          </TableRow>
          {entries.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{row.ref}</TableCell>
              <TableCell>{fmtDate(row.date)}</TableCell>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.desc || row.raw?.payee || row.raw?.note || ""}{row.raw?.is_bank_deposit && <Badge variant="outline" className="ml-1">{tx("Bank", "ব্যাংক")}</Badge>}</TableCell>
              <TableCell className="text-right text-success">{row.kind === "income" ? money(row.amount) : "—"}</TableCell>
              <TableCell className="text-right text-destructive">{row.kind === "expense" ? money(row.amount) : "—"}</TableCell>
              <TableCell className={`text-right font-semibold ${row.balance < 0 ? "due-text" : ""}`}>{money(row.balance)}</TableCell>
              <TableCell className="text-right">
                {row.kind === "expense" && (
                  <div className="flex justify-end gap-1">
                    {row.raw?.attachment_path && <Button size="icon" variant="ghost" title={tx("Scan", "স্ক্যান")} onClick={() => onScan(row.raw.attachment_path)}><Paperclip className="h-4 w-4" /></Button>}
                    {(!locked || isSuper) && <Button size="icon" variant="ghost" title={t("edit")} onClick={() => onEdit(row.raw)}><Pencil className="h-4 w-4" /></Button>}
                    {(!locked || isSuper) && <Button size="icon" variant="ghost" title={t("delete")} onClick={() => onDelete(row.raw)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/60 font-bold">
            <TableCell colSpan={4} className="text-right">{t("closing")}</TableCell>
            <TableCell className="text-right text-success">{money(totalIncome)}</TableCell>
            <TableCell className="text-right text-destructive">{money(totalExpense)}</TableCell>
            <TableCell className={`text-right ${closing < 0 ? "due-text" : ""}`}>{money(closing)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
          {entries.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>

      {byHead.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-2">{tx("Expense by head", "খাত-ভিত্তিক ব্যয়")}</h4>
          <div className="grid gap-1 md:grid-cols-2">
            {byHead.map(([h, amt]) => (
              <div key={h} className="flex justify-between border-b py-1 text-sm">
                <span>{h}</span><span className="font-semibold text-destructive">{money(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ====================== Expense heads manager ======================
function ExpenseHeadsManager({ heads, canManage, officeId, reload }: { heads: any[]; canManage: boolean; officeId: string | null | undefined; reload: () => void }) {
  const { t, tx } = useLang();
  const [stream, setStream] = useState<Stream>("irrigation");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");

  const list = heads.filter(h => h.stream === stream);

  async function add() {
    if (!name.trim()) return toast.error(tx("Enter a head name", "খাতের নাম লিখুন"));
    const maxOrder = list.reduce((m, h) => Math.max(m, h.sort_order || 0), 0);
    const { error } = await sb.from("cashbook_expense_heads").insert({
      stream, name_bn: name.trim(), name_en: nameEn.trim() || null, office_id: officeId ?? null, sort_order: maxOrder + 1,
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setName(""); setNameEn(""); reload();
  }

  async function toggle(h: any) {
    const { error } = await sb.from("cashbook_expense_heads").update({ is_active: !h.is_active }).eq("id", h.id);
    if (error) return toast.error(error.message);
    reload();
  }

  async function remove(h: any) {
    if (!confirm(tx("Delete this head?", "এই খাত মুছবেন?"))) return;
    const { error } = await sb.from("cashbook_expense_heads").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); reload();
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={stream === "irrigation" ? "default" : "outline"} onClick={() => setStream("irrigation")}>{tx("Irrigation", "সেচ")}</Button>
        <Button size="sm" variant={stream === "savings" ? "default" : "outline"} onClick={() => setStream("savings")}>{tx("Savings", "সেভিং")}</Button>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2">
          <div><Label>{tx("Head (Bangla)", "খাত (বাংলা)")}</Label><Input value={name} onChange={e => setName(e.target.value)} className="w-48" /></div>
          <div><Label>{tx("Head (English)", "খাত (ইংরেজি)")}</Label><Input value={nameEn} onChange={e => setNameEn(e.target.value)} className="w-48" /></div>
          <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" />{tx("Add", "যোগ")}</Button>
        </div>
      )}

      <Table>
        <TableHeader><TableRow>
          <TableHead>{tx("Bangla", "বাংলা")}</TableHead><TableHead>{tx("English", "ইংরেজি")}</TableHead>
          <TableHead>{tx("Active", "সক্রিয়")}</TableHead>{canManage && <TableHead className="text-right">{t("actions")}</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {list.map(h => (
            <TableRow key={h.id}>
              <TableCell>{h.name_bn}</TableCell>
              <TableCell>{h.name_en || "—"}</TableCell>
              <TableCell><Switch checked={h.is_active} onCheckedChange={() => toggle(h)} disabled={!canManage} /></TableCell>
              {canManage && <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(h)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
            </TableRow>
          ))}
          {list.length === 0 && <TableRow><TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
