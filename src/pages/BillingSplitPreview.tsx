// Irrigation Billing Split Preview (read-only).
// Lets Admin/Super-Admin verify how a farmer's irrigation charge is split
// between the owner (remainder area) and each sharecropper (borga area)
// BEFORE generating invoices or taking payments. No data is written here.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermissions } from "@/lib/permissions";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { resolveBillingSplits } from "@/lib/irrigationInvoice";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";

const sb = supabase as any;

type SeasonLite = { id: string; name: string; year: number | null; type: string | null };
type LandLite = {
  id: string; dag_no: string | null; mouza: string | null; land_size: number | null;
  field_type: string | null; land_type_id: string | null; office_id: string | null;
};
type SplitRow = {
  land: LandLite;
  rate: number;
  rateLabel: string;
  total: number;
  splits: { farmer_id: string; name: string; is_borga: boolean; area: number; charge: number }[];
};

export default function BillingSplitPreview() {
  const { tx } = useLang();
  const { isAdmin } = useAuth();
  const { can } = usePermissions();
  const allowed = isAdmin && can("irrigation");

  const [seasons, setSeasons] = useState<SeasonLite[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sb.from("seasons").select("id,name,year,type").order("year", { ascending: false })
      .then(({ data }: any) => setSeasons(data ?? []));
  }, []);

  const asOf = new Date().toISOString().slice(0, 10);

  async function run() {
    if (!seasonId) return toast.error(tx("Select a season", "একটি মৌসুম নির্বাচন করুন"));
    if (!farmerId) return toast.error(tx("Select a farmer", "একজন কৃষক নির্বাচন করুন"));
    setLoading(true);
    try {
      // Owner lands for this farmer (active, self-owned)
      const { data: lands, error } = await sb.from("lands")
        .select("id,dag_no,mouza,land_size,field_type,land_type_id,office_id")
        .eq("farmer_id", farmerId)
        .eq("owner_type", "owner")
        .is("deleted_at", null);
      if (error) throw error;
      const landList = (lands ?? []) as LandLite[];

      const officeId = landList[0]?.office_id ?? null;
      const rateMap: RateRow[] = await loadSeasonRateMap(seasonId, officeId);

      const out: SplitRow[] = [];
      const farmerIds = new Set<string>();
      const perLandSplits: { land: LandLite; rate: number; rateLabel: string; raw: any[] }[] = [];

      for (const land of landList) {
        const splits = await resolveBillingSplits(land.id, asOf);
        const matched = resolveRateForLand(rateMap, land);
        const rate = matched?.rate_per_shotok ?? 0;
        splits.forEach((s) => farmerIds.add(s.billed_farmer_id));
        perLandSplits.push({ land, rate, rateLabel: matched?.land_type_name ?? "—", raw: splits });
      }

      // Resolve names for all billed farmers in one query
      const nameMap: Record<string, string> = {};
      if (farmerIds.size) {
        const { data: fs } = await sb.from("farmers")
          .select("id,name_bn,name_en").in("id", [...farmerIds]);
        (fs ?? []).forEach((f: any) => { nameMap[f.id] = f.name_bn || f.name_en || f.id; });
      }

      for (const p of perLandSplits) {
        const splitRows = p.raw.map((s: any) => ({
          farmer_id: s.billed_farmer_id,
          name: nameMap[s.billed_farmer_id] ?? s.billed_farmer_id,
          is_borga: !!s.is_borga,
          area: Number(s.billed_area) || 0,
          charge: (Number(s.billed_area) || 0) * p.rate,
        }));
        out.push({
          land: p.land,
          rate: p.rate,
          rateLabel: p.rateLabel,
          total: splitRows.reduce((a, r) => a + r.charge, 0),
          splits: splitRows,
        });
      }
      setRows(out);
      if (!out.length) toast.info(tx("No owner lands found for this farmer", "এই কৃষকের নিজের কোনো জমি পাওয়া যায়নি"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  const grand = useMemo(() => rows.reduce((a, r) => a + r.total, 0), [rows]);
  const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  if (!allowed) {
    return (
      <div className="container mx-auto p-4">
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          {tx("You do not have permission to view this page.", "এই পেজ দেখার অনুমতি আপনার নেই।")}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {tx("Billing Split Preview", "বিলিং স্প্লিট প্রিভিউ")}
          </CardTitle>
          <CardDescription>
            {tx("Preview how irrigation charges split between the owner (remaining area) and each sharecropper (borga area). This is read-only — nothing is saved.",
              "মালিক (অবশিষ্ট অংশ) ও প্রতিটি বর্গাদারের (বর্গা অংশ) মধ্যে সেচ চার্জ কীভাবে ভাগ হবে তা দেখুন। এটি শুধু প্রিভিউ — কিছুই সংরক্ষণ হয় না।")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>{tx("Season", "মৌসুম")}</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder={tx("Select season", "মৌসুম নির্বাচন")} /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.year ? ` (${s.year})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{tx("Farmer", "কৃষক")}</Label>
              <FarmerSearchSelect value={farmerId} onChange={(id) => setFarmerId(id)}
                placeholder={tx("Search farmer", "কৃষক খুঁজুন")} />
            </div>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
            {tx("Preview Split", "স্প্লিট দেখুন")}
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tx("Estimated charges", "আনুমানিক চার্জ")}: {money(grand)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((r) => {
              const borgaArea = r.splits.filter((s) => s.is_borga).reduce((a, s) => a + s.area, 0);
              const ownerArea = r.splits.filter((s) => !s.is_borga).reduce((a, s) => a + s.area, 0);
              return (
                <div key={r.land.id} className="rounded border">
                  <div className="bg-muted px-3 py-2 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center">
                    <span className="font-semibold">{tx("Dag", "দাগ")} {r.land.dag_no ?? "—"}</span>
                    <span className="text-muted-foreground">{r.land.mouza ?? "—"}</span>
                    <span>{tx("Total", "মোট")}: <b>{money(Number(r.land.land_size) || 0)}</b> {tx("shotok", "শতক")}</span>
                    <span>{tx("Owner", "মালিক")}: <b>{money(ownerArea)}</b></span>
                    <span>{tx("Borga", "বর্গা")}: <b>{money(borgaArea)}</b></span>
                    <span className="text-muted-foreground">{tx("Rate", "রেট")}: {money(r.rate)}/{tx("shotok", "শতক")} ({r.rateLabel})</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">{tx("Billed to", "যাকে বিল")}</th>
                        <th className="p-2 text-left">{tx("Type", "ধরন")}</th>
                        <th className="p-2 text-right">{tx("Area (shotok)", "পরিমাণ (শতক)")}</th>
                        <th className="p-2 text-right">{tx("Charge", "চার্জ")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.splits.map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{s.name}</td>
                          <td className="p-2">
                            <Badge variant={s.is_borga ? "secondary" : "outline"}>
                              {s.is_borga ? tx("Sharecropper", "বর্গাদার") : tx("Owner", "মালিক")}
                            </Badge>
                          </td>
                          <td className="p-2 text-right">{money(s.area)}</td>
                          <td className="p-2 text-right">{money(s.charge)}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-semibold bg-muted/40">
                        <td className="p-2" colSpan={3}>{tx("Land total", "জমির মোট")}</td>
                        <td className="p-2 text-right">{money(r.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
