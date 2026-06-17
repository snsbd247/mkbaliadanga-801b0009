import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileSpreadsheet, FileDown, Languages, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { useBranding } from "@/lib/branding";
import { toBnDigits } from "@/lib/bnNumber";
import { downloadCsv } from "@/lib/csvExport";
import {
  buildIrrJamaRows, buildIrrKharchRows, sumIrrJama, sumIrrKharch,
  buildJamaExportMatrix, buildKharchExportMatrix, resolveEffectiveOffice,
  type IrrJamaRow, type IrrKharchRow,
} from "@/lib/irrigationCashBook";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";

const sb = supabase as any;

function bnMoney(nv: number): string {
  if (!nv) return "";
  const fixed = Number(nv || 0).toFixed(2).replace(/\.00$/, "");
  const [intPart, dec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return toBnDigits(dec ? `${grouped}.${dec}` : grouped);
}
function bnDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return toBnDigits(`${d}.${m}.${y}`);
}
function bnText(s: string): string {
  return /^[0-9-]+$/.test(s) ? toBnDigits(s) : s;
}
function enMoney(nv: number): string {
  if (!nv) return "";
  return Number(nv || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function enDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

type DetailState = {
  title: string;
  rows: { date: string; ref: string; name: string; amount: number }[];
  total: number;
} | null;

type Preset = { id: string; name: string; from: string; to: string; officeFilter: string };

export default function IrrigationCashBook() {
  const branding = useBranding();
  const { officeId, isAdmin, user } = useAuth();
  const { lang, tx } = useLang();
  // Per-report language override — switches display only, never the data mapping.
  const [reportLang, setReportLang] = useState<"bn" | "en">(lang === "en" ? "en" : "bn");
  const rlang = reportLang;
  const rt = (en: string, bn: string) => (rlang === "bn" ? bn : en);

  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [input, setInput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);
  const [presets, setPresets] = useState<Preset[]>([]);

  // The effective office: scoped users are locked to theirs; non-scoped admins may pick.
  const effectiveOffice = resolveEffectiveOffice(officeId, isAdmin, officeFilter);

  useEffect(() => { document.title = tx("Irrigation Income-Expense Cash Book", "সেচ আয়-ব্যয় ক্যাশ বহি"); }, [lang]);

  useEffect(() => {
    if (officeId || !isAdmin) return;
    sb.from("offices").select("id,name").order("name").then(({ data }: any) => setOffices(data ?? []));
  }, [officeId, isAdmin]);

  useEffect(() => {
    setLoading(true); setError(null);
    (async () => {
      try {
        let payQ = sb.from("payments")
          .select("kind,amount,created_at,receipt_no,farmer_id,office_id,status,deleted_at,voided_at")
          .eq("kind", "irrigation").gte("created_at", from).lte("created_at", `${to}T23:59:59`);
        let oiQ = sb.from("office_incomes")
          .select("income_type,amount,received_on,receipt_no,payer_name,office_id,stream")
          .eq("stream", "sech").gte("received_on", from).lte("received_on", to);
        let btQ = sb.from("bank_transactions")
          .select("txn_type,amount,txn_date,reference_no,office_id")
          .gte("txn_date", from).lte("txn_date", to);
        let exQ = sb.from("expenses")
          .select("head,amount,expense_date,voucher_no,payee,is_bank_deposit,office_id,stream,deleted_at")
          .is("deleted_at", null).eq("stream", "irrigation")
          .gte("expense_date", from).lte("expense_date", to);
        if (effectiveOffice) {
          payQ = payQ.eq("office_id", effectiveOffice); oiQ = oiQ.eq("office_id", effectiveOffice);
          btQ = btQ.eq("office_id", effectiveOffice); exQ = exQ.eq("office_id", effectiveOffice);
        }
        const [pay, oi, bt, ex] = await Promise.all([payQ, oiQ, btQ, exQ]);
        const payRows = (pay.data ?? []).filter((p: any) => !p.deleted_at && !p.voided_at && p.status !== "rejected");

        const farmerIds = new Set<string>();
        payRows.forEach((r: any) => r.farmer_id && farmerIds.add(r.farmer_id));
        let farmerNames: Record<string, string> = {};
        if (farmerIds.size) {
          const { data: fr } = await sb.from("farmers").select("id,name_bn,name_en").in("id", Array.from(farmerIds));
          (fr ?? []).forEach((r: any) => { farmerNames[r.id] = lang === "bn" ? (r.name_bn || r.name_en || "") : (r.name_en || r.name_bn || ""); });
        }

        setInput({ payments: payRows, officeIncomes: oi.data ?? [], bankTx: bt.data ?? [], expenses: ex.data ?? [], farmerNames });
      } catch (e: any) {
        setError(e?.message || tx("Could not load data", "তথ্য লোড করা যায়নি"));
        setInput(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, effectiveOffice, lang]);

  const jamaRows = useMemo<IrrJamaRow[]>(() => (input ? buildIrrJamaRows(input, lang) : []), [input, lang]);
  const kharchRows = useMemo<IrrKharchRow[]>(() => (input ? buildIrrKharchRows(input, lang) : []), [input, lang]);
  const jamaTot = useMemo(() => sumIrrJama(jamaRows), [jamaRows]);
  const kharchTot = useMemo(() => sumIrrKharch(kharchRows), [kharchRows]);
  const hasData = jamaRows.length + kharchRows.length > 0;

  const project = rlang === "bn"
    ? (branding.company_name_bn || branding.company_name || "সেচ প্রকল্প")
    : (branding.company_name || branding.company_name_bn || "Irrigation Project");
  const formatMoney = rlang === "bn" ? bnMoney : enMoney;
  const formatDate = rlang === "bn" ? bnDate : enDate;
  const formatText = (s: string) => (rlang === "bn" ? bnText(s) : s);

  // Column definitions (key + label) drive both rendering and the drill-down modal.
  const JAMA_COLS: { key: keyof IrrJamaRow; label: string }[] = [
    { key: "sechCharge", label: rt("Irrigation charge", "সেচ চার্জ") },
    { key: "nalaCharge", label: rt("Canal charge", "নালা চার্জ") },
    { key: "maintenance", label: rt("Maintenance", "রক্ষণাবেক্ষণ") },
    { key: "lateFee", label: rt("Late fee", "বিলম্ব ফি") },
    { key: "bankWithdraw", label: rt("Bank withdrawal", "ব্যাংকে উত্তোলন") },
    { key: "pond", label: rt("Pond", "পুকুর") },
    { key: "misc", label: rt("Miscellaneous", "বিবিধ") },
  ];
  const KHARCH_COLS: { key: keyof IrrKharchRow; label: string }[] = [
    { key: "labor", label: rt("Labor", "শ্রমিক") },
    { key: "partsBuy", label: rt("Parts purchase", "যন্ত্রাংশ ক্রয়") },
    { key: "partsRepair", label: rt("Parts repair", "যন্ত্রাংশ মেরামত") },
    { key: "transport", label: rt("Transport", "যাতায়াত") },
    { key: "hospitality", label: rt("Hospitality", "আপ্যায়ন") },
    { key: "publicity", label: rt("Publicity", "প্রচার") },
    { key: "salary", label: rt("Salary & allowance", "বেতন ও ভাতা") },
    { key: "electricity", label: rt("Electricity bill", "বিদ্যুৎ বিল") },
    { key: "stationery", label: rt("Stationery", "স্টেশনারি") },
    { key: "officeRent", label: rt("Office rent", "অফিস ভাড়া") },
    { key: "motor", label: rt("Motor rent", "মোটর বাঁধা") },
    { key: "bankDeposit", label: rt("Bank deposit", "ব্যাংক জমা") },
    { key: "misc", label: rt("Miscellaneous", "বিবিধ") },
  ];

  const showJamaDetail = (key: keyof IrrJamaRow, label: string) => {
    const rows = jamaRows.filter((r) => Number(r[key]) > 0)
      .map((r) => ({ date: r.date, ref: r.receiptNo, name: r.name, amount: Number(r[key]) }));
    setDetail({ title: label, rows, total: rows.reduce((a, r) => a + r.amount, 0) });
  };
  const showKharchDetail = (key: keyof IrrKharchRow, label: string) => {
    const rows = kharchRows.filter((r) => Number(r[key]) > 0)
      .map((r) => ({ date: r.date, ref: r.voucherNo, name: r.name, amount: Number(r[key]) }));
    setDetail({ title: label, rows, total: rows.reduce((a, r) => a + r.amount, 0) });
  };

  const fileBase = `${rt("irrigation-cashbook", "সেচ-আয়-ব্যয়-ক্যাশবহি")}-${from}_${to}`;

  const jamaLabels = () => ({
    date: rt("Date", "তারিখ"), receiptNo: rt("Receipt no", "রশিদ নং"),
    receivedFrom: rt("Received from", "কাহার নিকট হতে"), total: rt("Total", "মোট"),
    grandTotal: rt("Grand total", "সর্বমোট"), cols: JAMA_COLS.map((c) => c.label),
  });
  const kharchLabels = () => ({
    date: rt("Date", "তারিখ"), voucherNo: rt("Voucher no", "ভাউচার নং"),
    purpose: rt("Purpose of expense", "কি বাবদ খরচ"), total: rt("Total", "মোট"),
    grandTotal: rt("Grand total", "সর্বমোট"), cols: KHARCH_COLS.map((c) => c.label),
  });

  // Record each download for auditing (best-effort — never blocks the download).
  const logExport = async (format: "XLSX" | "CSV" | "PDF") => {
    if (!user?.id) return;
    try {
      await sb.from("irrigation_cashbook_export_audit").insert({
        user_id: user.id, office_id: effectiveOffice, date_from: from, date_to: to, format,
      });
    } catch { /* auditing is best-effort */ }
  };

  const runExport = async (format: "XLSX" | "CSV", fn: () => void) => {
    if (exporting) return;
    setExporting(true);
    const tid = toast.loading(rt(`Generating ${format}…`, `${format} তৈরি হচ্ছে…`));
    try {
      fn();
      await logExport(format);
      toast.success(rt(`${format} downloaded`, `${format} ডাউনলোড হয়েছে`), { id: tid });
    } catch (e: any) {
      toast.error(e?.message || rt("Export failed", "এক্সপোর্ট ব্যর্থ হয়েছে"), { id: tid });
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => runExport("CSV", () => {
    downloadCsv(fileBase, jamaRows, [
      { header: rt("Date", "তারিখ"), accessor: (r) => r.date },
      { header: rt("Receipt no", "রশিদ নং"), accessor: (r) => r.receiptNo },
      { header: rt("Received from", "কাহার নিকট হতে"), accessor: (r) => r.name },
      ...JAMA_COLS.map((c) => ({ header: c.label, accessor: (r: IrrJamaRow) => Number(r[c.key]) || "" })),
      { header: rt("Total", "মোট"), accessor: (r) => r.total },
    ]);
  });

  const exportExcel = () => runExport("XLSX", () => {
    const wb = XLSX.utils.book_new();
    const meta = [[project], [`${formatDate(from)} - ${formatDate(to)}`], []];
    const wsJama = XLSX.utils.aoa_to_sheet([...meta, ...buildJamaExportMatrix(jamaRows, jamaTot, jamaLabels())]);
    const wsKharch = XLSX.utils.aoa_to_sheet([...meta, ...buildKharchExportMatrix(kharchRows, kharchTot, kharchLabels())]);
    XLSX.utils.book_append_sheet(wb, wsJama, rt("Income", "জমা"));
    XLSX.utils.book_append_sheet(wb, wsKharch, rt("Expense", "খরচ"));
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  });

  const handlePrint = () => { logExport("PDF"); window.print(); };

  const loadPresets = async () => {
    if (!user?.id) return;
    const { data } = await sb.from("irrigation_cashbook_presets")
      .select("id,name,date_from,date_to,office_filter")
      .eq("user_id", user.id).order("name");
    setPresets((data ?? []).map((p: any) => ({
      id: p.id, name: p.name, from: p.date_from, to: p.date_to, officeFilter: p.office_filter,
    })));
  };

  useEffect(() => { loadPresets(); }, [user?.id]);

  const savePreset = async () => {
    if (!user?.id) return;
    const name = window.prompt(rt("Preset name", "প্রিসেটের নাম"));
    if (!name) return;
    const { error: upErr } = await sb.from("irrigation_cashbook_presets").upsert({
      user_id: user.id, name, date_from: from, date_to: to, office_filter: officeFilter,
    }, { onConflict: "user_id,name" });
    if (upErr) { toast.error(upErr.message); return; }
    await loadPresets();
    toast.success(rt("Preset saved", "প্রিসেট সংরক্ষিত হয়েছে"));
  };
  const applyPreset = (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    setFrom(p.from); setTo(p.to); setOfficeFilter(p.officeFilter);
  };
  const deletePreset = async (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    await sb.from("irrigation_cashbook_presets").delete().eq("id", p.id);
    await loadPresets();
  };



  return (
    <div className="space-y-4">
      <PageHeader title={tx("Irrigation Income-Expense Cash Book", "সেচ আয়-ব্যয় ক্যাশ বহি")} description={tx("Two-page income (জমা) and expense (খরচ) cash book for the irrigation stream", "সেচ খাতের জমা ও খরচের দুই পৃষ্ঠার ক্যাশ বহি")} />

      <Card className="p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div><Label>{tx("Start date", "শুরুর তারিখ")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("End date", "শেষ তারিখ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {!officeId && isAdmin && (
          <div>
            <Label>{tx("Office", "অফিস")}</Label>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setReportLang((p) => (p === "bn" ? "en" : "bn"))}>
            <Languages className="h-4 w-4 mr-1" /> {reportLang === "bn" ? "English" : "বাংলা"}
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={loading || exporting || !hasData}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={loading || exporting || !hasData}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={handlePrint} disabled={loading || exporting || !hasData}>
            <Printer className="h-4 w-4 mr-1" /> {tx("Print", "প্রিন্ট")}
          </Button>
        </div>

        {/* Saved filter presets (date range + office) */}
        <div className="basis-full flex flex-wrap items-end gap-2">
          <div>
            <Label>{tx("Presets", "প্রিসেট")}</Label>
            <Select value="" onValueChange={applyPreset}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder={tx("Apply a preset", "প্রিসেট প্রয়োগ করুন")} /></SelectTrigger>
              <SelectContent>
                {presets.length === 0 && <SelectItem value="__none" disabled>{tx("No presets saved", "কোনো প্রিসেট নেই")}</SelectItem>}
                {presets.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={savePreset}>{tx("Save current", "বর্তমান সংরক্ষণ")}</Button>
          {presets.map((p) => (
            <button key={p.name} type="button" onClick={() => deletePreset(p.name)}
              className="text-xs text-destructive underline">
              {tx("Delete", "মুছুন")} “{p.name}”
            </button>
          ))}
        </div>

        {(loading || exporting) && <span className="text-sm text-muted-foreground">{exporting ? tx("Generating file…", "ফাইল তৈরি হচ্ছে…") : tx("Loading…", "লোড হচ্ছে…")}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
        {!loading && !error && !hasData && <span className="text-sm text-destructive">{tx("No data in this period", "এই সময়ে কোনো তথ্য নেই")}</span>}
        {!loading && hasData && <span className="text-xs text-muted-foreground basis-full">{tx("Tip: click any total to see the underlying transactions.", "টিপস: যেকোনো মোট-এ ক্লিক করে অন্তর্নিহিত লেনদেন দেখুন।")}</span>}
      </Card>

      <div className="bn-cashbook bg-white text-black p-4 overflow-x-auto">
        <div className="bn-cb-header text-center font-bold text-base mb-1">
          {project}
          <span className="ml-2 font-normal text-sm">
            {rlang === "bn" ? toBnDigits(`${formatDate(from)} - ${formatDate(to)}`) : `${formatDate(from)} - ${formatDate(to)}`}
          </span>
        </div>

        <div className="bn-cb-cols grid grid-cols-2 gap-3 items-start">
          {/* জমা */}
          <section aria-label={rt("Income section", "জমা অংশ")}>
            <div className="text-center mb-1"><h2 className="text-base font-bold">{rt("Income", "জমা")}</h2></div>
            <table className="w-full border-collapse text-[10px] bn-cb-table" aria-label={rt("Income cash book", "জমা ক্যাশ বহি")}>
              <thead>
                <tr>
                  <th className="border border-black p-0.5">{rt("Date", "তারিখ")}</th>
                  <th className="border border-black p-0.5">{rt("Receipt no", "রশিদ নং")}</th>
                  <th className="border border-black p-0.5">{rt("Received from", "কাহার নিকট হতে")}</th>
                  {JAMA_COLS.map((c) => <th key={c.key} className="border border-black p-0.5">{c.label}</th>)}
                  <th className="border border-black p-0.5">{rt("Total", "মোট")}</th>
                </tr>
              </thead>
              <tbody>
                {jamaRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black p-0.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="border border-black p-0.5 text-center">{formatText(r.receiptNo)}</td>
                    <td className="border border-black p-0.5">{r.name}</td>
                    {JAMA_COLS.map((c) => <td key={c.key} className="border border-black p-0.5 text-right">{formatMoney(Number(r[c.key]))}</td>)}
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.total)}</td>
                  </tr>
                ))}
                {jamaRows.length === 0 && <tr><td colSpan={11} className="border border-black p-3 text-center">{rt("No data", "তথ্য নেই")}</td></tr>}
                <tr className="font-bold">
                  <td colSpan={3} className="border border-black p-0.5 text-right">{rt("Grand total=", "সর্বমোট=")}</td>
                  {JAMA_COLS.map((c) => (
                    <td key={c.key} className="border border-black p-0.5 text-right cursor-pointer hover:bg-yellow-100 print:cursor-auto" onClick={() => showJamaDetail(c.key, c.label)}>{formatMoney(Number(jamaTot[c.key]))}</td>
                  ))}
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* খরচ */}
          <section aria-label={rt("Expense section", "খরচ অংশ")}>
            <div className="text-center mb-1"><h2 className="text-base font-bold">{rt("Expense", "খরচ")}</h2></div>
            <table className="w-full border-collapse text-[10px] bn-cb-table" aria-label={rt("Expense cash book", "খরচ ক্যাশ বহি")}>
              <thead>
                <tr>
                  <th className="border border-black p-0.5">{rt("Date", "তারিখ")}</th>
                  <th className="border border-black p-0.5">{rt("Voucher no", "ভাউচার নং")}</th>
                  <th className="border border-black p-0.5">{rt("Purpose of expense", "কি বাবদ খরচ")}</th>
                  {KHARCH_COLS.map((c) => <th key={c.key} className="border border-black p-0.5">{c.label}</th>)}
                  <th className="border border-black p-0.5">{rt("Total", "মোট")}</th>
                </tr>
              </thead>
              <tbody>
                {kharchRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black p-0.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="border border-black p-0.5 text-center">{formatText(r.voucherNo)}</td>
                    <td className="border border-black p-0.5">{r.name}</td>
                    {KHARCH_COLS.map((c) => <td key={c.key} className="border border-black p-0.5 text-right">{formatMoney(Number(r[c.key]))}</td>)}
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.total)}</td>
                  </tr>
                ))}
                {kharchRows.length === 0 && <tr><td colSpan={17} className="border border-black p-3 text-center">{rt("No data", "তথ্য নেই")}</td></tr>}
                <tr className="font-bold">
                  <td colSpan={3} className="border border-black p-0.5 text-right">{rt("Grand total=", "সর্বমোট=")}</td>
                  {KHARCH_COLS.map((c) => (
                    <td key={c.key} className="border border-black p-0.5 text-right cursor-pointer hover:bg-yellow-100 print:cursor-auto" onClick={() => showKharchDetail(c.key, c.label)}>{formatMoney(Number(kharchTot[c.key]))}</td>
                  ))}
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <div className="bn-cb-footer hidden print:flex justify-between text-[10px] mt-2 pt-1 border-t border-black">
          <span>{rt("Total income", "মোট জমা")}: {formatMoney(jamaTot.total)}</span>
          <span>{rt("Total expense", "মোট খরচ")}: {formatMoney(kharchTot.total)}</span>
          <span>{rt("Balance", "জের")}: {formatMoney(jamaTot.total - kharchTot.total)}</span>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.title} — {rt("transactions", "লেনদেন")}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">{rt("Date", "তারিখ")}</th>
                  <th className="text-left p-1">{rt("Ref", "নং")}</th>
                  <th className="text-left p-1">{rt("Name", "নাম")}</th>
                  <th className="text-right p-1">{rt("Amount", "টাকা")}</th>
                </tr>
              </thead>
              <tbody>
                {detail?.rows.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-1 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="p-1">{formatText(r.ref)}</td>
                    <td className="p-1">{r.name}</td>
                    <td className="p-1 text-right">{formatMoney(r.amount)}</td>
                  </tr>
                ))}
                {detail && detail.rows.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">{rt("No transactions", "কোনো লেনদেন নেই")}</td></tr>}
              </tbody>
              {detail && detail.rows.length > 0 && (
                <tfoot>
                  <tr className="font-bold border-t">
                    <td colSpan={3} className="p-1 text-right">{rt("Total", "মোট")}</td>
                    <td className="p-1 text-right">{formatMoney(detail.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .bn-cb-table th, .bn-cb-table td { word-wrap: break-word; overflow-wrap: anywhere; }
        .bn-cb-table { table-layout: fixed; }
        @media print {
          body * { visibility: hidden; }
          .bn-cashbook, .bn-cashbook * { visibility: visible; }
          .bn-cashbook { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .bn-cb-header { display: block; }
          .bn-cb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-items: start; }
          .bn-cb-cols > section { break-inside: auto; }
          .bn-cb-table { width: 100%; }
          .bn-cb-table thead { display: table-header-group; }
          .bn-cb-table tfoot { display: table-footer-group; }
          .bn-cb-table tr { page-break-inside: avoid; break-inside: avoid; }
          .bn-cb-table td, .bn-cb-table th { border: 1px solid #000 !important; }
          .bn-cb-footer { position: fixed; bottom: 0; left: 0; right: 0; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}
