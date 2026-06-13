ALTER TABLE public.land_transfers
  ADD COLUMN IF NOT EXISTS source_dag_no text,
  ADD COLUMN IF NOT EXISTS source_mouza text,
  ADD COLUMN IF NOT EXISTS source_land_size numeric,
  ADD COLUMN IF NOT EXISTS source_owner_name text,
  ADD COLUMN IF NOT EXISTS source_owner_code text;