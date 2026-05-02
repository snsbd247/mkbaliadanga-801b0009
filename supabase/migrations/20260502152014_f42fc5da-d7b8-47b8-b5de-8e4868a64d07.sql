ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS village_id uuid REFERENCES public.villages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_farmers_village ON public.farmers(village_id);