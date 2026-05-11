DELETE FROM public.shares WHERE farmer_id IN (SELECT id FROM public.farmers WHERE name_en LIKE 'TEST_%');
DELETE FROM public.farmers WHERE name_en LIKE 'TEST_%';