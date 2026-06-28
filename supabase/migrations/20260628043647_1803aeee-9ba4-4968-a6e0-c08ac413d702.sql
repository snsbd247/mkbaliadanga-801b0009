
DO $$
DECLARE
  t RECORD;
  rc RECORD;
  v_share numeric;
BEGIN
  FOR t IN
    SELECT lt.id, lt.source_land_id, lt.source_farmer_id, lt.source_dag_no,
           lt.source_land_size, lt.office_id
    FROM public.land_transfers lt
    WHERE lt.transfer_type = 'borga_transfer'
      AND lt.source_land_id IS NOT NULL
  LOOP
    -- 1) Owner must keep the full parcel: revive the archived source land.
    UPDATE public.lands
      SET deleted_at = NULL
      WHERE id = t.source_land_id AND deleted_at IS NOT NULL;

    -- 2) Create the active borga land_relation for each recipient (if missing).
    FOR rc IN
      SELECT r.recipient_farmer_id, r.area_decimal
      FROM public.land_transfer_recipients r
      WHERE r.transfer_id = t.id AND r.recipient_farmer_id IS NOT NULL
    LOOP
      v_share := CASE
        WHEN COALESCE(t.source_land_size, 0) > 0
          THEN LEAST(100, ROUND((COALESCE(rc.area_decimal, 0) / t.source_land_size) * 100, 2))
        ELSE 100
      END;
      IF v_share <= 0 THEN v_share := 100; END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.land_relations lr
        WHERE lr.land_id = t.source_land_id
          AND lr.owner_farmer_id = t.source_farmer_id
          AND COALESCE(lr.sharecropper_farmer_id, '00000000-0000-0000-0000-000000000000')
              = COALESCE(rc.recipient_farmer_id, '00000000-0000-0000-0000-000000000000')
          AND lr.deleted_at IS NULL
          AND lr.valid_to IS NULL
      ) THEN
        INSERT INTO public.land_relations
          (land_id, owner_farmer_id, sharecropper_farmer_id, share_percentage,
           area_decimal, valid_from, office_id, note)
        VALUES
          (t.source_land_id, t.source_farmer_id, rc.recipient_farmer_id, v_share,
           rc.area_decimal, CURRENT_DATE, t.office_id,
           'Repaired from legacy borga transfer');
      END IF;

      -- 3) Remove the orphan borgadar land row created for this sharecropper.
      UPDATE public.lands
        SET deleted_at = now()
        WHERE owner_type = 'borgadar'
          AND deleted_at IS NULL
          AND farmer_id = rc.recipient_farmer_id
          AND dag_no = t.source_dag_no;
    END LOOP;
  END LOOP;

  -- Safety net: any remaining active orphan borgadar land that maps cleanly to an
  -- owner's parcel (same dag) becomes a relation; otherwise just archive it so the
  -- unified model has no stray borgadar land rows.
  UPDATE public.lands b
    SET deleted_at = now()
    WHERE b.owner_type = 'borgadar'
      AND b.deleted_at IS NULL;
END $$;
