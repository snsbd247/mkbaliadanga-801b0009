import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { toBnDigits } from "@/lib/bnNumber";
import { downloadCsv } from "@/lib/csvExport";
import {
  buildIrrJamaRows, buildIrrKharchRows, sumIrrJama, sumIrrKharch,
  type IrrJamaRow, type IrrKharchRow,
} from "@/lib/irrigationCashBook";
import { useLang } from "@/i18n/LanguageProvider";

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

export default function IrrigationCashBook() {
  const branding = useBranding();
  const { officeId } = useAuth();
  const { lang, tx } = useLang();

  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [input, setInput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = tx("Irrigation Income-Expense Cash Book", "সেচ আয়-ব্যয় ক্যাশ বহি"); }, [lang]);

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
        if (officeId) {
          payQ = payQ.eq("office_id", officeId); oiQ = oiQ.eq("office_id", officeId);
          btQ = btQ.eq("office_id", officeId); exQ = exQ.eq("office_id", officeId);
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
  }, [from, to, officeId, lang]);

  const jamaRows = useMemo<IrrJamaRow[]>(() => (input ? buildIrrJamaRows(input, lang) : []), [input, lang]);
  const kharchRows = useMemo<IrrKharchRow[]>(() => (input ? buildIrrKharchRows(input, lang) : []), [input, lang]);
  const jamaTot = useMemo(() => sumIrrJama(jamaRows), [jamaRows]);
  const kharchTot = useMemo(() => sumIrrKharch(kharchRows), [kharchRows]);
  const hasData = jamaRows.length + kharchRows.length > 0;

  const project = lang === "bn"
    ? (branding.company_name_bn || branding.company_name || "সেচ প্রকল্প")
    : (branding.company_name || branding.company_name_bn || "Irrigation Project");
  const formatMoney = lang === "bn" ? bnMoney : enMoney;
  const formatDate = lang === "bn" ? bnDate : enDate;
  const formatText = (s: string) => (lang === "bn" ? bnText(s) : s);

  const JAMA_COLS = [
    tx("Date", "তারিখ"), tx("Receipt no", "রশিদ নং"), tx("Received from", "কাহার নিকট হতে"),
    tx("Irrigation charge", "সেচ চার্জ"), tx("Canal charge", "নালা চার্জ"), tx("Maintenance", "রক্ষণাবেক্ষণ"),
    tx("Late fee", "বিলম্ব ফি"), tx("Bank withdrawal", "ব্যাংকে উত্তোলন"), tx("Pond", "পুকুর"),
    tx("Miscellaneous", "বিবিধ"), tx("Total", "মোট"),
  ];
  const KHARCH_COLS = [
    tx("Date", "তারিখ"), tx("Voucher no", "ভাউচার নং"), tx("Purpose of expense", "কি বাবদ খরচ"),
    tx("Labor", "শ্রমিক"), tx("Parts purchase", "যন্ত্রাংশ ক্রয়"), tx("Parts repair", "যন্ত্রাংশ মেরামত"),
    tx("Transport", "যাতায়াত"), tx("Hospitality", "আপ্যায়ন"), tx("Publicity", "প্রচার"),
    tx("Salary & allowance", "বেতন ও ভাতা"), tx("Electricity bill", "বিদ্যুৎ বিল"), tx("Stationery", "স্টেশনারি"),
    tx("Office rent", "অফিস ভাড়া"), tx("Motor rent", "মোটর বাঁধা"), tx("Bank deposit", "ব্যাংক জমা"),
    tx("Miscellaneous", "বিবিধ"), tx("Total", "মোট"),
  ];

  const exportCsv = () => {
    downloadCsv(`${tx("irrigation-cashbook", "সেচ-আয়-ব্যয়-ক্যাশবহি")}-${from}_${to}`, jamaRows, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.date },
      { header: tx("Receipt no", "রশিদ নং"), accessor: (r) => r.receiptNo },
      { header: tx("Received from", "কাহার নিকট হতে"), accessor: (r) => r.name },
      { header: tx("Irrigation charge", "সেচ চার্জ"), accessor: (r) => r.sechCharge || "" },
      { header: tx("Canal charge", "নালা চার্জ"), accessor: (r) => r.nalaCharge || "" },
      { header: tx("Maintenance", "রক্ষণাবেক্ষণ"), accessor: (r) => r.maintenance || "" },
      { header: tx("Late fee", "বিলম্ব ফি"), accessor: (r) => r.lateFee || "" },
      { header: tx("Bank withdrawal", "ব্যাংকে উত্তোলন"), accessor: (r) => r.bankWithdraw || "" },
      { header: tx("Pond", "পুকুর"), accessor: (r) => r.pond || "" },
      { header: tx("Miscellaneous", "বিবিধ"), accessor: (r) => r.misc || "" },
      { header: tx("Total", "মোট"), accessor: (r) => r.total },
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Irrigation Income-Expense Cash Book", "সেচ আয়-ব্যয় ক্যাশ বহি")} description={tx("Two-page income (জমা) and expense (খরচ) cash book for the irrigation stream", "সেচ খাতের জমা ও খরচের দুই পৃষ্ঠার ক্যাশ বহি")} />

      <Card className="p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div><Label>{tx("Start date", "শুরুর তারিখ")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("End date", "শেষ তারিখ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading || !hasData}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button onClick={() => window.print()} disabled={loading || !hasData}>
            <Printer className="h-4 w-4 mr-1" /> {tx("Print", "প্রিন্ট")}
          </Button>
        </div>
        {loading && <span className="text-sm text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
        {!loading && !error && !hasData && <span className="text-sm text-destructive">{tx("No data in this period", "এই সময়ে কোনো তথ্য নেই")}</span>}
      </Card>

      <div className="bn-cashbook bg-white text-black p-4 overflow-x-auto">
        <div className="text-center font-bold text-base mb-1">
          {project}
          <span className="ml-2 font-normal text-sm">
            {lang === "bn" ? toBnDigits(`${formatDate(from)} - ${formatDate(to)}`) : `${formatDate(from)} - ${formatDate(to)}`}
          </span>
        </div>

        <div className="bn-cb-cols grid grid-cols-2 gap-3 items-start">
          {/* জমা */}
          <section aria-label={tx("Income section", "জমা অংশ")}>
            <div className="text-center mb-1"><h2 className="text-base font-bold">{tx("Income", "জমা")}</h2></div>
            <table className="w-full border-collapse text-[10px] bn-cb-table" aria-label={tx("Income cash book", "জমা ক্যাশ বহি")}>
              <thead>
                <tr>{JAMA_COLS.map((h) => <th key={h} className="border border-black p-0.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jamaRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black p-0.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="border border-black p-0.5 text-center">{formatText(r.receiptNo)}</td>
                    <td className="border border-black p-0.5">{r.name}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.sechCharge)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.nalaCharge)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.maintenance)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.lateFee)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.bankWithdraw)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.pond)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.misc)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.total)}</td>
                  </tr>
                ))}
                {jamaRows.length === 0 && <tr><td colSpan={11} className="border border-black p-3 text-center">{tx("No data", "তথ্য নেই")}</td></tr>}
                <tr className="font-bold">
                  <td colSpan={3} className="border border-black p-0.5 text-right">{tx("Grand total=", "সর্বমোট=")}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.sechCharge)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.nalaCharge)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.maintenance)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.lateFee)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.bankWithdraw)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.pond)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.misc)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(jamaTot.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* খরচ */}
          <section aria-label={tx("Expense section", "খরচ অংশ")}>
            <div className="text-center mb-1"><h2 className="text-base font-bold">{tx("Expense", "খরচ")}</h2></div>
            <table className="w-full border-collapse text-[10px] bn-cb-table" aria-label={tx("Expense cash book", "খরচ ক্যাশ বহি")}>
              <thead>
                <tr>{KHARCH_COLS.map((h) => <th key={h} className="border border-black p-0.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {kharchRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black p-0.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="border border-black p-0.5 text-center">{formatText(r.voucherNo)}</td>
                    <td className="border border-black p-0.5">{r.name}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.labor)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.partsBuy)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.partsRepair)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.transport)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.hospitality)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.publicity)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.salary)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.electricity)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.stationery)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.officeRent)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.motor)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.bankDeposit)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.misc)}</td>
                    <td className="border border-black p-0.5 text-right">{formatMoney(r.total)}</td>
                  </tr>
                ))}
                {kharchRows.length === 0 && <tr><td colSpan={17} className="border border-black p-3 text-center">{tx("No data", "তথ্য নেই")}</td></tr>}
                <tr className="font-bold">
                  <td colSpan={3} className="border border-black p-0.5 text-right">{tx("Grand total=", "সর্বমোট=")}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.labor)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.partsBuy)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.partsRepair)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.transport)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.hospitality)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.publicity)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.salary)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.electricity)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.stationery)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.officeRent)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.motor)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.bankDeposit)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.misc)}</td>
                  <td className="border border-black p-0.5 text-right">{formatMoney(kharchTot.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <style>{`
        .bn-cb-table th, .bn-cb-table td { word-wrap: break-word; overflow-wrap: anywhere; }
        .bn-cb-table { table-layout: fixed; }
        @media print {
          body * { visibility: hidden; }
          .bn-cashbook, .bn-cashbook * { visibility: visible; }
          .bn-cashbook { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .bn-cb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-items: start; }
          .bn-cb-cols > section { break-inside: auto; }
          .bn-cb-table { width: 100%; }
          .bn-cb-table thead { display: table-header-group; }
          .bn-cb-table tr { page-break-inside: avoid; break-inside: avoid; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}
