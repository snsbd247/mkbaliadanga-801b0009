// i18n-ignore-file — fixed Bengali audit statement (সেচ জমা খরচ হিসাব)
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { computeStatement, type Line } from "@/lib/irrigationCashStatement";
import { downloadCsv } from "@/lib/csvExport";

const sb = supabase as any;

// Bengali money: comma grouping + two decimals + Bengali digits.
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

export default function IrrigationCashStatement() {
  const branding = useBranding();
  const { officeId } = useAuth();

  // Default to the running Bangladeshi fiscal year (Jul 1 – Jun 30).
  const today = new Date();
  const fyStartYear = today.getMonth() + 1 >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [from, setFrom] = useState(`${fyStartYear}-07-01`);
  const [to, setTo] = useState(`${fyStartYear + 1}-06-30`);
  const [opening, setOpening] = useState<number>(0);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "জমা খরচ হিসাব (সেচ)"; }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      // Income: farmer payments on the irrigation stream + farmer-less office incomes (stream=sech).
      let payQ = sb.from("payments")
        .select("kind,amount,created_at,office_id,status,deleted_at,voided_at")
        .gte("created_at", from).lte("created_at", `${to}T23:59:59`);
      let offQ = sb.from("office_incomes")
        .select("income_type,amount,received_on,office_id,stream")
        .eq("stream", "sech").gte("received_on", from).lte("received_on", to);
      let expQ = sb.from("expenses")
        .select("stream,head,amount,expense_date,office_id")
        .is("deleted_at", null).eq("stream", "irrigation")
        .gte("expense_date", from).lte("expense_date", to);
      if (officeId) { payQ = payQ.eq("office_id", officeId); offQ = offQ.eq("office_id", officeId); expQ = expQ.eq("office_id", officeId); }
      const [pay, off, exp] = await Promise.all([payQ, offQ, expQ]);
      const payRows = (pay.data ?? []).filter((p: any) => !p.deleted_at && !p.voided_at && p.status !== "rejected");
      setReceipts([...payRows, ...(off.data ?? [])]);
      setExpenses(exp.data ?? []);
      setLoading(false);
    })();
  }, [from, to, officeId]);

  const {
    incomeLines, expenseLines, totalIncome, totalExpense,
    openingFund, grandIncome, closingFund, grandExpense,
  } = useMemo(
    () => computeStatement(receipts, expenses, opening),
    [receipts, expenses, opening],
  );

  const rowCount = Math.max(incomeLines.length, expenseLines.length);
  const society = branding.company_name_bn || branding.company_name || "সমবায় সমিতি";

  const exportCsv = () => {
    const rows = [
      ...incomeLines.map((l) => ({ section: "জমা", desc: l.label, amount: l.amount })),
      ...expenseLines.map((l) => ({ section: "খরচ", desc: l.label, amount: l.amount })),
      { section: "মোট", desc: "মোট আয়", amount: totalIncome },
      { section: "মোট", desc: "মোট ব্যয়", amount: totalExpense },
      { section: "তহবিল", desc: "আগত তহবিল", amount: openingFund },
      { section: "তহবিল", desc: "হস্তমজুদ তহবিল", amount: closingFund },
      { section: "সর্বমোট", desc: "সর্বমোট (জমা)", amount: grandIncome },
      { section: "সর্বমোট", desc: "সর্বমোট (খরচ)", amount: grandExpense },
    ];
    downloadCsv(`সেচ-জমা-খরচ-${from}_${to}`, rows, [
      { header: "বিভাগ", accessor: (r) => r.section },
      { header: "বিবরন", accessor: (r) => r.desc },
      { header: "টাকা", accessor: (r) => Number(r.amount || 0).toFixed(2) },
    ]);
  };


  return (
    <div className="space-y-4">
      <PageHeader title="জমা খরচ হিসাব (সেচ)" description="অডিট রিপোর্ট — জমা ও খরচের পূর্ণাঙ্গ বিবরণ" />

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
            {bnDate(from)} ইং তারিখ হতে {bnDate(to)} ইং তারিখ পর্যন্ত জমা খরচ হিসাব <span className="font-bold">(সেচ)</span>
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
              <td colSpan={2} className="border border-black p-1 text-right">মোট আয়=</td>
              <td className="border border-black p-1 text-right">
                <Link to={`/payments?kind=irrigation&from=${from}&to=${to}`} className="underline print:no-underline print:text-black text-blue-700">{bnMoney(totalIncome)}</Link>
              </td>
              <td colSpan={2} className="border border-black p-1 text-right">মোট ব্যয়=</td>
              <td className="border border-black p-1 text-right">
                <Link to={`/reports/expenses?stream=irrigation&from=${from}&to=${to}`} className="underline print:no-underline print:text-black text-blue-700">{bnMoney(totalExpense)}</Link>
              </td>
            </tr>
            <tr className="font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">আগত তহবিল=</td>
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
