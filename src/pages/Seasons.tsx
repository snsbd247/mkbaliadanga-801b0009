import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, DollarSign, History, FileDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { exportTablePDF } from "@/lib/exports";

type SeasonType = { id: string; code: string; name: string; name_bn: string | null };
type LandType = { id: string; code: string; name: string; name_bn: string | null };

const ENUM_VALUES = new Set(["aman", "boro", "iri", "other"]);
const toEnum = (code: string) => (ENUM_VALUES.has(code) ? code : "other");

export default function Seasons() {
  const { t, tx } = useLang();
  const { isAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [types, setTypes] = useState<SeasonType[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = {
    year: new Date().getFullYear(),
    season_type_id: "",
    name: "",
    fiscal_year: "",
    start_date: "",
    end_date: "",
    due_date: "",
    status: "active",
  };
  const [form, setForm] = useState<any>(emptyForm);

  function openEdit(s: any) {
    setEditId(s.id);
    setForm({
      year: s.year ?? new Date().getFullYear(),
      season_type_id: s.season_type_id ?? "",
      name: s.name ?? "",
      fiscal_year: s.fiscal_year ?? "",
      start_date: s.start_date ?? "",
      end_date: s.end_date ?? "",
      due_date: s.due_date ?? "",
      status: s.status ?? "active",
    });
    setOpen(true);
  }

  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesSeason, setRatesSeason] = useState<any | null>(null);
  const [cfOpen, setCfOpen] = useState(false);
  const [cfSeason, setCfSeason] = useState<any | null>(null);

  useEffect(() => {
    document.title = `${t("seasons")} — ${t("appName")}`;
    load();
  }, []);

  async function load() {
    const [{ data: s }, { data: st }] = await Promise.all([
      db
        .from("seasons")
        .select("*, irrigation_season_types:season_type_id(id,code,name,name_bn)")
        .order("year", { ascending: false }),
      db
        .from("irrigation_season_types" as any)
        .select("id,code,name,name_bn")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order"),
    ]);
    setList(s ?? []);
    setTypes((st as any) ?? []);
  }

  async function save() {
    if (!form.season_type_id) return toast.error(tx("Choose a season type", "সিজন টাইপ বাছাই করুন"));
    const stype = types.find((x) => x.id === form.season_type_id);
    if (!stype) return toast.error(tx("Invalid type", "অবৈধ টাইপ"));
    const payload: any = {
      year: form.year,
      type: toEnum(stype.code),
      season_type_id: form.season_type_id,
      name: form.name || `${stype.name_bn || stype.name} ${form.year}`,
      fiscal_year: form.fiscal_year || `${form.year}-${form.year + 1}`,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      due_date: form.due_date || null,
      status: form.status,
    };
    const { error } = editId
      ? await db.from("seasons").update(payload).eq("id", editId)
      : await db.from("seasons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
    load();
  }

  async function del(id: string) {
    const { error } = await db.from("seasons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  // #14/#3 — prefill a new 6-month season continuing from the latest season.
  function generateNext() {
    const addMonths = (iso: string, m: number) => {
      const d = new Date(iso); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10);
    };
    const latest = list[0];
    let start = new Date().toISOString().slice(0, 10);
    if (latest?.end_date) start = addMonths(latest.end_date, 0);
    const end = addMonths(start, 6);
    const year = new Date(start).getFullYear();
    setForm({
      year,
      season_type_id: types[0]?.id ?? "",
      name: "",
      fiscal_year: `${year}-${year + 1}`,
      start_date: start,
      end_date: end,
      due_date: end,
      status: "active",
    });
    setOpen(true);
  }


  return (
    <>
      <PageHeader
        title={t("seasons")}
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <div className="inline-flex gap-2">
                <Button variant="outline" onClick={generateNext}>
                  <Plus className="h-4 w-4 mr-1" />{tx("Generate next (6 months)", "নতুন সিজন অটো (৬ মাস)")}
                </Button>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button>
                </DialogTrigger>
              </div>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t("addNew")} — {t("seasons")}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tx("Season type", "সিজন টাইপ")}</Label>
                    <Select value={form.season_type_id} onValueChange={(v) => setForm({ ...form, season_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {types.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name_bn || s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("year")}</Label>
                    <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>{tx("Name", "নাম")}</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tx("e.g. Boro 2026", "উদাহরণ: বোরো ২০২৬")} />
                  </div>
                  <div>
                    <Label>{tx("Fiscal year", "অর্থবছর")}</Label>
                    <Input value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })} placeholder={`${form.year}-${form.year + 1}`} />
                  </div>
                  <div>
                    <Label>{tx("Status", "স্ট্যাটাস")}</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{tx("Active", "সক্রিয়")}</SelectItem>
                        <SelectItem value="closed">{tx("Closed", "বন্ধ")}</SelectItem>
                        <SelectItem value="draft">{tx("Draft", "খসড়া")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tx("Start date", "শুরুর তারিখ")}</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>{tx("End date", "শেষের তারিখ")}</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>{tx("Invoice due date", "ইনভয়েস মেয়াদ (Due Date)")}</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button onClick={save}>{t("save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Season", "সিজন")}</TableHead>
              <TableHead>{tx("Fiscal year", "অর্থবছর")}</TableHead>
              <TableHead>{tx("Due", "মেয়াদ")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "কাজ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => {
              const label = s.irrigation_season_types?.name_bn || s.irrigation_season_types?.name || s.name || t(s.type as any);
              return (
                <TableRow key={s.id}>
                  <TableCell>{label} <span className="text-muted-foreground">{s.year}</span></TableCell>
                  <TableCell>{s.fiscal_year ?? "—"}</TableCell>
                  <TableCell>{s.due_date ?? "—"}</TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="inline-flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => { setCfSeason(s); setCfOpen(true); }}>
                          <History className="h-3.5 w-3.5 mr-1" /> {tx("Carry-forward dues", "বকেয়া carry-forward")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRatesSeason(s); setRatesOpen(true); }}>
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> {tx("Rate config", "রেট কনফিগ")}
                        </Button>
                        <DeleteButton onConfirm={() => del(s.id)} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">{t("noData")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <SeasonRatesDialog open={ratesOpen} onOpenChange={setRatesOpen} season={ratesSeason} />
      <CarryForwardDialog open={cfOpen} onOpenChange={setCfOpen} season={cfSeason} />
    </>
  );
}

function SeasonRatesDialog({ open, onOpenChange, season }: { open: boolean; onOpenChange: (v: boolean) => void; season: any }) {
  const { tx } = useLang();
  const [landTypes, setLandTypes] = useState<LandType[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({}); // land_type_id -> rate
  const [bases, setBases] = useState<Record<string, string>>({}); // land_type_id -> calculation_basis
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !season?.id) return;
    (async () => {
      const [{ data: lt }, { data: rs }] = await Promise.all([
        db.from("land_types" as any).select("id,code,name,name_bn").eq("is_active", true).is("deleted_at", null).order("sort_order"),
        db.from("irrigation_season_rates" as any).select("land_type_id,rate_per_shotok,calculation_basis").eq("irrigation_season_id", season.id).is("office_id", null),
      ]);
      setLandTypes((lt as any) ?? []);
      const m: Record<string, number> = {};
      const b: Record<string, string> = {};
      for (const r of (rs as any[]) ?? []) {
        m[r.land_type_id] = Number(r.rate_per_shotok);
        b[r.land_type_id] = r.calculation_basis ?? "per_shotok";
      }
      setRates(m);
      setBases(b);
    })();
  }, [open, season?.id]);

  async function save() {
    if (!season?.id) return;
    setBusy(true);
    try {
      const rows = landTypes.map((lt) => ({
        irrigation_season_id: season.id,
        land_type_id: lt.id,
        rate_per_shotok: Number(rates[lt.id] ?? 0),
        calculation_basis: bases[lt.id] ?? "per_shotok",
        office_id: null,
      }));
      await db.from("irrigation_season_rates" as any).delete().eq("irrigation_season_id", season.id).is("office_id", null);
      const { error } = await db.from("irrigation_season_rates" as any).insert(rows);
      if (error) throw error;
      toast.success(tx("Rates saved — only new invoices will be affected.", "রেট সংরক্ষিত হয়েছে — শুধুমাত্র নতুন ইনভয়েসে প্রভাব পড়বে।"));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const seasonLabel = season ? `${season.irrigation_season_types?.name_bn || season.irrigation_season_types?.name || season.name || season.type} ${season.year}` : "";
  const total = landTypes.reduce((s, lt) => s + (Number(rates[lt.id]) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{seasonLabel} — {tx("Rate per shotok", "শতক প্রতি রেট")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {tx("Rate per land type. Existing invoices will not be affected (snapshot).", "প্রতি জমির ধরন অনুযায়ী রেট। পুরোনো ইনভয়েসে রেট পরিবর্তনের কোনো প্রভাব পড়বে না (snapshot)।")}
        </p>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {landTypes.map((lt) => (
            <div key={lt.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Label>{lt.name_bn || lt.name}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="w-24"
                value={rates[lt.id] ?? 0}
                onChange={(e) => setRates({ ...rates, [lt.id]: Number(e.target.value) })}
              />
              <Select value={bases[lt.id] ?? "per_shotok"} onValueChange={(v) => setBases({ ...bases, [lt.id]: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_shotok">{tx("per shotok", "প্রতি শতক")}</SelectItem>
                  <SelectItem value="per_bigha">{tx("per bigha", "প্রতি বিঘা")}</SelectItem>
                  <SelectItem value="flat">{tx("flat fee", "নির্দিষ্ট ফি")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          {landTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">{tx("No land types — add from Irrigation Settings → Land Types.", "কোনো জমির ধরন নেই — সেচ সেটিংস → জমির ধরন থেকে যোগ করুন।")}</p>
          )}
        </div>
        {landTypes.length > 0 && (
          <div className="text-xs text-muted-foreground">{tx("Total configured rate", "মোট কনফিগারড রেট")}: {total.toFixed(2)}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={busy || landTypes.length === 0}>{busy ? "…" : tx("Save", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Shows outstanding dues from EARLIER seasons that carry forward into the selected season.
// Read-only summary (arrears already carry automatically in payment) + PDF export.
function CarryForwardDialog({ open, onOpenChange, season }: { open: boolean; onOpenChange: (v: boolean) => void; season: any }) {
  const { tx } = useLang();
  const [rows, setRows] = useState<Array<{ farmer: string; code: string; due: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !season?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await db
          .from("irrigation_invoices")
          .select("farmer_id,due_amount,seasons(year),farmers(name_en,name_bn,farmer_code)")
          .neq("invoice_status", "cancelled")
          .gt("due_amount", 0);
        const targetYear = Number(season.year) || 0;
        const byFarmer = new Map<string, { farmer: string; code: string; due: number }>();
        for (const r of (data as any[]) ?? []) {
          const yr = Number(r.seasons?.year) || 0;
          if (yr >= targetYear) continue; // only earlier seasons carry forward
          const key = r.farmer_id;
          const name = r.farmers?.name_bn || r.farmers?.name_en || "—";
          const cur = byFarmer.get(key) ?? { farmer: name, code: r.farmers?.farmer_code ?? "", due: 0 };
          cur.due += Number(r.due_amount || 0);
          byFarmer.set(key, cur);
        }
        setRows(Array.from(byFarmer.values()).filter(r => r.due > 0).sort((a, b) => b.due - a.due));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, season?.id, season?.year]);

  const total = rows.reduce((s, r) => s + r.due, 0);
  const seasonLabel = season ? `${season.irrigation_season_types?.name_bn || season.irrigation_season_types?.name || season.name || season.type} ${season.year}` : "";

  function exportPdf() {
    exportTablePDF(`বকেয়া carry-forward — ${seasonLabel}`, ["কৃষক", "কোড", "বকেয়া"],
      [...rows.map(r => [r.farmer, r.code, r.due]), ["মোট", "", total]]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{seasonLabel} — {tx("Carry-forward dues", "বকেয়া carry-forward")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {tx("Outstanding dues from earlier seasons that carry into this season. These already appear automatically in payment/dues.",
            "আগের সিজনের যে বকেয়া এই সিজনে carry-forward হবে। পেমেন্ট/বকেয়া তালিকায় এগুলো স্বয়ংক্রিয়ভাবে দেখায়।")}
        </p>
        <div className="max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">…</TableCell></TableRow>}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">{tx("No carry-forward dues", "কোনো বকেয়া নেই")}</TableCell></TableRow>}
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.farmer}</TableCell>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{money(r.due)}</TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/60 font-bold">
                  <TableCell colSpan={2} className="text-right">{tx("Total", "মোট")}</TableCell>
                  <TableCell className="text-right text-destructive">{money(total)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Close", "বন্ধ")}</Button>
          <Button onClick={exportPdf} disabled={rows.length === 0}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
