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
  const rawBody = await req.text();
  const contentType = (req.headers.get("Content-Type") ?? "").toLowerCase();

  // Execute via service role + SECURITY DEFINER helper
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // --- Phased restore (JSON body) --------------------------------------------
  // { phase: "begin" }                → drop & stash FKs, returns { dropped }
  // { phase: "exec", table, sql }     → run one table's TRUNCATE+INSERTs
  // { phase: "commit" }               → re-add FKs, returns { restored }
  // { phase: "verify" }               → returns { counts: [{tablename,row_count}] }
  if (contentType.includes("application/json")) {
    let payload: any;
    try { payload = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phase = String(payload?.phase ?? "");
    try {
      if (phase === "begin") {
        const { data, error } = await adminClient.rpc("admin_restore_begin");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, dropped: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (phase === "exec") {
        const cleaned = String(payload?.sql ?? "")
          .split(/\r?\n/)
          .filter((l) => {
            const s = l.trim().toLowerCase();
            return !(s.startsWith("set session_replication_role") || s === "begin;" || s === "begin" || s === "start transaction;" || s === "commit;" || s === "commit" || s === "end;");
          })
          .join("\n");
        const { error } = await adminClient.rpc("admin_restore_exec", { sql: cleaned });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, table: payload?.table ?? null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (phase === "commit") {
        const { data, error } = await adminClient.rpc("admin_restore_commit");
        if (error) throw error;
        try {
          await adminClient.from("audit_logs").insert({
            user_id: claims.claims.sub, action: "db_restore_commit",
            entity_type: "database", entity_id: null, details: { fks_restored: data },
          });
        } catch { /* best-effort */ }
        return new Response(JSON.stringify({ success: true, restored: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (phase === "verify") {
        const { data, error } = await adminClient.rpc("public_table_row_counts");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, counts: data ?? [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Unknown phase: ${phase}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ success: false, phase, error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // --- Legacy single-shot restore (raw SQL body) -----------------------------
  const sqlText = rawBody;
  if (!sqlText.trim()) {
    return new Response(JSON.stringify({ error: "Empty SQL body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();
  const errors: string[] = [];

  // Sanitize legacy backups: `exec_sql_admin` runs the payload inside a
  // PL/pgSQL function, so transaction-control statements (BEGIN/COMMIT) and the
  // superuser-only `session_replication_role` toggle must be stripped. Foreign
  // keys are handled by the helper itself (dropped, then re-added).
  const cleanSql = sqlText
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim().toLowerCase();
      if (l.startsWith("set session_replication_role")) return false;
      if (l === "begin;" || l === "begin" || l === "start transaction;") return false;
      if (l === "commit;" || l === "commit" || l === "end;") return false;
      return true;
    })
    .join("\n");

  try {
    // Single-shot execution — Postgres can run multi-statement strings
    const { error } = await adminClient.rpc("exec_sql_admin", {
      sql: cleanSql,
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
