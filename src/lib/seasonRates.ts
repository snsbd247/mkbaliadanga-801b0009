import { supabase } from "@/integrations/supabase/client";

export type SeasonRateRow = {
  id?: string;
  season_id: string;
  field_type_code: string;
  rate_per_shotok: number;
  office_id: string | null;
};

/** Build a map: field_type_code -> rate, scoped to office (office-specific overrides global NULL row). */
export async function loadSeasonRateMap(season_id: string, office_id?: string | null): Promise<Record<string, number>> {
  if (!season_id) return {};
  const { data } = await supabase
    .from("season_field_rates" as any)
    .select("field_type_code, rate_per_shotok, office_id")
    .eq("season_id", season_id);
  const rows = (data as any[]) ?? [];
  const map: Record<string, number> = {};
  // Apply globals first, then office-specific overrides.
  for (const r of rows.filter((r) => r.office_id === null)) map[r.field_type_code] = Number(r.rate_per_shotok);
  if (office_id) {
    for (const r of rows.filter((r) => r.office_id === office_id)) map[r.field_type_code] = Number(r.rate_per_shotok);
  }
  return map;
}

/** Lookup helper used by invoice generation. Returns 0 if no rate is configured. */
export function resolveRate(map: Record<string, number>, field_type: string | null | undefined): number {
  if (!field_type) return map["other"] ?? 0;
  return map[field_type] ?? map["other"] ?? 0;
}
