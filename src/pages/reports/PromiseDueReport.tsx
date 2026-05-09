import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { downloadCsv } from "@/lib/csvExport";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  id: string;
  farmer_name: string;
  farmer_code: string | null;
  previous_due_amount: number;
  promise_date: string;
  status: string;
  remarks: string | null;
  created_at: string;
};

function deriveStatus(r: any): string {
  if (r.status === "fulfilled" || r.status === "broken") return r.status;
  const today = new Date().toISOString().slice(0, 10);
  if (r.status === "pending" && r.promise_date < today) return "overdue";
  return r.status;
}

export default function PromiseDueReport() {
  const { tx } = useLang();
  const { isSuper } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tx("Promise Due Report", "প্রতিশ্রুতি বকেয়া রিপোর্ট");
    if (isSuper) supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("irrigation_due_promises")
        .select("id,previous_due_amount,promise_date,status,remarks,created_at,farmer_id,office_id,farmers(name_en,farmer_code)")
        .order("promise_date", { ascending: true })
        .limit(2000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (from) q = q.gte("promise_date", from);
      if (to) q = q.lte("promise_date", to);
      const { data } = await q;
      if (cancelled) return;
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        farmer_name: r.farmers?.name_en ?? "—",
        farmer_code: r.farmers?.farmer_code ?? null,
        previous_due_amount: Number(r.previous_due_amount || 0),
        promise_date: r.promise_date,
        status: deriveStatus(r),
        remarks: r.remarks,
        created_at: r.created_at,
      }));
      setRows(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [officeId, from, to]);

  const filtered = useMemo(
    () => rows.filter(r => status === "all" || r.status === status),
    [rows, status],
  );

  const totals = useMemo(() => ({
    count: filtered.length,
    amount: filtered.reduce((s, r) => s + r.previous_due_amount, 0),
  }), [filtered]);

  const head = ["Farmer", "Code", "Previous Due", "Promise Date", "Status", "Remarks"];
  const bodyRows = () => filtered.map(r => [
    r.farmer_name, r.farmer_code ?? "", money(r.previous_due_amount),
    r.promise_date, r.status, r.remarks ?? "",
  ]);

  function exportPdf() {
    exportTablePDF("Promise Due Report", head, bodyRows());
  }
  function exportXlsx() {
    exportExcel("promise_due_report", "Promises", filtered);
  }
  function exportCsv() {
    downloadCsv(`promise_due_report_${new Date().toISOString().slice(0, 10)}`, filtered, [
      { header: "Farmer", accessor: r => r.farmer_name },
      { header: "Code", accessor: r => r.farmer_code ?? "" },
      { header: "Previous Due", accessor: r => r.previous_due_amount },
      { header: "Promise Date", accessor: r => r.promise_date },
      { header: "Status", accessor: r => r.status },
      { header: "Remarks", accessor: r => r.remarks ?? "" },
      { header: "Created At", accessor: r => r.created_at },
    ]);
  }

  const statusBadge = (s: string) => {
    const map: any = {
      pending: "secondary", fulfilled: "default", overdue: "destructive", broken: "destructive",
    };
    return <Badge variant={map[s] ?? "outline"}>{s}</Badge>;
  };

  return (
    <>
      <PageHeader title={tx("Promise Due Report", "প্রতিশ্রুতি বকেয়া রিপোর্ট")} />
      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-5">
          {isSuper && (
            <div>
              <Label>{tx("Office", "অফিস")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{tx("Status", "অবস্থা")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="fulfilled">fulfilled</SelectItem>
                <SelectItem value="overdue">overdue</SelectItem>
                <SelectItem value="broken">broken</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("From", "হতে")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("To", "পর্যন্ত")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><FileText className="h-4 w-4 mr-1" />CSV</Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {tx("Total promises", "মোট প্রতিশ্রুতি")}: <b>{totals.count}</b> • {tx("Total amount", "মোট পরিমাণ")}: <b>{money(totals.amount)}</b>
        </div>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead className="text-right">{tx("Previous Due", "পূর্বের বকেয়া")}</TableHead>
              <TableHead>{tx("Promise Date", "প্রতিশ্রুতির তারিখ")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{tx("No records", "কোনো রেকর্ড নেই")}</TableCell></TableRow>}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.farmer_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{money(r.previous_due_amount)}</TableCell>
                <TableCell>{fmtDate(r.promise_date)}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-xs">{r.remarks ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
