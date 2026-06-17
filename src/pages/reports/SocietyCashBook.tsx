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
  buildJamaRows, buildKharchRows, sumJama, sumKharch,
  type JamaRow, type KharchRow,
} from "@/lib/societyCashBook";
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
  return toBnDigits(`${d}/${m}/${y}`);
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
  return `${d}/${m}/${y}`;
}

export default function SocietyCashBook() {
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

  useEffect(() => { document.title = tx("Income-Expense Cash Book (Society)", "আয়-ব্যয় ক্যাশ বহি (সমিতি)"); }, [lang]);

  useEffect(() => {
    setLoading(true); setError(null);
    (async () => {
      try {
        let savQ = sb.from("savings_transactions").select("type,amount,txn_date,receipt_no,farmer_id,office_id,status,deleted_at").is("deleted_at", null).gte("txn_date", from).lte("txn_date", to);
        let lpQ = sb.from("loan_payments").select("amount,principal_amount,interest_amount,paid_on,receipt_no,loan_id,office_id,status").gte("paid_on", from).lte("paid_on", to);
        let btQ = sb.from("bank_transactions").select("txn_type,amount,txn_date,reference_no,office_id").gte("txn_date", from).lte("txn_date", to);
        let oiQ = sb.from("office_incomes").select("income_type,amount,received_on,receipt_no,payer_name,office_id,stream").eq("stream", "saving").gte("received_on", from).lte("received_on", to);
        let exQ = sb.from("expenses").select("head,amount,expense_date,voucher_no,payee,is_bank_deposit,office_id,stream,deleted_at").is("deleted_at", null).eq("stream", "savings").gte("expense_date", from).lte("expense_date", to);
        let lnQ = sb.from("loans").select("principal,issued_on,loan_no,farmer_id,office_id,status,deleted_at").is("deleted_at", null).gte("issued_on", from).lte("issued_on", to);
        if (officeId) {
          savQ = savQ.eq("office_id", officeId); lpQ = lpQ.eq("office_id", officeId); btQ = btQ.eq("office_id", officeId);
          oiQ = oiQ.eq("office_id", officeId); exQ = exQ.eq("office_id", officeId); lnQ = lnQ.eq("office_id", officeId);
        }
        const [sav, lp, bt, oi, ex, ln] = await Promise.all([savQ, lpQ, btQ, oiQ, exQ, lnQ]);
        const savRows = (sav.data ?? []);
        const lpRows = (lp.data ?? []).filter((r: any) => r.status === "approved");
        const lnRows = (ln.data ?? []).filter((r: any) => r.status !== "rejected");

        // Resolve farmer names (from savings + loans) and loan→farmer map.
        const farmerIds = new Set<string>();
        savRows.forEach((r: any) => r.farmer_id && farmerIds.add(r.farmer_id));
        lnRows.forEach((r: any) => r.farmer_id && farmerIds.add(r.farmer_id));
        const loanIds = lpRows.map((r: any) => r.loan_id).filter(Boolean);
        let loanFarmers: Record<string, string> = {};
        if (loanIds.length) {
          const { data: loanRows } = await sb.from("loans").select("id,farmer_id").in("id", loanIds);
          (loanRows ?? []).forEach((r: any) => { loanFarmers[r.id] = r.farmer_id; if (r.farmer_id) farmerIds.add(r.farmer_id); });
        }
        let farmerNames: Record<string, string> = {};
        if (farmerIds.size) {
          const { data: fr } = await sb.from("farmers").select("id,name_bn,name_en").in("id", Array.from(farmerIds));
          (fr ?? []).forEach((r: any) => { farmerNames[r.id] = lang === "bn" ? (r.name_bn || r.name_en || "") : (r.name_en || r.name_bn || ""); });
        }

        setInput({
          savings: savRows, loanPayments: lpRows, bankTx: bt.data ?? [],
          officeIncomes: oi.data ?? [], expenses: ex.data ?? [], loansIssued: lnRows,
          farmerNames, loanFarmers,
        });
      } catch (e: any) {
        setError(e?.message || tx("Could not load data", "তথ্য লোড করা যায়নি"));
        setInput(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, officeId, lang]);

  const jamaRows = useMemo<JamaRow[]>(() => (input ? buildJamaRows(input, lang) : []), [input, lang]);
  const kharchRows = useMemo<KharchRow[]>(() => (input ? buildKharchRows(input, lang) : []), [input, lang]);
  const jamaTot = useMemo(() => sumJama(jamaRows), [jamaRows]);
  const kharchTot = useMemo(() => sumKharch(kharchRows), [kharchRows]);
  const hasData = jamaRows.length + kharchRows.length > 0;
  const society = lang === "bn"
    ? (branding.company_name_bn || branding.company_name || "সমবায় সমিতি")
    : (branding.company_name || branding.company_name_bn || "Cooperative Society");
  const formatMoney = lang === "bn" ? bnMoney : enMoney;
  const formatDate = lang === "bn" ? bnDate : enDate;
  const formatText = (s: string) => lang === "bn" ? bnText(s) : s;

  const exportCsv = () => {
    downloadCsv(`${tx("society-cashbook-income", "সমিতি-ক্যাশবহি-জমা")}-${from}_${to}`, jamaRows, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.date },
      { header: tx("Receipt no", "রশিদ নং"), accessor: (r) => r.receiptNo },
      { header: tx("Name", "নাম"), accessor: (r) => r.name },
      { header: tx("Share", "শেয়ার"), accessor: (r) => r.share || "" },
      { header: tx("Savings", "সঞ্চয়"), accessor: (r) => r.savings || "" },
      { header: tx("Bank withdrawal", "ব্যাংক উত্তোলন"), accessor: (r) => r.bankWithdraw || "" },
      { header: tx("Loan collection", "কর্জ আদায়"), accessor: (r) => r.loanPrincipal || "" },
      { header: tx("Loan interest", "কর্জ সুদ"), accessor: (r) => r.loanInterest || "" },
      { header: tx("Form", "ফরম"), accessor: (r) => r.form || "" },
      { header: tx("Miscellaneous", "বিবিধ"), accessor: (r) => r.misc || "" },
      { header: tx("Total", "মোট"), accessor: (r) => r.total },
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Income-Expense Cash Book (Society)", "আয়-ব্যয় ক্যাশ বহি (সমিতি)")} description={tx("Transaction-based society income and expense cash book", "সমিতির জমা ও খরচের লেনদেন ভিত্তিক ক্যাশ বহি")} />

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
        <div className="text-center font-semibold text-sm mb-1">
          {society}
          <span className="ml-2 font-normal">{lang === "bn" ? toBnDigits(`${formatDate(from)} - ${formatDate(to)}`) : `${formatDate(from)} - ${formatDate(to)}`}</span>
        </div>
        <div className="bn-cb-cols grid grid-cols-2 gap-3 items-start">
        {/* জমা */}
        <section aria-label={tx("Income section", "জমা অংশ")}>
          <div className="text-center mb-1">
            <h2 className="text-lg font-bold">{tx("Income", "জমা")}</h2>
          </div>
          <table className="w-full border-collapse text-xs bn-cb-table" aria-label={tx("Income cash book", "জমা ক্যাশ বহি")}>
            <thead>
              <tr>
                {[tx("Date", "তারিখ"), tx("Receipt no", "রশিদ নং"), tx("Received from", "কাহার নিকট প্রাপ্ত"), tx("Share", "শেয়ার"), tx("Savings deposit", "সঞ্চয়ের আমানত"), tx("Bank withdrawal", "ব্যাংক উত্তোলন"), tx("Loan collection", "কর্জের আদায়"), tx("Loan interest collection", "কর্জের সুদ আদায়"), tx("Form", "ফরম"), tx("Miscellaneous", "বিবিধ"), tx("Total", "মোট")].map((h) => (
                  <th key={h} className="border border-black p-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jamaRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="border border-black p-1 text-center">{formatText(r.receiptNo)}</td>
                  <td className="border border-black p-1">{r.name}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.share)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.savings)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.bankWithdraw)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.loanPrincipal)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.loanInterest)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.form)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.misc)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.total)}</td>
                </tr>
              ))}
              {jamaRows.length === 0 && <tr><td colSpan={11} className="border border-black p-3 text-center">{tx("No data", "তথ্য নেই")}</td></tr>}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black p-1 text-right">{tx("Grand total=", "সর্বমোট=")}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.share)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.savings)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.bankWithdraw)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.loanPrincipal)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.loanInterest)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.form)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.misc)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(jamaTot.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* খরচ */}
        <section aria-label={tx("Expense section", "খরচ অংশ")}>
          <div className="text-center mb-1">
            <h2 className="text-lg font-bold">{tx("Expense", "খরচ")}</h2>
          </div>
          <table className="w-full border-collapse text-xs bn-cb-table" aria-label={tx("Expense cash book", "খরচ ক্যাশ বহি")}>
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black p-1">{tx("Date", "তারিখ")}</th>
                <th rowSpan={2} className="border border-black p-1">{tx("Voucher no", "ভাউচার নং")}</th>
                <th rowSpan={2} className="border border-black p-1">{tx("Paid to", "কাহাকে প্রদত্ত হইল")}</th>
                <th rowSpan={2} className="border border-black p-1">{tx("Deposit refund", "জমানত ফেরত")}</th>
                <th rowSpan={2} className="border border-black p-1">{tx("Bank deposit", "ব্যাংক জমা")}</th>
                <th colSpan={3} className="border border-black p-1 text-center">{tx("Purpose", "কি বাবদ")}</th>
                <th rowSpan={2} className="border border-black p-1">{tx("Total", "মোট")}</th>
              </tr>
              <tr>
                <th className="border border-black p-1">{tx("Loan disbursement", "ঋণ প্রদান")}</th>
                <th className="border border-black p-1">{tx("Salary allowance", "বেতন ভাতা")}</th>
                <th className="border border-black p-1">{tx("Miscellaneous", "বিবিধ")}</th>
              </tr>
            </thead>
            <tbody>
              {kharchRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="border border-black p-1 text-center">{formatText(r.voucherNo)}</td>
                  <td className="border border-black p-1">{r.name}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.depositReturn)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.bankDeposit)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.loanGiven)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.salary)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.misc)}</td>
                  <td className="border border-black p-1 text-right">{formatMoney(r.total)}</td>
                </tr>
              ))}
              {kharchRows.length === 0 && <tr><td colSpan={9} className="border border-black p-3 text-center">{tx("No data", "তথ্য নেই")}</td></tr>}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black p-1 text-right">{tx("Grand total=", "সর্বমোট=")}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.depositReturn)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.bankDeposit)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.loanGiven)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.salary)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.misc)}</td>
                <td className="border border-black p-1 text-right">{formatMoney(kharchTot.total)}</td>
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
          /* Two equal columns kept side-by-side and top-aligned on every page */
          .bn-cb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-items: start; }
          .bn-cb-cols > section { break-inside: auto; }
          /* Repeat header on each printed page and never split a row */
          .bn-cb-table { width: 100%; }
          .bn-cb-table thead { display: table-header-group; }
          .bn-cb-table tfoot { display: table-footer-group; }
          .bn-cb-table tr { page-break-inside: avoid; break-inside: avoid; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

    </div>
  );
}
