import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { money } from "@/lib/format";
import { logAudit } from "@/lib/audit";

type Cat = { id: string; code: string; name_bn: string | null; name_en: string | null; calculation_basis: string };
type Season = { id: string; name: string | null; year: number | null; type: string | null };
type RateRow = {
  id: string;
  irrigation_category_id: string;
  irrigation_season_id: string;
  rate_type: "per_shotok" | "per_bigha" | "flat" | "custom";
  rate: number;
  unit: string | null;
  is_negotiable: boolean;
  office_id: string | null;
  irrigation_categories?: Cat;
};

export default function IrrigationCategoryRates() {
  const { tx } = useLang();
  const { isAdmin, officeId } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [rows, setRows] = useState<RateRow[]>([]);

  // new-row form
  const [catId, setCatId] = useState<string>("");
  const [rateType, setRateType] = useState<RateRow["rate_type"]>("per_shotok");
  const [rate, setRate] = useState<number>(0);
  const [unit, setUnit] = useState<string>("");
  const [negotiable, setNegotiable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = tx("Category rate config", "ক্যাটাগরি রেট কনফিগ");
    Promise.all([
      supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false }),
      supabase.from("irrigation_categories" as any).select("id,code,name_bn,name_en,calculation_basis").is("deleted_at", null).eq("is_active", true).order("code"),
    ]).then(([s, c]) => {
      setSeasons((s.data as any) ?? []);
      setCategories((c.data as any) ?? []);
      const first = (s.data as any)?.[0]?.id;
      if (first) setSeasonId(first);
    });
  }, []);

  useEffect(() => { if (seasonId) loadRates(); }, [seasonId]);

  async function loadRates() {
    const { data, error } = await supabase
      .from("irrigation_category_rates" as any)
      .select("*, irrigation_categories(id,code,name_bn,name_en,calculation_basis)")
      .eq("irrigation_season_id", seasonId);
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }

  const availableCategories = useMemo(
    () => categories.filter((c) => !rows.some((r) => r.irrigation_category_id === c.id)),
    [categories, rows],
  );

  async function addRate() {
    if (!seasonId) return toast.error(tx("Pick a season", "সিজন বাছাই করুন"));
    if (!catId) return toast.error(tx("Pick a category", "ক্যাটাগরি বাছাই করুন"));
    if (!(rate > 0)) return toast.error(tx("Rate must be > 0", "রেট 0-এর বেশি দিন"));
    setSaving(true);
    try {
      const payload: any = {
        office_id: officeId,
        irrigation_season_id: seasonId,
        irrigation_category_id: catId,
        rate_type: rateType,
        rate,
        unit: unit || null,
        is_negotiable: negotiable,
      };
      const { error, data } = await supabase.from("irrigation_category_rates" as any).insert(payload).select("id").maybeSingle();
      if (error) throw error;
      await logAudit({ office_id: officeId, module: "irrigation_invoice", action_type: "create", reference_id: (data as any)?.id, new_data: payload });
      toast.success(tx("Saved", "সংরক্ষিত"));
      setCatId(""); setRate(0); setUnit(""); setNegotiable(false); setRateType("per_shotok");
      loadRates();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  async function updateRow(id: string, patch: Partial<RateRow>) {
    const { error } = await supabase.from("irrigation_category_rates" as any).update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ office_id: officeId, module: "irrigation_invoice", action_type: "update", reference_id: id, new_data: patch as any });
    loadRates();
  }
  async function delRow(id: string) {
    const { error } = await supabase.from("irrigation_category_rates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ office_id: officeId, module: "irrigation_invoice", action_type: "delete", reference_id: id });
    loadRates();
  }

  return (
    <>
      <PageHeader
        title={tx("Category rate configuration", "ক্যাটাগরি রেট কনফিগারেশন")}
        description={tx(
          "Per-season irrigation rate for each category. Falls back to land-type rate when not set.",
          "প্রতি সিজনে প্রতিটি ক্যাটাগরির জন্য সেচ রেট। সেট না থাকলে জমির ধরনের রেট ব্যবহার হবে।",
        )}
      />
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <Label>{tx("Season", "সিজন")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || `${s.type ?? ""} ${s.year ?? ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isAdmin && seasonId && (
          <div className="grid gap-3 md:grid-cols-6 items-end border rounded-md p-3 bg-muted/40">
            <div className="md:col-span-2">
              <Label>{tx("Category", "ক্যাটাগরি")}</Label>
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_bn || c.name_en || c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tx("Rate type", "রেট টাইপ")}</Label>
              <Select value={rateType} onValueChange={(v: any) => setRateType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_shotok">{tx("Per shotok", "প্রতি শতক")}</SelectItem>
                  <SelectItem value="per_bigha">{tx("Per bigha", "প্রতি বিঘা")}</SelectItem>
                  <SelectItem value="flat">{tx("Flat", "ফ্ল্যাট")}</SelectItem>
                  <SelectItem value="custom">{tx("Custom", "কাস্টম")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tx("Rate", "রেট")}</Label>
              <Input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(+e.target.value)} />
            </div>
            <div>
              <Label>{tx("Unit", "একক")}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="৳/শতক" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={negotiable} onCheckedChange={setNegotiable} />
              <span className="text-sm">{tx("Negotiable", "নেগোশিয়েবল")}</span>
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button onClick={addRate} disabled={saving}>{saving ? "…" : tx("Add", "যোগ করুন")}</Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Category", "ক্যাটাগরি")}</TableHead>
              <TableHead>{tx("Rate type", "রেট টাইপ")}</TableHead>
              <TableHead className="text-right">{tx("Rate", "রেট")}</TableHead>
              <TableHead>{tx("Unit", "একক")}</TableHead>
              <TableHead>{tx("Negotiable", "নেগোশিয়েবল")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.irrigation_categories?.name_bn || r.irrigation_categories?.name_en || r.irrigation_categories?.code}</TableCell>
                <TableCell className="text-xs">{r.rate_type}</TableCell>
                <TableCell className="text-right">{money(Number(r.rate))}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.unit || "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={r.is_negotiable}
                    onCheckedChange={(v) => updateRow(r.id, { is_negotiable: v })}
                    disabled={!isAdmin}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && <DeleteButton onConfirm={() => delRow(r.id)} />}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No category rates configured for this season.", "এই সিজনের জন্য কোনো ক্যাটাগরি রেট কনফিগার নেই।")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
