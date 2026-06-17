// i18n-ignore-file — fixed Bengali audit statement (সমিতির জমা খরচ হিসাব)
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
import { computeSocietyStatement, computeBankSummary, incomeDrillDownUrl, expenseDrillDownUrl, incomingDrillDownUrl, type Line } from "@/lib/societyCashStatement";
import { Link } from "react-router-dom";

const sb = supabase as any;

function bnMoney(n: number): string {
  const fixed = Number(n || 0).toFixed(2);
  const [intPart, dec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return toBnDigits(`${grouped}.${dec}`);
}

function bnDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return toBnDigits(`${d}.${m}.${y}`);
}

export default function SocietyCashStatement() {
  const branding = useBranding();
  const { officeId } = useAuth();

  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [opening, setOpening] = useState<number>(0);
  const [data, setData] = useState<any>({ savings: [], loanPayments: [], bankTx: [], officeIncomes: [], expenses: [], loansIssued: [], bankAccounts: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "জমা খরচ হিসাব (সমিতি)"; }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const toEnd = `${to}T23:59:59`;
      let savQ = sb.from("savings_transactions").select("type,amount,txn_date,office_id,status,deleted_at").is("deleted_at", null).gte("txn_date", from).lte("txn_date", to);
      let lpQ = sb.from("loan_payments").select("amount,paid_on,office_id,status").gte("paid_on", from).lte("paid_on", to);
      let btQ = sb.from("bank_transactions").select("txn_type,amount,txn_date,bank_account_id,office_id").gte("txn_date", from).lte("txn_date", to);
      let oiQ = sb.from("office_incomes").select("income_type,amount,received_on,office_id,stream").eq("stream", "saving").gte("received_on", from).lte("received_on", to);
      let exQ = sb.from("expenses").select("head,amount,expense_date,office_id,stream,deleted_at").is("deleted_at", null).eq("stream", "savings").gte("expense_date", from).lte("expense_date", to);
      let lnQ = sb.from("loans").select("principal,issued_on,office_id,status,deleted_at").is("deleted_at", null).gte("issued_on", from).lte("issued_on", to);
      let baQ = sb.from("bank_accounts").select("id,account_no,account_title,opening_balance,office_id");
      let btAllQ = sb.from("bank_transactions").select("txn_type,amount,bank_account_id,office_id").gte("txn_date", from).lte("txn_date", to);
      if (officeId) {
        savQ = savQ.eq("office_id", officeId); lpQ = lpQ.eq("office_id", officeId); btQ = btQ.eq("office_id", officeId);
        oiQ = oiQ.eq("office_id", officeId); exQ = exQ.eq("office_id", officeId); lnQ = lnQ.eq("office_id", officeId);
        baQ = baQ.eq("office_id", officeId); btAllQ = btAllQ.eq("office_id", officeId);
      }
      const [sav, lp, bt, oi, ex, ln, ba, btAll] = await Promise.all([savQ, lpQ, btQ, oiQ, exQ, lnQ, baQ, btAllQ]);
      const lpRows = (lp.data ?? []).filter((r: any) => r.status === "approved");
      const lnRows = (ln.data ?? []).filter((r: any) => r.status !== "rejected");
      setData({
        savings: sav.data ?? [], loanPayments: lpRows, bankTx: bt.data ?? [],
        officeIncomes: oi.data ?? [], expenses: ex.data ?? [], loansIssued: lnRows,
        bankAccounts: ba.data ?? [], bankTxAll: btAll.data ?? [],
      });
      setLoading(false);
    })();
  }, [from, to, officeId]);

  const stmt = useMemo(() => computeSocietyStatement({ ...data, opening }), [data, opening]);
  const bankSummary = useMemo(() => computeBankSummary(data.bankAccounts ?? [], data.bankTxAll ?? []), [data]);

  const { incomeLines, expenseLines, totalIncome, totalExpense, openingFund, grandIncome, closingFund, grandExpense } = stmt;
  const rowCount = Math.max(incomeLines.length, expenseLines.length);
  const society = branding.company_name_bn || branding.company_name || "সমবায় সমিতি";

  const bankTotals = bankSummary.reduce((a, r) => ({
    opening: a.opening + r.opening, interest: a.interest + r.interest, charge: a.charge + r.charge,
    deposit: a.deposit + r.deposit, withdraw: a.withdraw + r.withdraw, closing: a.closing + r.closing,
  }), { opening: 0, interest: 0, charge: 0, deposit: 0, withdraw: 0, closing: 0 });

  const exportCsv = () => {
    const rows = [
      ...incomeLines.map((l: Line) => ({ section: "জমা", desc: l.label, amount: l.amount })),
      ...expenseLines.map((l: Line) => ({ section: "খরচ", desc: l.label, amount: l.amount })),
      { section: "মোট", desc: "মোট আয়", amount: totalIncome },
      { section: "মোট", desc: "মোট ব্যয়", amount: totalExpense },
      { section: "তহবিল", desc: "আগত তহবিল", amount: openingFund },
      { section: "তহবিল", desc: "হস্তমজুদ তহবিল", amount: closingFund },
      { section: "সর্বমোট", desc: "সর্বমোট (জমা)", amount: grandIncome },
      { section: "সর্বমোট", desc: "সর্বমোট (খরচ)", amount: grandExpense },
    ];
    downloadCsv(`সমিতি-জমা-খরচ-${from}_${to}`, rows, [
      { header: "বিভাগ", accessor: (r) => r.section },
      { header: "বিবরন", accessor: (r) => r.desc },
      { header: "টাকা", accessor: (r) => Number(r.amount || 0).toFixed(2) },
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="জমা খরচ হিসাব (সমিতি)" description="অডিট রিপোর্ট — সমিতির জমা ও খরচের পূর্ণাঙ্গ বিবরণ" />

      <Card className="p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div><Label>শুরুর তারিখ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>শেষ তারিখ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>আগত তহবিল (টাকা)</Label><Input type="number" className="w-40" value={opening || ""} onChange={(e) => setOpening(+e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading || rowCount === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={() => window.print()} disabled={loading || rowCount === 0}>
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট / PDF
          </Button>
        </div>
        {loading && <span className="text-sm text-muted-foreground">লোড হচ্ছে…</span>}
        {!loading && rowCount === 0 && <span className="text-sm text-destructive">এই সময়ে কোনো তথ্য নেই</span>}
      </Card>

      <div className="bn-statement bg-white text-black p-6 mx-auto" style={{ maxWidth: "900px" }}>
        <div className="text-center mb-3">
          <h1 className="text-xl font-bold">{society} - এর</h1>
          <h2 className="text-base font-semibold mt-1">
            {bnDate(from)} ইং তারিখ হতে {bnDate(to)} ইং তারিখ পর্যন্ত জমা খরচ হিসাব <span className="font-bold">(সমিতি)</span>
          </h2>
        </div>

        <table className="w-full border-collapse text-sm bn-table">
          <thead>
            <tr>
              <th colSpan={3} className="border border-black p-1 text-center font-bold">জমা</th>
              <th colSpan={3} className="border border-black p-1 text-center font-bold">খরচ</th>
            </tr>
            <tr>
              <th className="border border-black p-1 w-12">ক্রঃনং</th>
              <th className="border border-black p-1">বিবরন</th>
              <th className="border border-black p-1 w-28">টাকা</th>
              <th className="border border-black p-1 w-12">ক্রঃনং</th>
              <th className="border border-black p-1">বিবরন</th>
              <th className="border border-black p-1 w-28">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => {
              const inc = incomeLines[i];
              const exp = expenseLines[i];
              return (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{inc ? toBnDigits(String(i + 1).padStart(2, "0")) : ""}</td>
                  <td className="border border-black p-1">{inc?.label ?? ""}</td>
                  <td className="border border-black p-1 text-right">{inc ? bnMoney(inc.amount) : ""}</td>
                  <td className="border border-black p-1 text-center">{exp ? toBnDigits(String(i + 1).padStart(2, "0")) : ""}</td>
                  <td className="border border-black p-1">{exp?.label ?? ""}</td>
                  <td className="border border-black p-1 text-right">{exp ? bnMoney(exp.amount) : ""}</td>
                </tr>
              );
            })}
            {rowCount === 0 && (
              <tr><td colSpan={6} className="border border-black p-3 text-center">এই সময়ে কোনো তথ্য নেই</td></tr>
            )}
            <tr className="font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">
                <Link to={incomeDrillDownUrl(from, to)} aria-label={`সঞ্চয় জমা রেকর্ড দেখুন (${from} থেকে ${to})`} className="text-primary underline print:no-underline print:text-black print:pointer-events-none">মোট আয়=</Link>
              </td>
              <td className="border border-black p-1 text-right">{bnMoney(totalIncome)}</td>
              <td colSpan={2} className="border border-black p-1 text-right">
                <Link to={expenseDrillDownUrl(from, to)} aria-label={`সমিতির খরচ রেকর্ড দেখুন (${from} থেকে ${to})`} className="text-primary underline print:no-underline print:text-black print:pointer-events-none">মোট ব্যয়=</Link>
              </td>
              <td className="border border-black p-1 text-right">{bnMoney(totalExpense)}</td>
            </tr>
            <tr className="font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">
                <Link to={incomingDrillDownUrl(from, to)} aria-label={`আগত তহবিল (ব্যাংক) রেকর্ড দেখুন (${from} থেকে ${to})`} className="text-primary underline print:no-underline print:text-black print:pointer-events-none">আগত তহবিল=</Link>
              </td>
              <td className="border border-black p-1 text-right">{bnMoney(openingFund)}</td>
              <td colSpan={2} className="border border-black p-1 text-right">হস্তমজুদ তহবিল=</td>
              <td className="border border-black p-1 text-right">{bnMoney(closingFund)}</td>
            </tr>
            <tr className="font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">সর্বমোট=</td>
              <td className="border border-black p-1 text-right">{bnMoney(grandIncome)}</td>
              <td colSpan={2} className="border border-black p-1 text-right">সর্বমোট=</td>
              <td className="border border-black p-1 text-right">{bnMoney(grandExpense)}</td>
            </tr>
          </tbody>
        </table>

        <div className="bn-sign-block grid grid-cols-4 gap-4 mt-16 text-center text-xs">
          {["অডিট অফিসার", "সভাপতি", "সম্পাদক", "কোষাধক্ষ্য"].map((role) => (
            <div key={role}>
              <div className="border-t border-black pt-1 font-semibold">{role}</div>
              <div className="leading-tight mt-0.5">{society}</div>
            </div>
          ))}
        </div>

        <div className="bn-sign-block mt-10 text-sm">
          <div className="font-semibold mb-6">ব্যবস্থাপনা কমিটির সদস্যদের স্বাক্ষর ঃ</div>
          <div className="grid grid-cols-3 gap-8">
            <div>১।</div>
            <div>২।</div>
            <div>৩।</div>
          </div>
        </div>

        {bankSummary.length > 0 && (
          <div className="bn-sign-block mt-10">
            <div className="font-semibold mb-2 text-sm">পর্যবেক্ষণ ঃ (ব্যাংক হিসাব) ঃ নিরীক্ষাকালে সমিতিতে নিম্নরূপ ব্যাংক হিসাব পরিলক্ষিত হলো।</div>
            <table className="w-full border-collapse text-xs bn-table">
              <thead>
                <tr>
                  <th className="border border-black p-1 w-10">ক্রঃনং</th>
                  <th className="border border-black p-1">হিসাব নং</th>
                  <th className="border border-black p-1">{bnDate(from)}</th>
                  <th className="border border-black p-1">সুদ প্রাপ্তি</th>
                  <th className="border border-black p-1">ব্যাংক চার্জ কর্তন</th>
                  <th className="border border-black p-1">ব্যাংক জমা</th>
                  <th className="border border-black p-1">ব্যাংক উত্তোলন</th>
                  <th className="border border-black p-1">{bnDate(to)}</th>
                </tr>
              </thead>
              <tbody>
                {bankSummary.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1 text-center">{toBnDigits(String(i + 1).padStart(2, "0"))}</td>
                    <td className="border border-black p-1">{r.account}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.opening)}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.interest)}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.charge)}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.deposit)}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.withdraw)}</td>
                    <td className="border border-black p-1 text-right">{bnMoney(r.closing)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={2} className="border border-black p-1 text-right">মোট=</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.opening)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.interest)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.charge)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.deposit)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.withdraw)}</td>
                  <td className="border border-black p-1 text-right">{bnMoney(bankTotals.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .bn-table { table-layout: fixed; }
        .bn-table th, .bn-table td { word-wrap: break-word; overflow-wrap: anywhere; }
        @media print {
          body * { visibility: hidden; }
          .bn-statement, .bn-statement * { visibility: visible; }
          .bn-statement { position: absolute; left: 0; top: 0; width: 100%; }
          .bn-table { page-break-inside: auto; }
          .bn-table thead { display: table-header-group; }
          .bn-table tr { page-break-inside: avoid; }
          .bn-sign-block { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
