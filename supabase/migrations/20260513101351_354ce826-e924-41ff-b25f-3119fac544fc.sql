CREATE OR REPLACE FUNCTION public.pg_public_table_columns()
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text,
  udt_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
$$;

REVOKE ALL ON FUNCTION public.pg_public_table_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_public_table_columns() TO service_role;

CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid,
  token text NOT NULL UNIQUE,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  rotated_from uuid
);

ALTER TABLE public.qr_tokens
  ADD COLUMN IF NOT EXISTS farmer_id uuid,
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rotated_from uuid;

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS qr_tokens_farmer_idx ON public.qr_tokens(farmer_id);
CREATE UNIQUE INDEX IF NOT EXISTS qr_tokens_one_active_per_farmer
  ON public.qr_tokens (farmer_id) WHERE revoked = false;

DROP POLICY IF EXISTS "qr_tokens deny all" ON public.qr_tokens;
CREATE POLICY "qr_tokens deny all" ON public.qr_tokens
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);