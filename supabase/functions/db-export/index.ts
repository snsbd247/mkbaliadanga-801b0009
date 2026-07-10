// Edge Function: db-export
// Returns a SQL dump (data-only INSERTs) of all public tables.
// Auth: caller must be authenticated AND have the `developer` role.
// (Falls back to x-cron-secret header for CLI/scripted use.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ColumnMeta = { data_type?: string; udt_name?: string };

function sqlString(v: unknown): string {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function pgArrayType(udtName?: string): string {
  if (!udtName?.startsWith("_")) return "text[]";
  const element = udtName.slice(1);
  const aliases: Record<string, string> = {
    int2: "smallint",
    int4: "integer",
    int8: "bigint",
    float4: "real",
    float8: "double precision",
    bool: "boolean",
    timestamptz: "timestamptz",
  };
  return `${aliases[element] ?? element}[]`;
}

function sqlLiteral(v: unknown, column?: ColumnMeta): string {
  if (v === null || v === undefined) return "NULL";
  if (column?.data_type === "ARRAY") {
    const arrayType = pgArrayType(column.udt_name);
    if (!Array.isArray(v) || v.length === 0) return `'{}'::${arrayType}`;
    const items = v.map((item) => sqlLiteral(item)).join(", ");
    return `ARRAY[${items}]::${arrayType}`;
  }
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (column?.data_type === "jsonb" || column?.udt_name === "jsonb") {
    return `${sqlString(JSON.stringify(v))}::jsonb`;
  }
  if (column?.data_type === "json" || column?.udt_name === "json") {
    return `${sqlString(JSON.stringify(v))}::json`;
  }
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return sqlString(v);
}

async function fetchAllRows(supabase: any, table: string): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  // --- Authorization: either developer JWT OR cron secret ---
  let authorized = false;
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    authorized = true;
  } else {
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claims } = await userClient.auth.getClaims(token);
      if (claims?.claims?.sub) {
        const { data: roleRow } = await userClient
          .from("user_roles")
          .select("role")
          .eq("user_id", claims.claims.sub)
          .eq("role", "developer")
          .maybeSingle();
        if (roleRow) authorized = true;
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "data").toLowerCase();
  if (!["data"].includes(mode)) {
    return new Response(
      JSON.stringify({ error: "Only mode=data is currently supported" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Discover tables via helper RPC
    const { data: tList, error: lErr } = await supabase
      .rpc("pg_tables_public_list");
    if (lErr) throw lErr;
    const tables: string[] = (tList ?? []).map((r: any) => r.tablename);

    const { data: cList, error: cErr } = await supabase
      .rpc("pg_public_table_columns");
    if (cErr) throw cErr;
    const columnTypes = new Map<string, Map<string, ColumnMeta>>();
    for (const col of cList ?? []) {
      const tableName = (col as any).table_name;
      const columnName = (col as any).column_name;
      if (!columnTypes.has(tableName)) columnTypes.set(tableName, new Map());
      columnTypes.get(tableName)!.set(columnName, {
        data_type: (col as any).data_type,
        udt_name: (col as any).udt_name,
      });
    }

    if (tables.length === 0) {
      return new Response(JSON.stringify({ error: "No tables found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sql = "";
    sql += `-- Lovable Cloud database export (data-only, full)\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Tables: ${tables.length}\n`;
    sql += `-- Restore via the app's "Full SQL Restore" — it wraps this file in a\n`;
    sql += `-- transaction, drops foreign keys, loads data, and re-adds them.\n\n`;

    sql += `-- Clear existing data (order-independent; CASCADE handles dependents)\n`;
    for (const t of tables) {
      sql += `TRUNCATE TABLE public."${t}" RESTART IDENTITY CASCADE;\n`;
    }
    sql += `\n`;



    let totalRows = 0;
    for (const table of tables) {
      let rows: any[];
      try {
        rows = await fetchAllRows(supabase, table);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sql += `-- Skipped ${table}: ${message}\n\n`;
        continue;
      }
      if (!rows || rows.length === 0) {
        sql += `-- ${table}: 0 rows\n\n`;
        continue;
      }
      const cols = Object.keys(rows[0]);
      sql += `-- ${table}: ${rows.length} rows\n`;
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const tableColumnTypes = columnTypes.get(table);
      for (const row of rows) {
        const vals = cols
          .map((c) => sqlLiteral((row as any)[c], tableColumnTypes?.get(c)))
          .join(", ");
        sql += `INSERT INTO public."${table}" (${colList}) VALUES (${vals});\n`;
      }
      sql += `\n`;
      totalRows += rows.length;
    }

    sql += `-- Done. Total rows: ${totalRows}\n`;


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
