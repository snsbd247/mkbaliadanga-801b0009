ALTER TABLE public.lands
  ADD CONSTRAINT lands_mouza_id_fkey
  FOREIGN KEY (mouza_id) REFERENCES public.mouzas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lands_mouza_id ON public.lands(mouza_id);