import { supabase } from "@/integrations/supabase/client";

export type RateRow = {
  land_type_id: string;
  land_type_code: string;
  land_type_name: string;
  rate_per_shotok: number;
  office_id: string | null;
};

/**
 * Build per-land-type rate map for a season.
 * Office-specific rate overrides global (NULL office_id) rate.
 */
export async function loadSeasonRateMap(season_id: string, office_id?: string | null): Promise<RateRow[]> {
  if (!season_id) return [];
  const { data } = await supabase
    .from("irrigation_season_rates" as any)
    .select("land_type_id, rate_per_shotok, office_id, land_types(id, code, name, name_bn)")
    .eq("irrigation_season_id", season_id);
  const rows = ((data as any[]) ?? []).map((r) => ({
    land_type_id: r.land_type_id,
    land_type_code: r.land_types?.code ?? "",
    land_type_name: r.land_types?.name_bn || r.land_types?.name || r.land_types?.code || "",
    rate_per_shotok: Number(r.rate_per_shotok),
    office_id: r.office_id,
  }));
  // Office-scoped overrides globals → dedupe by land_type_id, prefer office match.
  const map = new Map<string, RateRow>();
  for (const r of rows.filter((x) => x.office_id === null)) map.set(r.land_type_id, r);
  if (office_id) for (const r of rows.filter((x) => x.office_id === office_id)) map.set(r.land_type_id, r);
  return [...map.values()];
}

/** Resolve rate for a land — prefer land.land_type_id then fall back to enum field_type code. */
export function resolveRateForLand(
  rates: RateRow[],
  land: { land_type_id?: string | null; field_type?: string | null },
): RateRow | null {
  if (land.land_type_id) {
    const hit = rates.find((r) => r.land_type_id === land.land_type_id);
    if (hit) return hit;
  }
  if (land.field_type) {
    const hit = rates.find((r) => r.land_type_code === land.field_type);
    if (hit) return hit;
  }
  return rates.find((r) => r.land_type_code === "other") ?? null;
}
