// Read-only helper used by e2e tests to assert ledger consistency after deletes.
// Auth: any logged-in user (RLS still applies on row reads).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (cErr || !claims?.claims?.sub) return err(401, "Unauthorized");

    const body = await req.json().catch(() => ({}));
    const refType = body?.reference_type ? String(body.reference_type) : null;
    const refId = body?.reference_id ? String(body.reference_id) : null;

    // Lingering ledger entries for the (refType, refId) the caller deleted.
    let lingering: any[] = [];
    if (refType && refId) {
      const { data } = await admin
        .from("ledger_entries")
        .select("id, debit, credit, account_id, entry_date")
        .eq("reference_type", refType)
        .eq("reference_id", refId);
      lingering = data ?? [];
    }

    // Global ledger health (uses existing SQL helper functions).
    const [orphans, unbalanced] = await Promise.all([
      admin.rpc("ledger_orphan_refs"),
      admin.rpc("ledger_unbalanced_refs"),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      lingering_count: lingering.length,
      lingering,
      orphan: orphans.data ?? [],
      unbalanced: unbalanced.data ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ledger-check error", e);
    return err(500, "Server error");
  }
});
