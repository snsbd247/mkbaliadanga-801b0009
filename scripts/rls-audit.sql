-- ============================================================
-- RLS audit: verify office-scoped tables enforce cross-office isolation
-- Run with: psql $DATABASE_URL -f scripts/rls-audit.sql
-- ============================================================

\echo '=== 1. Tables with office_id but RLS disabled (should be empty) ==='
SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN information_schema.columns col
  ON col.table_schema = n.nspname AND col.table_name = c.relname
WHERE n.nspname = 'public'
  AND col.column_name = 'office_id'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false;

\echo ''
\echo '=== 2. Office-scoped tables and their SELECT policy expressions ==='
SELECT p.tablename, p.policyname, p.cmd, p.qual AS using_expr
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.cmd = 'SELECT'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = p.schemaname AND c.table_name = p.tablename
      AND c.column_name = 'office_id'
  )
ORDER BY p.tablename, p.policyname;

\echo ''
\echo '=== 3. Office-scoped tables WITHOUT a current_user_office() check (suspicious) ==='
SELECT DISTINCT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = t.schemaname AND c.table_name = t.tablename
      AND c.column_name = 'office_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
      AND p.cmd = 'SELECT'
      AND p.qual ILIKE '%current_user_office%'
  );

\echo ''
\echo '=== 4. Distinct office_id values per office-scoped table ==='
DO $$
DECLARE
  r record;
  cnt int;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'office_id'
    ORDER BY c.table_name
  LOOP
    EXECUTE format('SELECT count(DISTINCT office_id) FROM public.%I WHERE office_id IS NOT NULL', r.table_name) INTO cnt;
    RAISE NOTICE '% : % distinct office(s)', r.table_name, cnt;
  END LOOP;
END $$;

\echo ''
\echo '=== Audit complete ==='
