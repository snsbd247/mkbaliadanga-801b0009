
-- 1. Revive owner source lands that were wrongly archived during a borga transfer
UPDATE public.lands
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL
  AND id IN (SELECT source_land_id FROM public.land_transfers WHERE transfer_type = 'borga_transfer');

-- 2. Create the missing active land_relation for each borga recipient
INSERT INTO public.land_relations
  (land_id, owner_farmer_id, sharecropper_farmer_id, area_decimal, share_percentage, valid_from, office_id, note)
SELECT lt.source_land_id, lt.source_farmer_id, tr.recipient_farmer_id, tr.area_decimal,
       CASE WHEN sl.land_size > 0
            THEN round((tr.area_decimal / sl.land_size * 100)::numeric, 4)
            ELSE 50 END,
       COALESCE(lt.transferred_at::date, CURRENT_DATE),
       lt.office_id,
       'Healed from legacy borga transfer'
FROM public.land_transfers lt
JOIN public.land_transfer_recipients tr ON tr.transfer_id = lt.id
JOIN public.lands sl ON sl.id = lt.source_land_id
WHERE lt.transfer_type = 'borga_transfer'
  AND tr.recipient_farmer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.land_relations r
    WHERE r.land_id = lt.source_land_id
      AND r.sharecropper_farmer_id = tr.recipient_farmer_id
      AND r.deleted_at IS NULL AND r.valid_to IS NULL
  );

-- 3. Archive the orphan borgadar land rows created by the legacy borga transfers
UPDATE public.lands
SET deleted_at = now()
WHERE owner_type = 'borgadar' AND deleted_at IS NULL
  AND id IN (
    SELECT tr.new_land_id FROM public.land_transfer_recipients tr
    JOIN public.land_transfers lt ON lt.id = tr.transfer_id
    WHERE lt.transfer_type = 'borga_transfer' AND tr.new_land_id IS NOT NULL
  );

-- 4. Detach recipient rows from the now-archived borgadar lands (unified model uses relations)
UPDATE public.land_transfer_recipients tr
SET new_land_id = NULL
WHERE tr.new_land_id IS NOT NULL
  AND tr.transfer_id IN (SELECT id FROM public.land_transfers WHERE transfer_type = 'borga_transfer');
