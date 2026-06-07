CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS farmers_father_name_trgm_idx
  ON public.farmers USING gin (lower(father_name) gin_trgm_ops);
