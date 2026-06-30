import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { formatDagNumbers } from "@/lib/dagNumbers";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Filter = "all" | "overdue" | "delay_fee" | "borga" | "cancelled" | "paid";

export default function InvoiceReport() {
  const { tx } = useLang();
  const { isSuper } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState("all");
  const [seasonId, setSeasonId] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tx("Invoice Report", "ইনভয়েস রিপোর্ট");
    Promise.all([
      db.from("offices").select("id,name").order("name"),
      db.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
    ]).then(([o, s]) => { setOffices(o.data ?? []); setSeasons(s.data ?? []); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = db.from("irrigation_invoices").select(
        "id,invoice_no,is_borga,payable_amount,paid_amount,due_amount,delay_fee,discount_amount,discount_reason,irrigation_amount,maintenance_amount,canal_amount,due_date,invoice_status,office_id,season_id,generated_at,cancelled_at,cancel_reason," +
        "farmers!irrigation_invoices_farmer_id_fkey(name_en,farmer_code,mobile)," +
        "lands(mouza,dag_no,land_size)," +
        "seasons(name,year,type)"
      ).is("deleted_at", null).order("generated_at", { ascending: false }).limit(5000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (seasonId !== "all") q = q.eq("season_id", seasonId);
      if (filter === "overdue") q = q.eq("invoice_status", "overdue");
      else if (filter === "cancelled") q = q.eq("invoice_status", "cancelled");
      else if (filter === "paid") q = q.eq("invoice_status", "paid");
      else if (filter === "borga") q = q.eq("is_borga", true);
      else if (filter === "delay_fee") q = q.gt("delay_fee", 0);
      const { data } = await q;
      if (cancelled) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [officeId, seasonId, filter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.invoice_no || "").toLowerCase().includes(s) ||
      (r.farmers?.name_en || "").toLowerCase().includes(s) ||
      (r.farmers?.farmer_code || "").toLowerCase().includes(s) ||
      (r.farmers?.mobile || "").includes(s)
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({
      payable: a.payable + Number(r.payable_amount || 0),
      paid: a.paid + Number(r.paid_amount || 0),
      due: a.due + Number(r.due_amount || 0),
      delay: a.delay + Number(r.delay_fee || 0),
      discount: a.discount + Number(r.discount_amount || 0),
    }),
    { payable: 0, paid: 0, due: 0, delay: 0, discount: 0 },
  ), [filtered]);

  const head = [
    tx("Invoice", "ইনভয়েস"), tx("Farmer", "কৃষক"), tx("Mouza/Dag", "মৌজা/দাগ"),
    tx("Season", "সিজন"), tx("Type", "ধরন"),
    tx("Discount", "ডিসকাউন্ট"), tx("Discount reason", "ডিসকাউন্টের কারণ"),
    tx("Payable", "প্রদেয়"), tx("Paid", "জমা"), tx("Due", "বকেয়া"),
    tx("Late fee", "বিলম্ব ফি"), tx("Status", "অবস্থা"),
  ];
  const body = filtered.map((r) => [
    r.invoice_no,
    `${r.farmers?.name_en ?? ""} (${r.farmers?.farmer_code ?? ""})`,
    `${r.lands?.mouza ?? ""}/${formatDagNumbers(r.lands?.dag_no)}`,
    r.seasons ? `${r.seasons.name ?? r.seasons.type} ${r.seasons.year}` : "—",
    r.is_borga ? tx("Sharecropper", "বর্গা") : tx("Owner", "নিজ"),
    money(r.discount_amount), r.discount_reason ?? "",
    money(r.payable_amount), money(r.paid_amount), money(r.due_amount), money(r.delay_fee),
    r.invoice_status,
  ]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title={tx("Invoice Report", "ইনভয়েস রিপোর্ট")} description={tx("Overdue, late-fee, sharecropper and season-wise invoice report", "ওভারডিউ, বিলম্ব ফি, বর্গা, সিজন-ভিত্তিক ইনভয়েস রিপোর্ট")} />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-5">
          {isSuper && (
            <div>
              <Label>{tx("Office", "অফিস")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx("All offices", "সকল অফিস")}</SelectItem>
                  {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{tx("Season", "সিজন")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All seasons", "সকল সিজন")}</SelectItem>
                {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.type} {s.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Filter", "ফিল্টার")}</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All invoices", "সব ইনভয়েস")}</SelectItem>
                <SelectItem value="overdue">{tx("Overdue", "ওভারডিউ")}</SelectItem>
                <SelectItem value="delay_fee">{tx("Late fee applied", "বিলম্ব ফি প্রযোজ্য")}</SelectItem>
                <SelectItem value="borga">{tx("Sharecropper", "বর্গা")}</SelectItem>
                <SelectItem value="paid">{tx("Paid", "পরিশোধিত")}</SelectItem>
                <SelectItem value="cancelled">{tx("Cancelled", "বাতিল")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>{tx("Search", "খুঁজুন")}</Label>
            <Input placeholder={tx("Invoice no / farmer / code / mobile", "ইনভয়েস নং / কৃষক / কোড / মোবাইল")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{filtered.length} {tx("rows", "টি")} {loading && tx("(loading…)", "(লোড হচ্ছে...)")}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTablePDF("Invoice-Report", head, body)}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportExcel("Invoice-Report", "Invoices",
                filtered.map((r) => ({
                  Invoice: r.invoice_no,
                  Farmer: r.farmers?.name_en, Code: r.farmers?.farmer_code, Mobile: r.farmers?.mobile,
                  Mouza: r.lands?.mouza, Dag: formatDagNumbers(r.lands?.dag_no),
                  Season: r.seasons ? `${r.seasons.name ?? r.seasons.type} ${r.seasons.year}` : "",
                  Type: r.is_borga ? "Borga" : "Own",
                  Discount: r.discount_amount ?? 0, DiscountReason: r.discount_reason ?? "",
                  Payable: r.payable_amount, Paid: r.paid_amount, Due: r.due_amount,
                  DelayFee: r.delay_fee, Status: r.invoice_status, DueDate: r.due_date,
                })),
              )}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
                <TableHead>{tx("Mouza/Dag", "মৌজা/দাগ")}</TableHead>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead>{tx("Type", "ধরন")}</TableHead>
                <TableHead className="text-right">{tx("Discount", "ডিসকাউন্ট")}</TableHead>
                <TableHead>{tx("Discount reason", "ডিসকাউন্টের কারণ")}</TableHead>
                <TableHead className="text-right">{tx("Payable", "প্রদেয়")}</TableHead>
                <TableHead className="text-right">{tx("Paid", "জমা")}</TableHead>
                <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
                <TableHead className="text-right">{tx("Late fee", "বিলম্ব ফি")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.invoice_no}</TableCell>
                  <TableCell className="text-xs">{r.farmers?.name_en} <span className="text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
                  <TableCell className="text-xs">{r.lands?.mouza}/{formatDagNumbers(r.lands?.dag_no)}</TableCell>
                  <TableCell className="text-xs">{r.seasons ? `${r.seasons.name ?? r.seasons.type} ${r.seasons.year}` : "—"}</TableCell>
                  <TableCell><Badge variant={r.is_borga ? "secondary" : "outline"}>{r.is_borga ? tx("Sharecropper", "বর্গা") : tx("Owner", "নিজ")}</Badge></TableCell>
                  <TableCell className="text-right">{money(r.discount_amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={r.discount_reason ?? ""}>{r.discount_reason ?? "—"}</TableCell>
                  <TableCell className="text-right">{money(r.payable_amount)}</TableCell>
                  <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                  <TableCell className="text-right text-destructive font-semibold">{money(r.due_amount)}</TableCell>
                  <TableCell className="text-right">{money(r.delay_fee)}</TableCell>
                  <TableCell><Badge variant={r.invoice_status === "paid" ? "default" : r.invoice_status === "overdue" ? "destructive" : "secondary"}>{r.invoice_status}</Badge></TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">{tx("No data", "কোন তথ্য নেই")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-end gap-6 text-sm">
              <div>{tx("Payable", "প্রদেয়")}: <span className="font-semibold">{money(totals.payable)}</span></div>
              <div>{tx("Paid", "জমা")}: <span className="font-semibold text-success">{money(totals.paid)}</span></div>
              <div>{tx("Due", "বকেয়া")}: <span className="font-semibold text-destructive">{money(totals.due)}</span></div>
              <div>{tx("Late fee", "বিলম্ব ফি")}: <span className="font-semibold">{money(totals.delay)}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
