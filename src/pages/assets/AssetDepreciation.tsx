import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Save, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { calcMonthlyDepreciation, generateSchedule, type DepreciationMethod } from "@/lib/assetDepreciation";

type Asset = { id: string; office_id: string | null; asset_code: string; name_en: string; name_bn: string | null; purchase_price: number };
type Setting = {
  id?: string; asset_id: string; office_id: string | null;
  method: DepreciationMethod; useful_life_months: number; salvage_value: number;
  wdv_rate_pct: number; start_on: string; expense_account_code: string; accum_account_code: string; is_active: boolean;
};
type Schedule = {
  id: string; asset_id: string; period_month: string; opening_book_value: number;
  depreciation_amount: number; accumulated_depreciation: number; closing_book_value: number;
  status: "pending" | "posted" | "skipped"; journal_entry_id: string | null; posted_at: string | null;
};

function firstOfThisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }

export default function AssetDepreciation() {
  const { tx } = useLang();
  const { officeId, isAdmin } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState<string>("");
  const [setting, setSetting] = useState<Setting | null>(null);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [period, setPeriod] = useState<string>(firstOfThisMonth());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = tx("Asset Depreciation", "এসেট ডিপ্রেসিয়েশন");
    (async () => {
      const r = await supabase.from("assets" as any).select("id,office_id,asset_code,name_en,name_bn,purchase_price")
        .is("deleted_at", null).order("asset_code");
      if (!r.error) setAssets((r.data as any) || []);
    })();
  }, [tx]);

  useEffect(() => {
    if (!assetId) { setSetting(null); setSchedule([]); return; }
    (async () => {
      const a = assets.find(x => x.id === assetId);
      const cfg = await supabase.from("asset_depreciation_settings" as any).select("*").eq("asset_id", assetId).maybeSingle();
      if (cfg.data) setSetting(cfg.data as any);
      else setSetting({
        asset_id: assetId, office_id: a?.office_id ?? officeId ?? null,
        method: "straight_line", useful_life_months: 60, salvage_value: 0, wdv_rate_pct: 15,
        start_on: firstOfThisMonth(), expense_account_code: "5410", accum_account_code: "1610", is_active: true,
      });
      const s = await supabase.from("asset_depreciation_schedule" as any).select("*")
        .eq("asset_id", assetId).order("period_month");
      if (!s.error) setSchedule((s.data as any) || []);
    })();
  }, [assetId, officeId, assets]);

  const asset = assets.find(a => a.id === assetId);

  const preview = useMemo(() => {
    if (!setting || !asset) return [];
    return generateSchedule({
      method: setting.method, cost: Number(asset.purchase_price || 0),
      salvage: Number(setting.salvage_value || 0),
      usefulLifeMonths: setting.useful_life_months,
      wdvRatePct: setting.wdv_rate_pct,
    }, setting.start_on, Math.min(setting.useful_life_months || 60, 240));
  }, [setting, asset]);

  async function saveSetting() {
    if (!setting || !asset) return;
    setBusy(true);
    try {
      const payload = { ...setting, office_id: setting.office_id ?? officeId ?? null };
      if (setting.id) {
        const { error } = await supabase.from("asset_depreciation_settings" as any).update(payload).eq("id", setting.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("asset_depreciation_settings" as any).insert(payload).select("id").single();
        if (error) throw error;
        setSetting({ ...setting, id: (data as any).id });
      }
      toast.success(tx("Saved", "সংরক্ষিত"));
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function runForPeriod() {
    if (!setting || !asset) return;
    if (!setting.is_active) return toast.error(tx("Depreciation is inactive for this asset", "এই এসেটের ডিপ্রেসিয়েশন নিষ্ক্রিয়"));
    setBusy(true);
    try {
      // Find latest posted/inserted row to derive opening
      const last = schedule.filter(x => x.period_month < period).sort((a,b) => a.period_month.localeCompare(b.period_month)).at(-1);
      const opening = last ? Number(last.closing_book_value) : Number(asset.purchase_price || 0);
      const accum = last ? Number(last.accumulated_depreciation) : 0;
      const r = calcMonthlyDepreciation({
        method: setting.method, cost: Number(asset.purchase_price || 0),
        salvage: Number(setting.salvage_value || 0),
        usefulLifeMonths: setting.useful_life_months, wdvRatePct: setting.wdv_rate_pct,
        openingBookValue: opening, accumulated: accum,
      });

      // Upsert schedule row
      const { data: row, error } = await supabase.from("asset_depreciation_schedule" as any).upsert({
        asset_id: asset.id, office_id: setting.office_id ?? officeId ?? null,
        period_month: period, opening_book_value: opening,
        depreciation_amount: r.depreciation, accumulated_depreciation: r.accumulated,
        closing_book_value: r.closingBookValue,
        status: r.depreciation > 0 ? "pending" : "skipped",
      }, { onConflict: "asset_id,period_month" }).select("*").single();
      if (error) throw error;

      // Post journal pair via RPC
      if ((row as any).status === "pending" && r.depreciation > 0) {
        const { error: rpcErr } = await supabase.rpc("post_asset_depreciation_journal" as any, { _schedule_id: (row as any).id });
        if (rpcErr) throw rpcErr;
      }
      toast.success(tx("Depreciation posted", "ডিপ্রেসিয়েশন পোস্ট হয়েছে"));
      // reload
      const s = await supabase.from("asset_depreciation_schedule" as any).select("*").eq("asset_id", asset.id).order("period_month");
      setSchedule((s.data as any) || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Depreciation", "এসেট ডিপ্রেসিয়েশন")}
        description={tx(
          "Configure straight-line or WDV depreciation per asset and post monthly journal entries automatically.",
          "প্রতিটি এসেটে স্ট্রেইট-লাইন বা WDV ডিপ্রেসিয়েশন কনফিগার করুন এবং মাসিক জার্নাল স্বয়ংক্রিয়ভাবে পোস্ট করুন।"
        )}
      />

      <Card className="p-3 mb-3">
        <Label>{tx("Choose asset", "এসেট নির্বাচন")}</Label>
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger><SelectValue placeholder={tx("Select an asset", "একটি এসেট নির্বাচন করুন")} /></SelectTrigger>
          <SelectContent>
            {assets.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {setting && asset && (
        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">{tx("Config", "কনফিগ")}</TabsTrigger>
            <TabsTrigger value="run">{tx("Run", "চালান")}</TabsTrigger>
            <TabsTrigger value="schedule">{tx("Schedule", "শিডিউল")}</TabsTrigger>
            <TabsTrigger value="preview">{tx("Forecast", "পূর্বাভাস")}</TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <Card className="p-4 grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Method", "পদ্ধতি")}</Label>
                <Select value={setting.method} onValueChange={(v: any) => setSetting({ ...setting, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">{tx("Straight-line", "স্ট্রেইট-লাইন")}</SelectItem>
                    <SelectItem value="wdv">{tx("WDV (declining)", "WDV (অবচয়)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("Start date", "শুরুর তারিখ")}</Label>
                <Input type="date" value={setting.start_on} onChange={e => setSetting({ ...setting, start_on: e.target.value })} />
              </div>
              <div>
                <Label>{tx("Useful life (months)", "ব্যবহারকাল (মাস)")}</Label>
                <Input type="number" min={1} value={setting.useful_life_months} onChange={e => setSetting({ ...setting, useful_life_months: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{tx("Salvage value", "অবশিষ্ট মূল্য")}</Label>
                <Input type="number" min={0} value={setting.salvage_value} onChange={e => setSetting({ ...setting, salvage_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{tx("WDV rate (% / yr)", "WDV হার (% / বছর)")}</Label>
                <Input type="number" min={0} max={100} value={setting.wdv_rate_pct} onChange={e => setSetting({ ...setting, wdv_rate_pct: Number(e.target.value) })} disabled={setting.method !== "wdv"} />
              </div>
              <div>
                <Label>{tx("Active", "সক্রিয়")}</Label>
                <Select value={setting.is_active ? "1" : "0"} onValueChange={v => setSetting({ ...setting, is_active: v === "1" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{tx("Yes", "হ্যাঁ")}</SelectItem>
                    <SelectItem value="0">{tx("No", "না")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("Expense account code", "ব্যয় হিসাব কোড")}</Label>
                <Input value={setting.expense_account_code} onChange={e => setSetting({ ...setting, expense_account_code: e.target.value })} />
              </div>
              <div>
                <Label>{tx("Accumulated account code", "জমাকৃত হিসাব কোড")}</Label>
                <Input value={setting.accum_account_code} onChange={e => setSetting({ ...setting, accum_account_code: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Button onClick={saveSetting} disabled={busy || !isAdmin}>
                  <Save className="h-4 w-4 mr-1" />{tx("Save settings", "সেটিংস সংরক্ষণ")}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="run">
            <Card className="p-4 flex flex-wrap items-end gap-3">
              <div>
                <Label>{tx("Period (month)", "মাস")}</Label>
                <Input type="month" value={period.slice(0,7)} onChange={e => setPeriod(`${e.target.value}-01`)} />
              </div>
              <Button onClick={runForPeriod} disabled={busy || !isAdmin || !setting.id}>
                <Play className="h-4 w-4 mr-1" />{tx("Calculate & post (this asset)", "হিসাব ও পোস্ট (এই এসেট)")}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!isAdmin) return;
                  setBusy(true);
                  try {
                    const { data, error } = await supabase.rpc("run_monthly_depreciation_batch" as any, { _period_month: period });
                    if (error) throw error;
                    const rows = (data as any[]) || [];
                    const summary = rows.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
                    toast.success(tx(`Batch run: ${rows.length} assets`, `ব্যাচ চালান: ${rows.length} এসেট`) + " — " + JSON.stringify(summary));
                    if (assetId) {
                      const s = await supabase.from("asset_depreciation_schedule" as any).select("*").eq("asset_id", assetId).order("period_month");
                      setSchedule((s.data as any) || []);
                    }
                  } catch (e: any) { toast.error(e.message); }
                  finally { setBusy(false); }
                }}
                disabled={busy || !isAdmin}
              >
                <Play className="h-4 w-4 mr-1" />{tx("Run batch for all active assets", "সকল সক্রিয় এসেটের জন্য ব্যাচ চালান")}
              </Button>
              {!setting.id && <span className="text-xs text-muted-foreground">{tx("Save settings first", "প্রথমে সেটিংস সংরক্ষণ করুন")}</span>}
            </Card>
          </TabsContent>


          <TabsContent value="schedule">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Period", "মাস")}</TableHead>
                  <TableHead className="text-right">{tx("Opening", "ওপেনিং")}</TableHead>
                  <TableHead className="text-right">{tx("Depreciation", "ডিপ্রেসিয়েশন")}</TableHead>
                  <TableHead className="text-right">{tx("Accumulated", "জমা")}</TableHead>
                  <TableHead className="text-right">{tx("Closing", "ক্লোজিং")}</TableHead>
                  <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {schedule.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.period_month.slice(0,7)}</TableCell>
                      <TableCell className="text-right">{Number(r.opening_book_value).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.depreciation_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.accumulated_depreciation).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.closing_book_value).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={r.status === "posted" ? "default" : r.status === "skipped" ? "outline" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!schedule.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No periods posted yet", "এখনও কোনো ডিপ্রেসিয়েশন পোস্ট হয়নি")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Calculator className="h-4 w-4" />{tx("Preview based on current settings (not saved)", "বর্তমান সেটিংস অনুসারে পূর্বাভাস (সংরক্ষিত নয়)")}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Period", "মাস")}</TableHead>
                  <TableHead className="text-right">{tx("Depreciation", "ডিপ্রেসিয়েশন")}</TableHead>
                  <TableHead className="text-right">{tx("Closing book value", "ক্লোজিং বুক ভ্যালু")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {preview.map(r => (
                    <TableRow key={r.period}>
                      <TableCell className="font-mono text-xs">{r.period.slice(0,7)}</TableCell>
                      <TableCell className="text-right">{r.depreciation.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.closingBookValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
