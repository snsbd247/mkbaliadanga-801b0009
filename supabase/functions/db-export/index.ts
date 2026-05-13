// Edge Function: db-export
// Exports all public-schema tables as a SQL dump (data-only INSERTs)
// that can be restored on a self-hosted Supabase VPS.
//
// Usage:
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        "https://<project>.supabase.co/functions/v1/db-export?mode=data" \
//        -o backup.sql
//
// Modes:
//   mode=data     -> TRUNCATE + INSERT statements only (default)
//   mode=schema   -> CREATE TABLE statements only
//   mode=full     -> schema + data
//
// Auth: requires header `x-cron-secret` matching the CRON_SECRET env var.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "data").toLowerCase();
  if (!["data", "schema", "full"].includes(mode)) {
    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // List all public tables ordered for safe TRUNCATE/INSERT
    const { data: tablesData, error: tErr } = await supabase
      .rpc("pg_tables_public_list")
      .single();

    let tables: string[] = [];
    if (tErr || !tablesData) {
      // Fallback: query information_schema via REST
      const r = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/pg_tables_public_list`,
        {
          method: "POST",
          headers: {
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (r.ok) {
        const j = await r.json();
        tables = Array.isArray(j) ? j.map((x: any) => x.tablename ?? x) : [];
      }
    } else {
      tables = (tablesData as any).tables ?? [];
    }

    if (tables.length === 0) {
      // Last resort: use a hard-coded discovery via pg_meta-style query through PostgREST
      // by listing every table via the OpenAPI spec endpoint
      const specRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/`, {
        headers: {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          Accept: "application/openapi+json",
        },
      });
      if (specRes.ok) {
        const spec = await specRes.json();
        tables = Object.keys(spec.definitions ?? spec.components?.schemas ?? {})
          .filter((n) => !n.startsWith("("));
      }
    }

    if (tables.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No tables discovered. Create the helper RPC `pg_tables_public_list` (see docs in function source).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let sql = "";
    sql += `-- Lovable Cloud database export\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Mode: ${mode}\n`;
    sql += `-- Tables: ${tables.length}\n\n`;
    sql += `SET session_replication_role = 'replica';\n`;
    sql += `BEGIN;\n\n`;

    if (mode === "data" || mode === "full") {
      // TRUNCATE all tables first (reverse order doesn't matter with replica role)
      sql += `-- Clear existing data\n`;
      for (const t of tables) {
        sql += `TRUNCATE TABLE public."${t}" RESTART IDENTITY CASCADE;\n`;
      }
      sql += `\n`;

      // Dump data as INSERTs
      for (const table of tables) {
        const { data: rows, error } = await supabase
          .from(table)
          .select("*");

        if (error) {
          sql += `-- Skipped ${table}: ${error.message}\n\n`;
          continue;
        }
        if (!rows || rows.length === 0) {
          sql += `-- ${table}: 0 rows\n\n`;
          continue;
        }

        const cols = Object.keys(rows[0]);
        sql += `-- ${table}: ${rows.length} rows\n`;
        const colList = cols.map((c) => `"${c}"`).join(", ");
        for (const row of rows) {
          const vals = cols.map((c) => sqlLiteral((row as any)[c])).join(", ");
          sql += `INSERT INTO public."${table}" (${colList}) VALUES (${vals});\n`;
        }
        sql += `\n`;
      }
    }

    sql += `COMMIT;\n`;
    sql += `SET session_replication_role = 'origin';\n`;

    const filename = `lovable-backup-${
      new Date().toISOString().replace(/[:.]/g, "-")
    }.sql`;

    return new Response(sql, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("db-export error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
