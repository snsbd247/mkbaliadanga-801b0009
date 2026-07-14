
ALTER TABLE public.irrigation_invoices
  ADD COLUMN IF NOT EXISTS billed_area_shotok numeric,
  ADD COLUMN IF NOT EXISTS parcel_area_shotok numeric;

UPDATE public.irrigation_invoices i
SET billed_area_shotok = COALESCE(
      NULLIF(i.calculation_snapshot->>'billed_area_shotok','')::numeric,
      NULLIF(i.calculation_snapshot->>'land_size_shotok','')::numeric,
      l.land_size
    ),
    parcel_area_shotok = COALESCE(
      NULLIF(i.calculation_snapshot->>'parcel_size_shotok','')::numeric,
      l.land_size
    )
FROM public.lands l
WHERE l.id = i.land_id
  AND (i.billed_area_shotok IS NULL OR i.parcel_area_shotok IS NULL);

NOTIFY pgrst, 'reload schema';
