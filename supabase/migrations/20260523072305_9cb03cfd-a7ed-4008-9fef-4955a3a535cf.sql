ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS nominee_name text,
  ADD COLUMN IF NOT EXISTS nominee_mobile text,
  ADD COLUMN IF NOT EXISTS nominee_relation text,
  ADD COLUMN IF NOT EXISTS nominee_nid text,
  ADD COLUMN IF NOT EXISTS nominee_address text;