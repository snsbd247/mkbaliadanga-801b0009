
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'farmers','lands','loans','savings_transactions','irrigation_charges',
    'payments','expenses','journal_entries','land_relations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NULL', t || '_active_idx', t);
  END LOOP;
END$$;

-- Helper for soft-delete via UPDATE; existing UPDATE policies (admin/committee) already cover it.
COMMENT ON COLUMN public.farmers.deleted_at IS 'Soft delete timestamp; null = active';
