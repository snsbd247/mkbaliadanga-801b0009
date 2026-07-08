import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import {
  pickCurrentSeasonId,
  reconcileFarmerInvoices,
  type ReconInvoice,
} from "@/lib/irrigationReconciliation";

type FarmerRow = {
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  current_season: string;
  invoice_count: number;
  halCharge: number;
  halPenalty: number;
  dueCharge: number;
  duePenalty: number;
  grandTotal: number;
};

export default function IrrigationReconciliationReport() {
  const { t, tx } = useLang();
  const { isSuper } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [genFrom, setGenFrom] = useState<string>("");
  const [genTo, setGenTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tx("Irrigation Reconciliation Report", "সেচ রিকনসিলিয়েশন রিপোর্ট");
    db.from("offices").select("id,name").order("name").then(({ data }) => setOffices(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = db
        .from("irrigation_invoices")
        .select(
          "id,invoice_no,farmer_id,season_id,office_id,due_amount,delay_fee,due_date,generated_at," +
            "farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn,farmer_code)," +
            "seasons(name,year)",
        )
        .is("deleted_at", null)
        .neq("invoice_status", "cancelled")
        .limit(10000);
      if (officeId !== "all") q = q.eq("office_id", officeId);
      if (genFrom) q = q.gte("generated_at", genFrom);
      if (genTo) q = q.lte("generated_at", `${genTo}T23:59:59`);
      const { data, error } = await q;
      if (cancelled) return;
      setLoading(false);
      if (error) return;

      const byFarmer = new Map<string, { meta: any; invoices: ReconInvoice[] }>();
      (data ?? []).forEach((r: any) => {
        const entry = byFarmer.get(r.farmer_id) ?? {
          meta: {
            farmer_name: r.farmers?.name_bn || r.farmers?.name_en || "—",
            farmer_code: r.farmers?.farmer_code ?? "—",
          },
          invoices: [],
        };
        entry.invoices.push({
          id: r.id,
          invoice_no: r.invoice_no,
          season_id: r.season_id,
          due_date: r.due_date,
          due_amount: r.due_amount,
          delay_fee: r.delay_fee,
          seasons: r.seasons,
        });
        byFarmer.set(r.farmer_id, entry);
      });

      const out: FarmerRow[] = [];
      byFarmer.forEach((entry, farmer_id) => {
        const currentSeasonId = pickCurrentSeasonId(entry.invoices);
        const rec = reconcileFarmerInvoices(entry.invoices, currentSeasonId);
        const curInv = entry.invoices.find((i) => i.season_id === currentSeasonId);
        out.push({
          farmer_id,
          farmer_name: entry.meta.farmer_name,
          farmer_code: entry.meta.farmer_code,
          current_season: curInv ? `${curInv.seasons?.name ?? "—"} ${curInv.seasons?.year ?? ""}`.trim() : "—",
          invoice_count: entry.invoices.length,
          halCharge: rec.halCharge,
          halPenalty: rec.halPenalty,
          dueCharge: rec.dueCharge,
          duePenalty: rec.duePenalty,
          grandTotal: rec.grandTotal,
        });
      });
      setRows(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [officeId, genFrom, genTo]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows
      .filter((r) => !s || r.farmer_name.toLowerCase().includes(s) || r.farmer_code.toLowerCase().includes(s))
      .sort((a, b) => b.grandTotal - a.grandTotal);
  }, [rows, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => ({
          halCharge: a.halCharge + r.halCharge,
          halPenalty: a.halPenalty + r.halPenalty,
          dueCharge: a.dueCharge + r.dueCharge,
          duePenalty: a.duePenalty + r.duePenalty,
          grandTotal: a.grandTotal + r.grandTotal,
        }),
        { halCharge: 0, halPenalty: 0, dueCharge: 0, duePenalty: 0, grandTotal: 0 },
      ),
    [filtered],
  );

  const head = [
    t("farmerCode"),
    t("farmer"),
    tx("Current season (হাল)", "চলতি সিজন (হাল)"),
    tx("Invoices", "ইনভয়েস"),
    tx("হাল charge", "হাল চার্জ"),
    tx("হাল penalty", "হাল জরিমানা"),
    tx("বকেয়া charge", "বকেয়া চার্জ"),
    tx("বকেয়া penalty", "বকেয়া জরিমানা"),
    tx("Total", "মোট"),
  ];
  const body = filtered.map((r) => [
    r.farmer_code,
    r.farmer_name,
    r.current_season,
    String(r.invoice_count),
    money(r.halCharge),
    money(r.halPenalty),
    money(r.dueCharge),
    money(r.duePenalty),
    money(r.grandTotal),
  ]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={tx("Irrigation Reconciliation Report", "সেচ রিকনসিলিয়েশন রিপোর্ট")}
        description={tx(
          "Per-farmer hāl (current) and due (arrears) charge/penalty totals — the exact figures used in receipts.",
          "প্রতি কৃষকের হাল (চলতি) ও বকেয়া চার্জ/জরিমানা — রশিদে ব্যবহৃত হুবহু হিসাব।",
        )}
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-4">
          {isSuper && (
            <div>
              <Label>{t("office")}</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allOffices")}</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{tx("Generated from", "তৈরি হয়েছে (থেকে)")}</Label>
            <Input type="date" value={genFrom} onChange={(e) => setGenFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Generated to", "তৈরি হয়েছে (পর্যন্ত)")}</Label>
            <Input type="date" value={genTo} onChange={(e) => setGenTo(e.target.value)} />
          </div>
          <div>
            <Label>{t("searchFarmerLand")}</Label>
            <Input placeholder={t("searchFarmerLandPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOfficeId("all");
                setGenFrom("");
                setGenTo("");
                setSearch("");
              }}
            >
              {tx("Reset filters", "ফিল্টার রিসেট")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} {t("rows")} {loading && `(${t("loading")})`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportTablePDF("Irrigation-Reconciliation", head, body, { from: genFrom, to: genTo }, { landscape: true })
                }
              >
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportExcel(
                    "Irrigation-Reconciliation",
                    "Reconciliation",
                    filtered.map((r) => ({
                      "Farmer Code": r.farmer_code,
                      Farmer: r.farmer_name,
                      "Current Season": r.current_season,
                      Invoices: r.invoice_count,
                      "Hal Charge": r.halCharge,
                      "Hal Penalty": r.halPenalty,
                      "Due Charge": r.dueCharge,
                      "Due Penalty": r.duePenalty,
                      Total: r.grandTotal,
                    })),
                  )
                }
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("farmer")}</TableHead>
                <TableHead>{tx("Current season (হাল)", "চলতি সিজন (হাল)")}</TableHead>
                <TableHead className="text-right">{tx("Invoices", "ইনভয়েস")}</TableHead>
                <TableHead className="text-right">{tx("হাল charge", "হাল চার্জ")}</TableHead>
                <TableHead className="text-right">{tx("হাল penalty", "হাল জরিমানা")}</TableHead>
                <TableHead className="text-right">{tx("বকেয়া charge", "বকেয়া চার্জ")}</TableHead>
                <TableHead className="text-right">{tx("বকেয়া penalty", "বকেয়া জরিমানা")}</TableHead>
                <TableHead className="text-right">{tx("Total", "মোট")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.farmer_id}>
                  <TableCell className="text-xs">{r.farmer_code}</TableCell>
                  <TableCell>{r.farmer_name}</TableCell>
                  <TableCell className="text-xs">{r.current_season}</TableCell>
                  <TableCell className="text-right">{r.invoice_count}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.halCharge)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.halPenalty)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.dueCharge)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.duePenalty)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{money(r.grandTotal)}</TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    {tx("No invoices found", "কোনো ইনভয়েস নেই")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filtered.length > 0 && (
              <tfoot>
                <TableRow className="font-semibold">
                  <TableCell colSpan={4}>{tx("Total", "মোট")}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.halCharge)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.halPenalty)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.dueCharge)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.duePenalty)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.grandTotal)}</TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
