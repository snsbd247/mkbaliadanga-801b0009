CREATE UNIQUE INDEX IF NOT EXISTS land_relations_unique_period
ON public.land_relations (
  land_id,
  owner_farmer_id,
  COALESCE(sharecropper_farmer_id, '00000000-0000-0000-0000-000000000000'::uuid),
  valid_from,
  COALESCE(valid_to, '9999-12-31'::date)
);