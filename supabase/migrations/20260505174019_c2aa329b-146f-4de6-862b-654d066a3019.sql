
ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS owner_farmer_id uuid REFERENCES public.farmers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lands_owner_farmer ON public.lands(owner_farmer_id);
