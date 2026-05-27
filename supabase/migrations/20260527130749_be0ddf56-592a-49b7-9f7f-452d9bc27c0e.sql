
-- Group A: Add patwari_id to lands table
ALTER TABLE public.lands 
  ADD COLUMN IF NOT EXISTS patwari_id uuid REFERENCES public.patwaris(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lands_patwari_id ON public.lands(patwari_id) WHERE patwari_id IS NOT NULL;

COMMENT ON COLUMN public.lands.patwari_id IS 'Patwari assigned to this land. Replaces old per-irrigation-charge assignment.';
