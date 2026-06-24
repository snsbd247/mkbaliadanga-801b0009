#!/usr/bin/env node
/**
 * One-time data migration: Supabase Postgres → Laravel MySQL.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://USER:PASS@HOST:5432/postgres \
 *   MYSQL_URL=mysql://mkb_user:PASS@127.0.0.1:3306/mohammadkhani \
 *     node scripts/migrate-supabase-to-laravel.mjs [--dry-run] [--only=t1,t2]
 *
 * Strategy: read each public.* table from Supabase and INSERT into the matching
 * MySQL table in FK-safe order. Columns that exist in the source but not in the
 * MySQL target are folded into a JSON `extra` column when the target has one.
 * Booleans → 0/1, objects/arrays → JSON strings, ISO timestamps passed through.
 *
 * Requires drivers (dev-only): `npm i pg mysql2`
 */

import pg from "pg";
import mysql from "mysql2/promise";

const SRC = process.env.SUPABASE_DB_URL;
const DST = process.env.MYSQL_URL;
const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--only="))?.split("=")[1] || "")
  .split(",")
  .filter(Boolean);

if (!SRC || !DST) {
  console.error("Set SUPABASE_DB_URL and MYSQL_URL");
  process.exit(2);
}

// FK-safe order — parents before children. Matches the Laravel migrations.
const ORDER = [
  "offices",
  "users",
  "custom_roles",
  "permissions",
  "role_permissions",
  "user_custom_roles",
  "divisions",
  "districts",
  "upazilas",
  "unions",
  "mouzas",
  "patwaris",
  "farmers",
  "land_types",
  "lands",
  "seasons",
  "irrigation_categories",
  "irrigation_invoices",
  "irrigation_invoice_payments",
  "savings_plans",
  "savings_transactions",
  "shares",
  "loans",
  "loan_payments",
  "accounts",
  "payments",
  "receipts",
  "receipt_counters",
];

// Laravel-managed / infrastructure tables — never import data.
const SKIP = new Set([
  "migrations",
  "personal_access_tokens",
  "password_reset_tokens",
  "sessions",
  "cache",
  "cache_locks",
  "jobs",
  "job_batches",
  "failed_jobs",
]);

const BATCH = 500;

function normalize(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

async function copyTable(src, dst, table) {
  // Target columns
  const [tcols] = await dst.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position`,
    [table]
  );
  if (!tcols.length) {
    console.log(`  ⚠ ${table}: not in MySQL target, skipping`);
    return 0;
  }
  const targetCols = tcols.map((c) => c.column_name ?? c.COLUMN_NAME);
  const targetSet = new Set(targetCols);
  const hasExtra = targetSet.has("extra");

  // Source rows
  const { rows } = await src.query(`SELECT * FROM "${table}"`);
  if (!rows.length) {
    console.log(`  · ${table}: 0 rows`);
    return 0;
  }

  if (DRY) {
    const unknown = Object.keys(rows[0]).filter((k) => !targetSet.has(k));
    console.log(
      `  → ${table}: ${rows.length} rows (dry-run)` +
        (unknown.length ? `  [→extra: ${unknown.join(", ")}]` : "")
    );
    return rows.length;
  }

  await dst.query("SET FOREIGN_KEY_CHECKS=0");
  await dst.query(`DELETE FROM \`${table}\``);

  const colList = targetCols.map((c) => `\`${c}\``).join(",");
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const placeholders = [];
    const values = [];

    for (const row of chunk) {
      // Merge unknown source fields into existing extra JSON
      let extra = {};
      if (hasExtra && row.extra) {
        try {
          extra = typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
        } catch {
          extra = {};
        }
      }
      if (hasExtra) {
        for (const [k, val] of Object.entries(row)) {
          if (!targetSet.has(k) && val !== null && val !== undefined) extra[k] = val;
        }
      }

      const rowVals = targetCols.map((c) => {
        if (c === "extra" && hasExtra) return JSON.stringify(extra);
        return normalize(row[c]);
      });

      placeholders.push(`(${targetCols.map(() => "?").join(",")})`);
      values.push(...rowVals);
    }

    await dst.query(`INSERT INTO \`${table}\` (${colList}) VALUES ${placeholders.join(",")}`, values);
    written += chunk.length;
  }

  await dst.query("SET FOREIGN_KEY_CHECKS=1");
  console.log(`  ✔ ${table}: ${written} rows`);
  return written;
}

(async () => {
  const src = new pg.Client({ connectionString: SRC });
  const dst = await mysql.createConnection({ uri: DST, multipleStatements: true });
  await src.connect();

  const tables = ONLY.length ? ONLY : ORDER;
  let total = 0;
  for (const t of tables) {
    if (SKIP.has(t)) continue;
    try {
      total += await copyTable(src, dst, t);
    } catch (e) {
      console.error(`  ✘ ${t}: ${e.message}`);
    }
  }

  await src.end();
  await dst.end();
  console.log(`\nDone. ${total} rows ${DRY ? "would be " : ""}migrated.`);
})();
