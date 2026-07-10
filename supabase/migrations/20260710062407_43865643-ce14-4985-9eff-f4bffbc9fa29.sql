-- Internal stash for foreign-key definitions during a phased restore.
CREATE TABLE IF NOT EXISTS public._restore_fk_stash (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ddl text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._restore_fk_stash TO service_role;
ALTER TABLE public._restore_fk_stash ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions (owner) touch this table.

-- Phase 1: drop every public FK and stash its re-add DDL.
CREATE OR REPLACE FUNCTION public.admin_restore_begin()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  fk RECORD;
  is_service boolean := false;
  n integer := 0;
BEGIN
  BEGIN
    is_service := coalesce((current_setting('request.jwt.claims', true)::json ->> 'role'), '') = 'service_role';
  EXCEPTION WHEN others THEN is_service := false; END;
  IF NOT (public.has_role(auth.uid(), 'developer'::app_role) OR is_service) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;

  DELETE FROM public._restore_fk_stash;
  FOR fk IN
    SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS cdef
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    INSERT INTO public._restore_fk_stash (ddl)
    VALUES (format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.tbl, fk.conname, fk.cdef));
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Phase 2: run one table's TRUNCATE + INSERT payload (no FK manipulation).
CREATE OR REPLACE FUNCTION public.admin_restore_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  is_service boolean := false;
BEGIN
  BEGIN
    is_service := coalesce((current_setting('request.jwt.claims', true)::json ->> 'role'), '') = 'service_role';
  EXCEPTION WHEN others THEN is_service := false; END;
  IF NOT (public.has_role(auth.uid(), 'developer'::app_role) OR is_service) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;
  EXECUTE sql;
END;
$$;

-- Phase 3: re-add all stashed foreign keys, then clear the stash.
CREATE OR REPLACE FUNCTION public.admin_restore_commit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  r RECORD;
  is_service boolean := false;
  n integer := 0;
BEGIN
  BEGIN
    is_service := coalesce((current_setting('request.jwt.claims', true)::json ->> 'role'), '') = 'service_role';
  EXCEPTION WHEN others THEN is_service := false; END;
  IF NOT (public.has_role(auth.uid(), 'developer'::app_role) OR is_service) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;
  FOR r IN SELECT ddl FROM public._restore_fk_stash ORDER BY id LOOP
    EXECUTE r.ddl;
    n := n + 1;
  END LOOP;
  DELETE FROM public._restore_fk_stash;
  RETURN n;
END;
$$;

-- Verification: live row counts for every public table.
CREATE OR REPLACE FUNCTION public.public_table_row_counts()
RETURNS TABLE(tablename text, row_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  t RECORD;
  c bigint;
  is_service boolean := false;
BEGIN
  BEGIN
    is_service := coalesce((current_setting('request.jwt.claims', true)::json ->> 'role'), '') = 'service_role';
  EXCEPTION WHEN others THEN is_service := false; END;
  IF NOT (public.has_role(auth.uid(), 'developer'::app_role) OR is_service) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;
  FOR t IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE '\_%'
    ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.name) INTO c;
    tablename := t.name; row_count := c; RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_begin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_exec(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_commit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_table_row_counts() TO authenticated, service_role;

-- Scheduled backup settings (developer-only).
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily',
  retention_count integer NOT NULL DEFAULT 7,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage backup schedules"
ON public.backup_schedules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'developer'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_backup_schedules_updated_at ON public.backup_schedules;
CREATE TRIGGER update_backup_schedules_updated_at
BEFORE UPDATE ON public.backup_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';