import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import { differenceInDays } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";
import { useLang } from "@/i18n/LanguageProvider";
import { moneyL, fmtDateL } from "@/lib/format";

export default function LoanOverdueReport() {
  const { t, tx, lang } = useLang();
  const fmt = (d: any) => fmtDateL(d, lang);
  const money = (n: any) => moneyL(Number(n || 0), lang);
  const [rows, setRows] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [patwaris, setPatwaris] = useState<any[]>([]);
  const [farmerPatwariMap, setFarmerPatwariMap] = useState<Map<string, Set<string>>>(new Map());
  const [farmerId, setFarmerId] = useState<string>("all");
  const [patwariId, setPatwariId] = useState<string>("all");
  const [issuedFrom, setIssuedFrom] = useState<string>("");
  const [issuedTo, setIssuedTo] = useState<string>("");
  const [dueFrom, setDueFrom] = useState<string>("");
  const [dueTo, setDueTo] = useState<string>("");
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(true);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [f, p, lands] = await Promise.all([
        supabase.from("farmers").select("id,name_en,name_bn,farmer_code").is("deleted_at", null).order("farmer_code").limit(5000),
        supabase.from("patwaris").select("id,name,name_bn").eq("is_active", true).order("name"),
        supabase.from("lands").select("owner_farmer_id,patwari_id").not("patwari_id", "is", null),
      ]);
      setFarmers(f.data ?? []);
      setPatwaris(p.data ?? []);
      const m = new Map<string, Set<string>>();
      (lands.data ?? []).forEach((l: any) => {
        if (!l.owner_farmer_id || !l.patwari_id) return;
        if (!m.has(l.owner_farmer_id)) m.set(l.owner_farmer_id, new Set());
        m.get(l.owner_farmer_id)!.add(l.patwari_id);
      });
      setFarmerPatwariMap(m);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("loan_installments")
        .select("id,installment_no,amount,paid_amount,due_date,status,loan_id,loans(id,farmer_id,plan_id,office_id,total_payable,issued_on,farmers(name_bn,name_en,farmer_code,mobile),loan_plans(name,name_bn))")
        .order("due_date", { ascending: true })
        .limit(5000);
      if (onlyOverdue) {
        const today = new Date().toISOString().slice(0, 10);
        q = q.neq("status", "paid").lt("due_date", today);
      }
      if (dueFrom) q = q.gte("due_date", dueFrom);
      if (dueTo) q = q.lte("due_date", dueTo);
      const { data } = await q;
      if (cancelled) return;
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [onlyOverdue, dueFrom, dueTo]);

  const filtered = useMemo(() => {
    const qstr = search.trim().toLowerCase();
    return rows.filter(r => {
      const fid = r.loans?.farmer_id;
      if (farmerId !== "all" && fid !== farmerId) return false;
      if (patwariId !== "all") {
        const set = farmerPatwariMap.get(fid);
        if (!set || !set.has(patwariId)) return false;
      }
      if (issuedFrom && r.loans?.issued_on && r.loans.issued_on < issuedFrom) return false;
      if (issuedTo && r.loans?.issued_on && r.loans.issued_on > issuedTo) return false;
      if (!qstr) return true;
      const f = r.loans?.farmers;
      return [f?.name_bn, f?.name_en, f?.farmer_code, f?.mobile].some(v => String(v ?? "").toLowerCase().includes(qstr));
    });
  }, [rows, search, farmerId, patwariId, issuedFrom, issuedTo, farmerPatwariMap]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => {
      const amt = Number(r.amount || 0);
      const paid = Number(r.paid_amount || 0);
      return { amount: a.amount + amt, paid: a.paid + paid, remaining: a.remaining + (amt - paid) };
    },
    { amount: 0, paid: 0, remaining: 0 },
  ), [filtered]);

  function exportCsv() {
    downloadCsv("loan_due.csv", filtered, [
      { header: t("farmer"), accessor: r => r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "" },
      { header: t("accountNo"), accessor: r => r.loans?.farmers?.farmer_code || "" },
      { header: t("plan" as any), accessor: r => r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "" },
      { header: t("installmentNo"), accessor: r => r.installment_no },
      { header: "Issued On", accessor: r => fmt(r.loans?.issued_on) },
      { header: t("dueDateLabel" as any), accessor: r => fmt(r.due_date) },
      { header: t("delayDays" as any), accessor: r => Math.max(0, differenceInDays(new Date(), new Date(r.due_date))) },
      { header: t("amount"), accessor: r => Number(r.amount || 0) },
      { header: t("paid"), accessor: r => Number(r.paid_amount || 0) },
      { header: t("remaining" as any), accessor: r => Number(r.amount || 0) - Number(r.paid_amount || 0) },
    ]);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold">{t("loanOverdueReportTitle" as any)}</h1>
        <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("export")}</Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>{tx("Farmer", "কৃষক")}</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">{tx("All farmers", "সকল কৃষক")}</SelectItem>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_bn || f.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Patwari", "পাটুয়ারি")}</Label>
            <Select value={patwariId} onValueChange={setPatwariId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All patwaris", "সকল পাটুয়ারি")}</SelectItem>
                {patwaris.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn || p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Issued from", "প্রদান (থেকে)")}</Label>
            <Input type="date" value={issuedFrom} onChange={(e) => setIssuedFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Issued to", "প্রদান (পর্যন্ত)")}</Label>
            <Input type="date" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Due from", "ডিউ ডেট (থেকে)")}</Label>
            <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Due to", "ডিউ ডেট (পর্যন্ত)")}</Label>
            <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Search", "সার্চ")}</Label>
            <Input placeholder={t("searchPlaceholderFarmer" as any)} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-end gap-2">
              <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} id="onlyovd" />
              <Label htmlFor="onlyovd">{tx("Only overdue", "শুধু মেয়াদোত্তীর্ণ")}</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFarmerId("all"); setPatwariId("all"); setIssuedFrom(""); setIssuedTo(""); setDueFrom(""); setDueTo(""); setSearch(""); }}>
              {tx("Reset", "রিসেট")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {loading ? t("loading") : `${filtered.length} ${t("overdueCountSuffix" as any)}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("farmer")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead>{t("plan" as any)}</TableHead>
                <TableHead>{t("installment" as any)}</TableHead>
                <TableHead>{tx("Issued", "প্রদান")}</TableHead>
                <TableHead>{t("dueDateLabel" as any)}</TableHead>
                <TableHead>{t("delayDays" as any)}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("paid")}</TableHead>
                <TableHead className="text-right">{t("remaining" as any)}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const days = Math.max(0, differenceInDays(new Date(), new Date(r.due_date)));
                const remaining = Number(r.amount || 0) - Number(r.paid_amount || 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.loans?.farmers?.name_bn || r.loans?.farmers?.name_en || "-"}</TableCell>
                    <TableCell>{r.loans?.farmers?.farmer_code || "-"}</TableCell>
                    <TableCell>{r.loans?.loan_plans?.name_bn || r.loans?.loan_plans?.name || "-"}</TableCell>
                    <TableCell>#{r.installment_no}</TableCell>
                    <TableCell className="text-xs">{fmt(r.loans?.issued_on)}</TableCell>
                    <TableCell className="text-xs">{fmt(r.due_date)}</TableCell>
                    <TableCell>{days > 0 ? <Badge variant="destructive">{days} {t("days" as any)}</Badge> : <Badge variant="secondary">—</Badge>}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{money(remaining)}</TableCell>
                    <TableCell><Link className="text-primary underline text-xs" to={`/loans/${r.loan_id}`}>{t("detailsLink" as any)}</Link></TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && !loading && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div>{t("amount")}: <span className="font-semibold">{money(totals.amount)}</span></div>
              <div>{t("paid")}: <span className="font-semibold text-success">{money(totals.paid)}</span></div>
              <div>{t("remaining" as any)}: <span className="font-semibold text-destructive">{money(totals.remaining)}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
