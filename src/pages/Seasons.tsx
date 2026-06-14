import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [form, setForm] = useState<any>({
    year: new Date().getFullYear(),
    season_type_id: "",
    name: "",
    fiscal_year: "",
    start_date: "",
    end_date: "",
    due_date: "",
    status: "active",
  });

  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesSeason, setRatesSeason] = useState<any | null>(null);

  useEffect(() => {
    document.title = `${t("seasons")} — ${t("appName")}`;
    load();
  }, []);

  async function load() {
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase
        .from("seasons")
        .select("*, irrigation_season_types:season_type_id(id,code,name,name_bn)")
        .order("year", { ascending: false }),
      supabase
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
    const { error } = await supabase.from("seasons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    setForm({ year: new Date().getFullYear(), season_type_id: "", name: "", fiscal_year: "", start_date: "", end_date: "", due_date: "", status: "active" });
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from("seasons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader
        title={t("seasons")}
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button>
              </DialogTrigger>
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
    </>
  );
}

function SeasonRatesDialog({ open, onOpenChange, season }: { open: boolean; onOpenChange: (v: boolean) => void; season: any }) {
  const { tx } = useLang();
  const [landTypes, setLandTypes] = useState<LandType[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({}); // land_type_id -> rate
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !season?.id) return;
    (async () => {
      const [{ data: lt }, { data: rs }] = await Promise.all([
        supabase.from("land_types" as any).select("id,code,name,name_bn").eq("is_active", true).is("deleted_at", null).order("sort_order"),
        supabase.from("irrigation_season_rates" as any).select("land_type_id,rate_per_shotok").eq("irrigation_season_id", season.id).is("office_id", null),
      ]);
      setLandTypes((lt as any) ?? []);
      const m: Record<string, number> = {};
      for (const r of (rs as any[]) ?? []) m[r.land_type_id] = Number(r.rate_per_shotok);
      setRates(m);
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
        office_id: null,
      }));
      await supabase.from("irrigation_season_rates" as any).delete().eq("irrigation_season_id", season.id).is("office_id", null);
      const { error } = await supabase.from("irrigation_season_rates" as any).insert(rows);
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
            <div key={lt.id} className="grid grid-cols-2 gap-3 items-center">
              <Label>{lt.name_bn || lt.name}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rates[lt.id] ?? 0}
                onChange={(e) => setRates({ ...rates, [lt.id]: Number(e.target.value) })}
              />
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
