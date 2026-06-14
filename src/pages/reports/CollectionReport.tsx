import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";

const ALL = "__all__";

type CollectionRow = {
  source: "irrigation" | "loan" | "savings";
  date: string;
  amount: number;
  farmer_id: string | null;
  farmer_code: string;
  farmer_name: string;
  user_id: string | null;
  user_name: string;
  ref_id: string;
  receipt_no: string | null;
  voided?: boolean;
  void_reason?: string | null;
  // breakdown columns
  sech: number;
  jorimana: number;
  hal: number;
  bokeya: number;
  hawlat: number;
  anudan: number;
  rin: number;
  soncoy: number;
  bibidh: number;
  vangari: number;
  pukur: number;
  bighat: number;
  bhortifi: number;
};

type ProfileLite = { id: string; full_name: string | null; email: string | null; office_id: string | null };

export default function CollectionReport() {
  const { t } = useLang();
  const { user, isAdmin, isSuper, rolesLoaded } = useAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [farmerId, setFarmerId] = useState(ALL);
  const [userId, setUserId] = useState<string>(ALL);
  const [onlyMine, setOnlyMine] = useState<boolean>(!isAdmin);

  const [farmers, setFarmers] = useState<any[]>([]);
  const [users, setUsers] = useState<ProfileLite[]>([]);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Once roles load, default Staff to "only mine".
  useEffect(() => {
    if (rolesLoaded) setOnlyMine(!isAdmin);
  }, [rolesLoaded, isAdmin]);

  useEffect(() => {
    document.title = `${t("collectionReportTitle")} — ${t("appName")}`;
    supabase
      .from("farmers")
      .select("id,name_en,farmer_code,member_no")
      .order("name_en")
      .then(({ data }) => setFarmers(data ?? []));

    supabase.rpc("list_collector_users").then(({ data }) => {
      setUsers((data as ProfileLite[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!rolesLoaded) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, farmerId, userId, onlyMine, rolesLoaded]);

  const effectiveUserId = useMemo<string | null>(() => {
    // Staff are forced to only-mine; admins can choose.
    if (!isAdmin) return user?.id ?? null;
    if (onlyMine) return user?.id ?? null;
    if (userId !== ALL) return userId;
    return null;
  }, [isAdmin, onlyMine, userId, user?.id]);

  function nameForUser(id: string | null | undefined): string {
    if (!id) return t("systemUser");
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  }

  function nameForFarmer(f: any): { code: string; name: string } {
    if (!f) return { code: "—", name: "—" };
    return { code: f.member_no ?? f.farmer_code ?? "—", name: f.name_en ?? "—" };
  }

  async function load() {
    setLoading(true);
    try {
      const out: CollectionRow[] = [];

      // 1) Irrigation collections (from irrigation_invoice_payments)
      let irrQ: any = supabase
        .from("irrigation_invoice_payments")
        .select("id,created_at,collected_amount,delay_fee_collected,maintenance_collected,canal_collected,irrigation_collected,current_invoice_collected,previous_due_collected,created_by,invoice_id,payments(receipt_no),irrigation_invoices!inner(farmer_id,farmers!irrigation_invoices_farmer_id_fkey(name_en,farmer_code,member_no))")
        .gt("collected_amount", 0)
        .order("created_at", { ascending: false });
      if (from) irrQ = irrQ.gte("created_at", from);
      if (to) irrQ = irrQ.lte("created_at", to + "T23:59:59");
      if (farmerId !== ALL) irrQ = irrQ.eq("irrigation_invoices.farmer_id", farmerId);
      if (effectiveUserId) irrQ = irrQ.eq("created_by", effectiveUserId);
      const { data: irr } = await irrQ;
      for (const r of irr ?? []) {
        const inv = (r as any).irrigation_invoices;
        const fn = nameForFarmer(inv?.farmers);
        out.push({
          source: "irrigation",
          date: (r.created_at || "").slice(0, 10),
          amount: Number(r.collected_amount || 0),
          farmer_id: inv?.farmer_id ?? null,
          farmer_code: fn.code,
          farmer_name: fn.name,
          user_id: r.created_by,
          user_name: nameForUser(r.created_by),
          ref_id: r.id,
          receipt_no: (r as any).payments?.receipt_no ?? null,
          sech: Number(r.irrigation_collected || 0) + Number(r.maintenance_collected || 0) + Number(r.canal_collected || 0),
          jorimana: Number(r.delay_fee_collected || 0),
          hal: Number(r.current_invoice_collected || 0),
          bokeya: Number(r.previous_due_collected || 0),
          hawlat: 0, anudan: 0, rin: 0, soncoy: 0, bibidh: 0,
          vangari: 0, pukur: 0, bighat: 0, bhortifi: 0,
        });
      }

      // 2) Loan repayments (loan_payments.collected_by)
      let lpQ: any = supabase
        .from("loan_payments")
        .select("id,paid_on,amount,collected_by,loan_id,loans(farmer_id,farmers(name_en,farmer_code,member_no))")
        .order("paid_on", { ascending: false });
      if (from) lpQ = lpQ.gte("paid_on", from);
      if (to) lpQ = lpQ.lte("paid_on", to);
      if (effectiveUserId) lpQ = lpQ.eq("collected_by", effectiveUserId);
      const { data: lp } = await lpQ;
      for (const r of lp ?? []) {
        const farmer = r.loans?.farmers;
        const fId = r.loans?.farmer_id ?? null;
        if (farmerId !== ALL && fId !== farmerId) continue;
        const fn = nameForFarmer(farmer);
        out.push({
          source: "loan",
          date: r.paid_on,
          amount: Number(r.amount || 0),
          farmer_id: fId,
          farmer_code: fn.code,
          farmer_name: fn.name,
          user_id: r.collected_by,
          user_name: nameForUser(r.collected_by),
          ref_id: r.id,
          receipt_no: null,
          sech: 0, jorimana: 0, hal: 0, bokeya: 0,
          hawlat: 0, anudan: 0, rin: Number(r.amount || 0), soncoy: 0, bibidh: 0,
          vangari: 0, pukur: 0, bighat: 0, bhortifi: 0,
        });
      }

      // 3) Savings deposits (savings_transactions.created_by)
      let svQ: any = supabase
        .from("savings_transactions")
        .select("id,txn_date,amount,type,status,farmer_id,created_by,receipt_no,category,farmers(name_en,farmer_code,member_no)")
        .is("deleted_at", null)
        .eq("type", "deposit")
        .eq("status", "approved")
        .order("txn_date", { ascending: false });
      if (from) svQ = svQ.gte("txn_date", from);
      if (to) svQ = svQ.lte("txn_date", to);
      if (farmerId !== ALL) svQ = svQ.eq("farmer_id", farmerId);
      if (effectiveUserId) svQ = svQ.eq("created_by", effectiveUserId);
      const { data: sv } = await svQ;
      for (const r of sv ?? []) {
        const fn = nameForFarmer(r.farmers);
        const amt = Number(r.amount || 0);
        const cat = (r as any).category as string | null;
        out.push({
          source: "savings",
          date: r.txn_date,
          amount: amt,
          farmer_id: r.farmer_id,
          farmer_code: fn.code,
          farmer_name: fn.name,
          user_id: r.created_by,
          user_name: nameForUser(r.created_by),
          ref_id: r.id,
          receipt_no: (r as any).receipt_no ?? null,
          sech: 0, jorimana: 0, hal: 0, bokeya: 0,
          hawlat: cat === "hawlat" ? amt : 0,
          anudan: cat === "donation" ? amt : 0,
          rin: 0,
          soncoy: (!cat || cat === "general") ? amt : 0,
          bibidh: (cat === "misc" || cat === "bank") ? amt : 0,
          vangari: (cat === "vangari" || cat === "scrap") ? amt : 0,
          pukur: (cat === "pond" || cat === "pukur") ? amt : 0,
          bighat: cat === "bighat" ? amt : 0,
          bhortifi: (cat === "admission" || cat === "bhortifi") ? amt : 0,
        });
      }


      // 4) Cancelled/voided receipts (payments.status = voided) — shown so the
      // collection report reflects "<receipt_no> বাতিল".
      let vdQ: any = supabase
        .from("payments")
        .select("id,receipt_no,amount,voided_at,void_reason,created_by,farmer_id,farmers(name_en,farmer_code,member_no)")
        .eq("status", "voided" as any)
        .not("voided_at", "is", null)
        .order("voided_at", { ascending: false });
      if (from) vdQ = vdQ.gte("voided_at", from);
      if (to) vdQ = vdQ.lte("voided_at", to + "T23:59:59");
      if (farmerId !== ALL) vdQ = vdQ.eq("farmer_id", farmerId);
      if (effectiveUserId) vdQ = vdQ.eq("created_by", effectiveUserId);
      const { data: vd } = await vdQ;
      for (const r of vd ?? []) {
        const fn = nameForFarmer((r as any).farmers);
        out.push({
          source: "irrigation",
          date: ((r as any).voided_at || "").slice(0, 10),
          amount: 0,
          farmer_id: (r as any).farmer_id ?? null,
          farmer_code: fn.code,
          farmer_name: fn.name,
          user_id: (r as any).created_by,
          user_name: nameForUser((r as any).created_by),
          ref_id: r.id,
          receipt_no: (r as any).receipt_no ?? null,
          voided: true,
          void_reason: (r as any).void_reason ?? null,
          sech: 0, jorimana: 0, hal: 0, bokeya: 0,
          hawlat: 0, anudan: 0, rin: 0, soncoy: 0, bibidh: 0,
          vangari: 0, pukur: 0, bighat: 0, bhortifi: 0,
        });
      }

      out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  // ---- Aggregations ----
  const total = useMemo(
    () => rows.reduce((s, r) => s + r.amount, 0),
    [rows],
  );

  const byUser = useMemo(() => {
    const m = new Map<
      string,
      { user_id: string | null; name: string; total: number; loan: number; savings: number; irrigation: number; count: number }
    >();
    for (const r of rows) {
      const key = r.user_id ?? "system";
      const cur =
        m.get(key) ??
        { user_id: r.user_id, name: r.user_name, total: 0, loan: 0, savings: 0, irrigation: 0, count: 0 };
      cur.total += r.amount;
      cur[r.source] += r.amount;
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const filterSuffix = () => {
    const parts: string[] = [];
    if (from || to) parts.push(`${from || "…"}→${to || "…"}`);
    if (farmerId !== ALL) parts.push(farmers.find((f) => f.id === farmerId)?.name_en ?? "");
    if (effectiveUserId) parts.push(nameForUser(effectiveUserId));
    return parts.length ? ` (${parts.join(" · ")})` : "";
  };

  const sourceLabel = (s: CollectionRow["source"]) =>
    s === "loan" ? t("loanColLabel") : s === "savings" ? t("savingsLabel") : t("irrigationLabel");

  return (
    <>
      <PageHeader
        title={t("collectionReportTitle")}
        description={isAdmin ? t("collectionReportAdminDesc") : t("collectionReportUserDesc")}
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label>{t("from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>{t("farmerName")}</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("all")}</SelectItem>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.member_no ?? f.farmer_code} — {f.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div>
              <Label>{t("staffLabel")}</Label>
              <Select
                value={userId}
                onValueChange={(v) => { setUserId(v); if (v !== ALL) setOnlyMine(false); }}
                disabled={onlyMine}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("all")}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email || u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Switch
              id="mine"
              checked={onlyMine}
              onCheckedChange={(v) => { setOnlyMine(v); if (v) setUserId(ALL); }}
            />
            <Label htmlFor="mine" className="cursor-pointer">{t("myCollections")}</Label>
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t("totalCollected")}:</span>{" "}
            <span className="font-semibold">{money(total)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("entries")}:</span>{" "}
            <span className="font-semibold">{rows.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("staffLabel")}:</span>{" "}
            <span className="font-semibold">{byUser.length}</span>
          </div>
          {loading && <span className="text-muted-foreground">{t("loading")}</span>}
        </div>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("allCollections")}</TabsTrigger>
          <TabsTrigger value="staff">{t("staffwiseSummary")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ExportBar
            onPdf={() =>
              exportTablePDF(
                `Collection Report${filterSuffix()}`,
                ["Date", "Receipt #", "Farmer", "Sech", "Penalty", "Hal", "Bokeya", "Hawlat", "Anudan", "Vangari", "Pukur", "Bighat", "Bhorti Fee", "Loan", "Savings", "Misc", "Total", "User"],
                rows.map((r) => [
                  fmtDate(r.date), `${r.receipt_no ?? "—"}${r.voided ? " (বাতিল)" : ""}`, `${r.farmer_code} — ${r.farmer_name}`,
                  r.sech, r.jorimana, r.hal, r.bokeya, r.hawlat, r.anudan, r.vangari, r.pukur, r.bighat, r.bhortifi, r.rin, r.soncoy, r.bibidh, r.voided ? "বাতিল" : r.amount, r.user_name,
                ]),
              )
            }
            onXlsx={() =>
              exportExcel(
                "collection-report",
                "Collections",
                rows.map((r) => ({
                  Date: r.date,
                  "Receipt #": `${r.receipt_no ?? ""}${r.voided ? " (বাতিল)" : ""}`,
                  "Farmer ID": r.farmer_code,
                  "Farmer Name": r.farmer_name,
                  "সেচ": r.sech, "জরিমানা": r.jorimana, "হাল": r.hal, "বকেয়া": r.bokeya,
                  "হাওলাত": r.hawlat, "অনুদান": r.anudan, "ভাঙারি": r.vangari, "পুকুর": r.pukur, "বিঘাত": r.bighat, "ভর্তি ফি": r.bhortifi, "ঋণ": r.rin, "সঞ্চয়": r.soncoy, "বিবিধ": r.bibidh,
                  "মোট": r.voided ? "বাতিল" : r.amount,
                  "User": r.user_name,
                })),
              )
            }
          />
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("receiptHash")}</TableHead>
                  <TableHead>{t("farmer")}</TableHead>
                  <TableHead className="text-right">সেচ</TableHead>
                  <TableHead className="text-right">জরিমানা</TableHead>
                  <TableHead className="text-right">হাল</TableHead>
                  <TableHead className="text-right">বকেয়া</TableHead>
                  <TableHead className="text-right">হাওলাত</TableHead>
                  <TableHead className="text-right">অনুদান</TableHead>
                  <TableHead className="text-right">ভাঙারি</TableHead>
                  <TableHead className="text-right">পুকুর</TableHead>
                  <TableHead className="text-right">বিঘাত</TableHead>
                  <TableHead className="text-right">ভর্তি ফি</TableHead>
                  <TableHead className="text-right">ঋণ</TableHead>
                  <TableHead className="text-right">সঞ্চয়</TableHead>
                  <TableHead className="text-right">বিবিধ</TableHead>
                  <TableHead className="text-right">মোট</TableHead>
                  <TableHead>{t("createdBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.source}-${r.ref_id}`} className={r.voided ? "opacity-70" : undefined}>
                    <TableCell>{fmtDate(r.date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.receipt_no ?? "—"}
                      {r.voided && <span className="ml-1 text-destructive font-semibold">— বাতিল</span>}
                    </TableCell>
                    <TableCell className="text-xs">{r.farmer_code} — {r.farmer_name}</TableCell>
                    <TableCell className="text-right">{r.sech ? money(r.sech) : "—"}</TableCell>
                    <TableCell className="text-right">{r.jorimana ? money(r.jorimana) : "—"}</TableCell>
                    <TableCell className="text-right">{r.hal ? money(r.hal) : "—"}</TableCell>
                    <TableCell className="text-right text-amber-600">{r.bokeya ? money(r.bokeya) : "—"}</TableCell>
                    <TableCell className="text-right">{r.hawlat ? money(r.hawlat) : "—"}</TableCell>
                    <TableCell className="text-right">{r.anudan ? money(r.anudan) : "—"}</TableCell>
                    <TableCell className="text-right">{r.vangari ? money(r.vangari) : "—"}</TableCell>
                    <TableCell className="text-right">{r.pukur ? money(r.pukur) : "—"}</TableCell>
                    <TableCell className="text-right">{r.bighat ? money(r.bighat) : "—"}</TableCell>
                    <TableCell className="text-right">{r.bhortifi ? money(r.bhortifi) : "—"}</TableCell>
                    <TableCell className="text-right">{r.rin ? money(r.rin) : "—"}</TableCell>
                    <TableCell className="text-right">{r.soncoy ? money(r.soncoy) : "—"}</TableCell>
                    <TableCell className="text-right">{r.bibidh ? money(r.bibidh) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{r.voided ? <span className="text-destructive">বাতিল</span> : money(r.amount)}</TableCell>
                    <TableCell className="text-xs">{r.user_name}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center text-muted-foreground py-6">
                      {t("noCollectionsFiltered")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <ExportBar
            onPdf={() =>
              exportTablePDF(
                `Staff-wise Collection${filterSuffix()}`,
                ["Staff", "Entries", "Loan", "Savings", "Irrigation", "Total"],
                byUser.map((u) => [u.name, u.count, u.loan, u.savings, u.irrigation, u.total]),
              )
            }
            onXlsx={() =>
              exportExcel(
                "staff-collections",
                "Staff",
                byUser.map((u) => ({
                  Staff: u.name,
                  Entries: u.count,
                  Loan: u.loan,
                  Savings: u.savings,
                  Irrigation: u.irrigation,
                  Total: u.total,
                })),
              )
            }
          />
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("staffLabel")}</TableHead>
                  <TableHead className="text-right">{t("entries")}</TableHead>
                  <TableHead className="text-right">{t("loanColLabel")}</TableHead>
                  <TableHead className="text-right">{t("savingsLabel")}</TableHead>
                  <TableHead className="text-right">{t("irrigationLabel")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUser.map((u) => (
                  <TableRow key={u.user_id ?? "system"}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell className="text-right">{u.count}</TableCell>
                    <TableCell className="text-right">{money(u.loan)}</TableCell>
                    <TableCell className="text-right">{money(u.savings)}</TableCell>
                    <TableCell className="text-right">{money(u.irrigation)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(u.total)}</TableCell>
                  </TableRow>
                ))}
                {byUser.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {t("noCollections")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ExportBar({ onPdf, onXlsx }: { onPdf: () => void; onXlsx: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex justify-end gap-2 mb-2">
      <button
        onClick={onXlsx}
        className="inline-flex items-center gap-1 text-sm border rounded px-3 py-1 hover:bg-muted"
      >
        {t("exportExcel")}
      </button>
      <button
        onClick={onPdf}
        className="inline-flex items-center gap-1 text-sm border rounded px-3 py-1 hover:bg-muted"
      >
        {t("exportPdf")}
      </button>
    </div>
  );
}
