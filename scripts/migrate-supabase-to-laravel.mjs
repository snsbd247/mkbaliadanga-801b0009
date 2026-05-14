#!/usr/bin/env node
/**
 * One-time data migration: Supabase Postgres → Laravel Postgres.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://… LARAVEL_DB_URL=postgres://… \
 *     node scripts/migrate-supabase-to-laravel.mjs [--dry-run] [--only=table1,table2]
 *
 * Strategy: COPY every public.* table from source to target in FK-safe order.
 * Skips Laravel-managed tables (migrations, personal_access_tokens, sessions, jobs).
 * After import you MUST run:
 *   php artisan db:seed --class=SequenceFixSeeder
 *
 * Requires `pg` driver: `npm i pg` (only for this script; not a runtime dep).
 */

import pg from "pg";
const { Client } = pg;

const SRC = process.env.SUPABASE_DB_URL;
const DST = process.env.LARAVEL_DB_URL;
const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find(a => a.startsWith("--only="))?.split("=")[1] || "").split(",").filter(Boolean);

if (!SRC || !DST) {
  console.error("Set SUPABASE_DB_URL and LARAVEL_DB_URL");
  process.exit(2);
}

// FK-safe order. Adjust if you add new tables.
const ORDER = [
  "offices", "users", "roles", "permissions", "role_user", "permission_role",
  "farmers", "farmer_credentials",
  "lands", "seasons",
  "accounts", "journal_entries", "ledger_entries",
  "loan_plans", "loans", "loan_installments",
  "savings_accounts", "savings_transactions",
  "irrigation_rates", "irrigation_invoices",
  "payments",
  "assets",
  "sms_logs",
  "qr_tokens",
  "audit_logs",
];

const SKIP = new Set(["migrations", "personal_access_tokens", "sessions", "jobs", "failed_jobs", "cache", "cache_locks"]);

async function copyTable(src, dst, table) {
  const { rows: cols } = await dst.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  if (!cols.length) { console.log(`  ⚠ ${table}: not in target, skipping`); return 0; }
  const colList = cols.map(c => `"${c.column_name}"`).join(",");

  const { rows } = await src.query(`SELECT ${colList} FROM "${table}"`);
  if (!rows.length) { console.log(`  · ${table}: 0 rows`); return 0; }

  if (DRY) { console.log(`  → ${table}: ${rows.length} rows (dry-run)`); return rows.length; }

  await dst.query(`TRUNCATE "${table}" RESTART IDENTITY CASCADE`);

  for (const row of rows) {
    const vals = cols.map(c => row[c.column_name]);
    const ph = vals.map((_, i) => `$${i + 1}`).join(",");
    await dst.query(`INSERT INTO "${table}" (${colList}) VALUES (${ph})`, vals);
  }
  console.log(`  ✔ ${table}: ${rows.length} rows`);
  return rows.length;
}

(async () => {
  const src = new Client({ connectionString: SRC });
  const dst = new Client({ connectionString: DST });
  await src.connect(); await dst.connect();

  const tables = ONLY.length ? ONLY : ORDER;
  let total = 0;
  for (const t of tables) {
    if (SKIP.has(t)) continue;
    try { total += await copyTable(src, dst, t); }
    catch (e) { console.error(`  ✘ ${t}: ${e.message}`); }
  }

  await src.end(); await dst.end();
  console.log(`\nDone. ${total} rows ${DRY ? "would be " : ""}migrated.`);
  if (!DRY) console.log("Next: cd backend && php artisan db:seed --class=SequenceFixSeeder");
})();
