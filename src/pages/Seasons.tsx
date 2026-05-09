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
import { Plus, DollarSign } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { DeleteButton } from "@/components/ui/action-icon-button";

type SeasonType = { id: string; code: string; name: string; name_bn: string | null };
type FieldType = { id: string; code: string; name: string; name_bn: string | null };

// Map any custom code to legacy enum value (for backward compat).
const ENUM_VALUES = new Set(["aman", "boro", "iri", "other"]);
const toEnum = (code: string) => (ENUM_VALUES.has(code) ? code : "other");

export default function Seasons() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [types, setTypes] = useState<SeasonType[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ year: new Date().getFullYear(), season_type_id: "", name: "" });

  // Rates dialog
  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesSeason, setRatesSeason] = useState<any | null>(null);

  useEffect(() => {
    document.title = `${t("seasons")} — ${t("appName")}`;
    load();
  }, []);

  async function load() {
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase.from("seasons").select("*, season_types(id,code,name,name_bn)").order("year", { ascending: false }),
      supabase.from("season_types" as any).select("id,code,name,name_bn").eq("is_active", true).order("sort_order"),
    ]);
    setList(s ?? []);
    setTypes((st as any) ?? []);
  }

  async function save() {
    if (!form.season_type_id) return toast.error("সিজন টাইপ বাছাই করুন");
    const stype = types.find((x) => x.id === form.season_type_id);
    if (!stype) return toast.error("অবৈধ টাইপ");
    const payload: any = {
      year: form.year,
      type: toEnum(stype.code),
      season_type_id: form.season_type_id,
      name: form.name || `${stype.name_bn || stype.name} ${form.year}`,
    };
    const { error } = await supabase.from("seasons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    setForm({ year: new Date().getFullYear(), season_type_id: "", name: "" });
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
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("addNew")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {t("addNew")} — {t("seasons")}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>{t("year")}</Label>
                    <Input
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: +e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>সিজন টাইপ</Label>
                    <Select
                      value={form.season_type_id}
                      onValueChange={(v) => setForm({ ...form, season_type_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {types.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name_bn || s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      নতুন টাইপ যোগ করতে: Admin → সিজন ও জমির ধরন
                    </p>
                  </div>
                  <div>
                    <Label>{t("name")}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="optional"
                    />
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
              <TableHead>{t("year")}</TableHead>
              <TableHead>{t("season")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => {
              const label = s.season_types?.name_bn || s.season_types?.name || t(s.type as any);
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.year}</TableCell>
                  <TableCell>{label}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="inline-flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRatesSeason(s); setRatesOpen(true); }}
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> রেট
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
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <SeasonRatesDialog
        open={ratesOpen}
        onOpenChange={setRatesOpen}
        season={ratesSeason}
      />
    </>
  );
}

// ============================================================
// Per-season per-field-type rate matrix dialog
// ============================================================
function SeasonRatesDialog({ open, onOpenChange, season }: { open: boolean; onOpenChange: (v: boolean) => void; season: any }) {
  const [fieldTypes, setFieldTypes] = useState<FieldType[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !season?.id) return;
    (async () => {
      const [{ data: ft }, { data: rs }] = await Promise.all([
        supabase.from("field_types" as any).select("id,code,name,name_bn").eq("is_active", true).order("sort_order"),
        supabase.from("season_field_rates" as any).select("field_type_code,rate_per_shotok,office_id").eq("season_id", season.id).is("office_id", null),
      ]);
      setFieldTypes((ft as any) ?? []);
      const m: Record<string, number> = {};
      for (const r of (rs as any[]) ?? []) m[r.field_type_code] = Number(r.rate_per_shotok);
      setRates(m);
    })();
  }, [open, season?.id]);

  async function save() {
    if (!season?.id) return;
    setBusy(true);
    try {
      const rows = fieldTypes.map((ft) => ({
        season_id: season.id,
        field_type_code: ft.code,
        rate_per_shotok: Number(rates[ft.code] ?? 0),
        office_id: null,
      }));
      // Delete existing globals then re-insert (simpler than upsert with composite null key).
      await supabase.from("season_field_rates" as any).delete().eq("season_id", season.id).is("office_id", null);
      const { error } = await supabase.from("season_field_rates" as any).insert(rows);
      if (error) throw error;
      toast.success("রেট সংরক্ষিত হয়েছে");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const seasonLabel = season ? `${season.season_types?.name_bn || season.season_types?.name || season.type} ${season.year}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{seasonLabel} — শতক প্রতি রেট</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          জমির ধরন অনুযায়ী শতক প্রতি কত টাকা — এটি ইনভয়েস তৈরিতে ব্যবহার হবে।
        </p>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {fieldTypes.map((ft) => (
            <div key={ft.id} className="grid grid-cols-2 gap-3 items-center">
              <Label>{ft.name_bn || ft.name}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rates[ft.code] ?? 0}
                onChange={(e) => setRates({ ...rates, [ft.code]: Number(e.target.value) })}
              />
            </div>
          ))}
          {fieldTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">কোনো জমির ধরন নেই — Admin → সিজন ও জমির ধরন থেকে যোগ করুন।</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={save} disabled={busy || fieldTypes.length === 0}>{busy ? "…" : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
