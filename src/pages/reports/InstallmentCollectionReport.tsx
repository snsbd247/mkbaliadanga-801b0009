import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";

const fmt = (d: any) => (d ? format(new Date(d), "dd/MM/yyyy") : "-");
const money = (n: any) => `৳ ${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

export default function InstallmentCollectionReport() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("loan_payments")
      .select("id,amount,paid_on,note,loan_id,loans(farmer_id,farmers(name_bn,name_en,farmer_code),loan_plans(name,name_bn))")
      .gte("paid_on", from)
      .lte("paid_on", to)
      .order("paid_on", { ascending: false })
      .limit(5000);
    setRows((data ?? []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  function exportCsv() {
    downloadCsv("installment_collection.csv", rows, [
      { header: "তারিখ", accessor: r => fmt(r.paid_on) },
      { header: "কৃষক", accessor: r => r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "" },
      { header: "হিসাব", accessor: r => r.loans?.farmers?.farmer_code || "" },
      { header: "প্ল্যান", accessor: r => r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "" },
      { header: "পরিমাণ", accessor: r => Number(r.amount || 0) },
      { header: "মন্তব্য", accessor: r => r.note || "" },
    ]);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">কিস্তি সংগ্রহ রিপোর্ট</h1>
        <div className="flex gap-2 items-center">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={load}>রিফ্রেশ</Button>
          <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{loading ? "লোড হচ্ছে…" : `মোট ${rows.length} টি · ${money(total)}`}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead>
                <TableHead>কৃষক</TableHead>
                <TableHead>হিসাব</TableHead>
                <TableHead>প্ল্যান</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{fmt(r.paid_on)}</TableCell>
                  <TableCell>{r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "-"}</TableCell>
                  <TableCell>{r.loans?.farmers?.farmer_code || "-"}</TableCell>
                  <TableCell>{r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
