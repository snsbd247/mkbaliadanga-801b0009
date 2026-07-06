// Missing season/land-type rates diagnostic API.
// Given a season (and optional office + selected land-type filter), returns the
// exact list of land types that have NO configured irrigation rate for that
// season — the same gap the invoice Preview reports. Enforces authentication
// and office-level authorization, and returns bilingual errors.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface BilingualError { field: string; en: string; bn: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const season_id = String(body?.season_id ?? url.searchParams.get("season_id") ?? "").trim();
    const office_id = String(body?.office_id ?? url.searchParams.get("office_id") ?? "").trim() || null;
    const selectedRaw = body?.land_type_ids ?? url.searchParams.get("land_type_ids");
    const selected: string[] = Array.isArray(selectedRaw)
      ? selectedRaw.map(String)
      : (typeof selectedRaw === "string" && selectedRaw ? selectedRaw.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const errors: BilingualError[] = [];
    if (!season_id) errors.push({ field: "season_id", en: "Season is required.", bn: "সিজন নির্বাচন আবশ্যক।" });
    if (errors.length) return json({ errors }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate caller.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: { en: "Unauthorized", bn: "অননুমোদিত" } }, 401);

    // Office-level authorization.
    const { data: profile } = await supabase
      .from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    const userOffice = (profile as any)?.office_id ?? null;
    if (userOffice && office_id && userOffice !== office_id) {
      return json({ error: { en: "You can only view rates for your assigned office.", bn: "আপনি কেবল আপনার নির্ধারিত অফিসের রেট দেখতে পারবেন।" } }, 403);
    }

    // All active land types.
    const { data: landTypes } = await supabase
      .from("land_types")
      .select("id, code, name, name_bn");
    const types = ((landTypes as any[]) ?? []);

    // Configured season rates (office-scoped overrides globals).
    const { data: rateRows } = await supabase
      .from("irrigation_season_rates")
      .select("land_type_id, rate_per_shotok, office_id")
      .eq("irrigation_season_id", season_id);
    const configured = new Map<string, number>();
    for (const r of ((rateRows as any[]) ?? []).filter((x) => x.office_id === null)) configured.set(r.land_type_id, Number(r.rate_per_shotok));
    if (office_id) for (const r of ((rateRows as any[]) ?? []).filter((x) => x.office_id === office_id)) configured.set(r.land_type_id, Number(r.rate_per_shotok));

    const scope = selected.length ? types.filter((t) => selected.includes(t.id)) : types;
    const missing = scope
      .filter((t) => !(Number(configured.get(t.id)) > 0))
      .map((t) => ({
        land_type_id: t.id,
        land_type_code: t.code ?? "",
        land_type_name: t.name_bn || t.name || t.code || "",
      }));

    return json({
      season_id,
      office_id,
      total_land_types: scope.length,
      configured_count: scope.length - missing.length,
      missing_count: missing.length,
      missing,
    });
  } catch (e) {
    return json({ error: { en: (e as Error).message, bn: "সার্ভার ত্রুটি" } }, 500);
  }
});
