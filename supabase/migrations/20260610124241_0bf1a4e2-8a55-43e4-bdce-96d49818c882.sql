UPDATE public.irrigation_invoices inv
SET office_id = f.office_id
FROM public.farmers f
WHERE inv.farmer_id = f.id
  AND inv.office_id IS NULL
  AND f.office_id IS NOT NULL;