ALTER TABLE public.irrigation_rates
  ADD CONSTRAINT irrigation_rates_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE RESTRICT;
ALTER TABLE public.irrigation_rates
  ADD CONSTRAINT irrigation_rates_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_irrigation_rates_season ON public.irrigation_rates(season_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_rates_office ON public.irrigation_rates(office_id);