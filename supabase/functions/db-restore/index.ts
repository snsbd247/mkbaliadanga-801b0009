// Edge Function: db-restore
// Executes a SQL backup file (text/plain body) on the database.
// Auth: caller must be authenticated AND have the `developer` role.
// Body: raw SQL text (Content-Type: application/sql or text/plain)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth — developer role required
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: roleRow } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .eq("role", "developer")
    .maybeSingle();

  if (!roleRow) {
    return new Response(
      JSON.stringify({ error: "Forbidden: developer role required" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Parse SQL body
  const sqlText = await req.text();
  if (!sqlText.trim()) {
    return new Response(JSON.stringify({ error: "Empty SQL body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Execute via service role + SECURITY DEFINER helper
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();
  const errors: string[] = [];

  try {
    // Single-shot execution — Postgres can run multi-statement strings
    const { error } = await adminClient.rpc("exec_sql_admin", {
      sql: sqlText,
    });
    if (error) {
      errors.push(error.message);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const duration = Date.now() - startedAt;

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({
        success: false,
        duration_ms: duration,
        errors,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Audit log
  try {
    await adminClient.from("audit_logs").insert({
      user_id: claims.claims.sub,
      action: "db_restore",
      entity_type: "database",
      entity_id: null,
      details: {
        size_bytes: sqlText.length,
        duration_ms: duration,
      },
    });
  } catch {
    // best-effort audit
  }

  return new Response(
    JSON.stringify({
      success: true,
      duration_ms: duration,
      size_bytes: sqlText.length,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
