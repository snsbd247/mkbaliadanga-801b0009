/**
 * Auto land-change remark generator.
 * Compares a new land_history entry with the most recent prior entry for the
 * same farmer; if mouza / dag / land_size / owner_type / cultivator changes,
 * builds a Bengali remark prefix the caller can prepend to the user remark.
 */
import { supabase } from "@/integrations/supabase/client";

export type LandHistoryRow = {
  fiscal_year: number;
  mouza?: string | null;
  dag_no?: string | null;
  land_size?: number | null;
  owner_type?: string | null;
  cultivator_farmer_id?: string | null;
};

export async function buildAutoLandChangeRemark(
  farmerId: string,
  next: LandHistoryRow,
): Promise<string> {
  const { data } = await supabase
    .from("land_history")
    .select("fiscal_year,mouza,dag_no,land_size,owner_type,cultivator_farmer_id")
    .eq("farmer_id", farmerId)
    .order("fiscal_year", { ascending: false })
    .limit(1);
  const prev = (data ?? [])[0] as LandHistoryRow | undefined;
  if (!prev) return "";
  const yearGap = Math.max(0, Number(next.fiscal_year) - Number(prev.fiscal_year));
  if (yearGap < 1) return "";
  const diffs: string[] = [];
  if ((prev.mouza ?? "") !== (next.mouza ?? "")) diffs.push(`মৌজা: "${prev.mouza ?? "—"}" → "${next.mouza ?? "—"}"`);
  if ((prev.dag_no ?? "") !== (next.dag_no ?? "")) diffs.push(`দাগ: "${prev.dag_no ?? "—"}" → "${next.dag_no ?? "—"}"`);
  const psize = Number(prev.land_size || 0);
  const nsize = Number(next.land_size || 0);
  if (Math.abs(psize - nsize) > 0.001) diffs.push(`জমি: ${psize.toFixed(2)} → ${nsize.toFixed(2)} শতক`);
  if ((prev.owner_type ?? "") !== (next.owner_type ?? "")) diffs.push(`মালিকানা: ${prev.owner_type ?? "—"} → ${next.owner_type ?? "—"}`);
  if ((prev.cultivator_farmer_id ?? "") !== (next.cultivator_farmer_id ?? "")) diffs.push("চাষকারী পরিবর্তিত");
  if (!diffs.length) return "";
  return `[স্বয়ংক্রিয়: জমি পরিবর্তন (${yearGap} বছর পর) — ${diffs.join("; ")}]`;
}
