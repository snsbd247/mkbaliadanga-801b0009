
ALTER TABLE public.irrigation_invoices
  ADD CONSTRAINT irrigation_invoices_farmer_id_fkey
    FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT irrigation_invoices_owner_farmer_id_fkey
    FOREIGN KEY (owner_farmer_id) REFERENCES public.farmers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT irrigation_invoices_land_id_fkey
    FOREIGN KEY (land_id) REFERENCES public.lands(id) ON DELETE RESTRICT,
  ADD CONSTRAINT irrigation_invoices_season_id_fkey
    FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_farmer ON public.irrigation_invoices(farmer_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_land ON public.irrigation_invoices(land_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_season ON public.irrigation_invoices(season_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_owner ON public.irrigation_invoices(owner_farmer_id);
