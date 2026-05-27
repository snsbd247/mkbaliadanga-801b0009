
CREATE OR REPLACE VIEW public.lands_with_location AS
SELECT l.id,
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
    COALESCE(m.name, l.mouza) AS mouza_name,
    l.patwari_id,
    p.name AS patwari_name,
    p.name_bn AS patwari_name_bn,
    p.mobile AS patwari_mobile
FROM public.lands l
LEFT JOIN public.divisions d ON d.id = l.division_id
LEFT JOIN public.districts ds ON ds.id = l.district_id
LEFT JOIN public.upazilas u ON u.id = l.upazila_id
LEFT JOIN public.mouzas m ON m.id = l.mouza_id
LEFT JOIN public.patwaris p ON p.id = l.patwari_id
WHERE l.deleted_at IS NULL;

GRANT SELECT ON public.lands_with_location TO authenticated, anon, service_role;
