ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS division_id uuid,
  ADD COLUMN IF NOT EXISTS district_id uuid,
  ADD COLUMN IF NOT EXISTS upazila_id uuid,
  ADD COLUMN IF NOT EXISTS mouza_id uuid;

CREATE INDEX IF NOT EXISTS idx_lands_upazila_id ON public.lands(upazila_id);
CREATE INDEX IF NOT EXISTS idx_lands_mouza_id ON public.lands(mouza_id);

DROP VIEW IF EXISTS public.lands_with_location;

CREATE VIEW public.lands_with_location AS
SELECT
  l.id,
  l.farmer_id,
  l.mouza,
  l.dag_no,
  l.land_size,
  l.owner_type,
  l.field_type,
  l.created_at,
  l.office_id,
  l.owner_farmer_id,
  l.division_id,
  d.name AS division_name,
  l.district_id,
  ds.name AS district_name,
  l.upazila_id,
  u.name AS upazila_name,
  l.mouza_id,
  COALESCE(m.name, l.mouza) AS mouza_name
FROM public.lands l
LEFT JOIN public.divisions d ON d.id = l.division_id
LEFT JOIN public.districts ds ON ds.id = l.district_id
LEFT JOIN public.upazilas u ON u.id = l.upazila_id
LEFT JOIN public.mouzas m ON m.id = l.mouza_id
WHERE l.deleted_at IS NULL;