// i18n-ignore-file — fixed Bengali cash book (সমিতির আয়-ব্যয় ক্যাশ বহি)
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

export default function SocietyCashBook() {
  const branding = useBranding();
  const { officeId } = useAuth();

  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [input, setInput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "আয়-ব্যয় ক্যাশ বহি (সমিতি)"; }, []);

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
          (fr ?? []).forEach((r: any) => { farmerNames[r.id] = r.name_bn || r.name_en || ""; });
        }

        setInput({
          savings: savRows, loanPayments: lpRows, bankTx: bt.data ?? [],
          officeIncomes: oi.data ?? [], expenses: ex.data ?? [], loansIssued: lnRows,
          farmerNames, loanFarmers,
        });
      } catch (e: any) {
        setError(e?.message || "তথ্য লোড করা যায়নি");
        setInput(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, officeId]);

  const jamaRows = useMemo<JamaRow[]>(() => (input ? buildJamaRows(input) : []), [input]);
  const kharchRows = useMemo<KharchRow[]>(() => (input ? buildKharchRows(input) : []), [input]);
  const jamaTot = useMemo(() => sumJama(jamaRows), [jamaRows]);
  const kharchTot = useMemo(() => sumKharch(kharchRows), [kharchRows]);
  const hasData = jamaRows.length + kharchRows.length > 0;
  const society = branding.company_name_bn || branding.company_name || "সমবায় সমিতি";

  const exportCsv = () => {
    downloadCsv(`সমিতি-ক্যাশবহি-জমা-${from}_${to}`, jamaRows, [
      { header: "তারিখ", accessor: (r) => r.date },
      { header: "রশিদ নং", accessor: (r) => r.receiptNo },
      { header: "নাম", accessor: (r) => r.name },
      { header: "শেয়ার", accessor: (r) => r.share || "" },
      { header: "সঞ্চয়", accessor: (r) => r.savings || "" },
      { header: "ব্যাংক উত্তোলন", accessor: (r) => r.bankWithdraw || "" },
      { header: "কর্জ আদায়", accessor: (r) => r.loanPrincipal || "" },
      { header: "কর্জ সুদ", accessor: (r) => r.loanInterest || "" },
      { header: "ফরম", accessor: (r) => r.form || "" },
      { header: "বিবিধ", accessor: (r) => r.misc || "" },
      { header: "মোট", accessor: (r) => r.total },
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="আয়-ব্যয় ক্যাশ বহি (সমিতি)" description="সমিতির জমা ও খরচের লেনদেন ভিত্তিক ক্যাশ বহি" />

      <Card className="p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div><Label>শুরুর তারিখ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>শেষ তারিখ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading || !hasData}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> এক্সেল
          </Button>
          <Button onClick={() => window.print()} disabled={loading || !hasData}>
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
          </Button>
        </div>
        {loading && <span className="text-sm text-muted-foreground">লোড হচ্ছে…</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
        {!loading && !error && !hasData && <span className="text-sm text-destructive">এই সময়ে কোনো তথ্য নেই</span>}
      </Card>

      <div className="bn-cashbook bg-white text-black p-4 overflow-x-auto">
        <div className="text-center font-semibold text-sm mb-1">
          {society}
          <span className="ml-2 font-normal">{toBnDigits(`${bnDate(from)} - ${bnDate(to)}`)}</span>
        </div>
        <div className="bn-cb-cols grid grid-cols-2 gap-3 items-start">
        {/* জমা */}
        <section aria-label="জমা অংশ">
          <div className="text-center mb-1">
            <h2 className="text-lg font-bold">জমা</h2>
          </div>
          <table className="w-full border-collapse text-xs bn-cb-table" aria-label="জমা ক্যাশ বহি">
            <thead>
              <tr>
                {["তারিখ", "রশিদ নং", "কাহার নিকট প্রাপ্ত", "শেয়ার", "সঞ্চয়ের আমানত", "ব্যাংক উত্তোলন", "কর্জের আদায়", "কর্জের সুদ আদায়", "ফরম", "বিবিধ", "মোট"].map((h) => (
                  <th key={h} className="border border-black p-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jamaRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 whitespace-nowrap">{bnDate(r.date)}</td>
                  <td className="border border-black p-1 text-center">{bnText(r.receiptNo)}</td>
                  <td className="border border-black p-1">{r.name}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.share)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.savings)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.bankWithdraw)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.loanPrincipal)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.loanInterest)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.form)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.misc)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.total)}</td>
                </tr>
              ))}
              {jamaRows.length === 0 && <tr><td colSpan={11} className="border border-black p-3 text-center">তথ্য নেই</td></tr>}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black p-1 text-right">সর্বমোট=</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.share)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.savings)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.bankWithdraw)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.loanPrincipal)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.loanInterest)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.form)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.misc)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(jamaTot.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* খরচ */}
        <section aria-label="খরচ অংশ">
          <div className="text-center mb-1">
            <h2 className="text-lg font-bold">খরচ</h2>
          </div>
          <table className="w-full border-collapse text-xs bn-cb-table" aria-label="খরচ ক্যাশ বহি">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black p-1">তারিখ</th>
                <th rowSpan={2} className="border border-black p-1">ভাউচার নং</th>
                <th rowSpan={2} className="border border-black p-1">কাহাকে প্রদত্ত হইল</th>
                <th rowSpan={2} className="border border-black p-1">জমানত ফেরত</th>
                <th rowSpan={2} className="border border-black p-1">ব্যাংক জমা</th>
                <th colSpan={3} className="border border-black p-1 text-center">কি বাবদ</th>
                <th rowSpan={2} className="border border-black p-1">মোট</th>
              </tr>
              <tr>
                <th className="border border-black p-1">ঋণ প্রদান</th>
                <th className="border border-black p-1">বেতন ভাতা</th>
                <th className="border border-black p-1">বিবিধ</th>
              </tr>
            </thead>
            <tbody>
              {kharchRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 whitespace-nowrap">{bnDate(r.date)}</td>
                  <td className="border border-black p-1 text-center">{bnText(r.voucherNo)}</td>
                  <td className="border border-black p-1">{r.name}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.depositReturn)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.bankDeposit)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.loanGiven)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.salary)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.misc)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(r.total)}</td>
                </tr>
              ))}
              {kharchRows.length === 0 && <tr><td colSpan={9} className="border border-black p-3 text-center">তথ্য নেই</td></tr>}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black p-1 text-right">সর্বমোট=</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.depositReturn)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.bankDeposit)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.loanGiven)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.salary)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.misc)}</td>
                <td className="border border-black p-1 text-right">{bnMoney(kharchTot.total)}</td>
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
