CREATE TABLE IF NOT EXISTS public.irrigation_invoice_backfill_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_no text,
  farmer_id uuid,
  land_id uuid,
  old_area numeric,
  new_area numeric,
  old_payable numeric,
  new_payable numeric,
  old_irrigation_amount numeric,
  new_irrigation_amount numeric,
  old_due numeric,
  new_due numeric,
  paid_amount numeric,
  action text NOT NULL,
  reason text,
  backfill_source text NOT NULL DEFAULT 'borga_area_fix_2026_07_14',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.irrigation_invoice_backfill_audit TO authenticated;
GRANT ALL ON public.irrigation_invoice_backfill_audit TO service_role;

ALTER TABLE public.irrigation_invoice_backfill_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read backfill audit" ON public.irrigation_invoice_backfill_audit;
CREATE POLICY "admins read backfill audit"
  ON public.irrigation_invoice_backfill_audit
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "admins insert backfill audit" ON public.irrigation_invoice_backfill_audit;
CREATE POLICY "admins insert backfill audit"
  ON public.irrigation_invoice_backfill_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS iiba_invoice_idx ON public.irrigation_invoice_backfill_audit(invoice_id);

SET LOCAL app.allow_snapshot_rewrite = 'on';

DO $backfill$
DECLARE
  r record;
  v_as_of date;
  v_owner uuid;
  v_total numeric;
  v_is_borga boolean;
  v_new_area numeric;
  v_old_area numeric;
  v_ratio numeric;
  v_new_irr numeric;
  v_new_payable numeric;
  v_new_due numeric;
  v_new_status public.invoice_status;
  v_allocated numeric;
  v_action text;
  v_reason text;
BEGIN
  PERFORM set_config('app.allow_snapshot_rewrite', 'on', true);

  FOR r IN
    SELECT i.id, i.invoice_no, i.farmer_id, i.land_id, i.is_borga,
           i.billed_area_shotok, i.parcel_area_shotok,
           i.irrigation_amount, i.payable_amount, i.paid_amount, i.due_amount,
           i.delay_fee, i.other_charge, i.discount_amount,
           i.invoice_status, i.calculation_snapshot,
           i.generated_at, i.due_date,
           l.land_size, COALESCE(l.owner_farmer_id, l.farmer_id) AS land_owner_id
    FROM public.irrigation_invoices i
    JOIN public.lands l ON l.id = i.land_id
    WHERE i.deleted_at IS NULL
      AND COALESCE(i.invoice_status::text, '') <> 'cancelled'
  LOOP
    v_as_of := COALESCE(r.due_date, r.generated_at::date, CURRENT_DATE);
    v_owner := r.land_owner_id;
    v_total := COALESCE(r.land_size, 0);
    v_new_area := NULL;
    v_is_borga := false;
    v_action := NULL;
    v_reason := NULL;

    IF v_owner IS NULL OR v_total <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(NULLIF(lr.area_decimal, 0), round((COALESCE(NULLIF(lr.share_percentage, 0), 0) / 100.0) * v_total, 4))
      INTO v_new_area
    FROM public.land_relations lr
    WHERE lr.land_id = r.land_id
      AND lr.sharecropper_farmer_id = r.farmer_id
      AND lr.deleted_at IS NULL
      AND (lr.valid_from IS NULL OR lr.valid_from <= v_as_of)
      AND (lr.valid_to IS NULL OR lr.valid_to >= v_as_of)
    ORDER BY lr.valid_from DESC NULLS LAST, lr.created_at DESC NULLS LAST, lr.id DESC
    LIMIT 1;

    IF v_new_area IS NOT NULL AND v_new_area > 0 THEN
      v_is_borga := true;
    ELSIF r.farmer_id = v_owner THEN
      SELECT COALESCE(sum(COALESCE(NULLIF(lr.area_decimal, 0), round((COALESCE(NULLIF(lr.share_percentage, 0), 0) / 100.0) * v_total, 4))), 0)
        INTO v_allocated
      FROM public.land_relations lr
      WHERE lr.land_id = r.land_id
        AND lr.sharecropper_farmer_id IS NOT NULL
        AND lr.deleted_at IS NULL
        AND (lr.valid_from IS NULL OR lr.valid_from <= v_as_of)
        AND (lr.valid_to IS NULL OR lr.valid_to >= v_as_of);
      v_new_area := GREATEST(v_total - COALESCE(v_allocated, 0), 0);
      v_is_borga := false;
    ELSE
      CONTINUE;
    END IF;

    IF v_new_area IS NULL OR v_new_area <= 0 THEN
      CONTINUE;
    END IF;

    v_old_area := COALESCE(
      r.billed_area_shotok,
      NULLIF(r.calculation_snapshot->>'billed_area_shotok', '')::numeric,
      NULLIF(r.calculation_snapshot->'backfill_new'->>'billed_area_shotok', '')::numeric,
      NULLIF(r.calculation_snapshot->>'land_size_shotok', '')::numeric,
      r.land_size
    );

    IF v_old_area IS NULL OR v_old_area <= 0 THEN
      v_action := 'skipped_no_old_area';
      v_reason := 'billed_area_shotok/snapshot/land_size is null or zero';
    ELSIF abs(v_new_area - v_old_area) < 0.0001
      AND COALESCE(r.parcel_area_shotok, 0) = v_total
      AND COALESCE(r.is_borga, false) = v_is_borga THEN
      v_action := 'noop_same_area';
    END IF;

    IF v_action IS NOT NULL THEN
      INSERT INTO public.irrigation_invoice_backfill_audit
        (invoice_id, invoice_no, farmer_id, land_id, old_area, new_area,
         old_payable, new_payable, old_irrigation_amount, new_irrigation_amount,
         old_due, new_due, paid_amount, action, reason, backfill_source)
      VALUES
        (r.id, r.invoice_no, r.farmer_id, r.land_id, v_old_area, v_new_area,
         r.payable_amount, NULL, r.irrigation_amount, NULL,
         r.due_amount, NULL, r.paid_amount, v_action, v_reason, 'borga_area_fix_2026_07_14_permanent');
      CONTINUE;
    END IF;

    v_ratio := v_new_area / v_old_area;
    v_new_irr := round(COALESCE(r.irrigation_amount, 0) * v_ratio);
    v_new_payable := v_new_irr
                     + COALESCE(r.delay_fee, 0)
                     + COALESCE(r.other_charge, 0)
                     - COALESCE(r.discount_amount, 0);
    IF v_new_payable < 0 THEN v_new_payable := 0; END IF;
    v_new_due := GREATEST(v_new_payable - COALESCE(r.paid_amount, 0), 0);

    IF COALESCE(r.paid_amount, 0) >= v_new_payable AND v_new_payable > 0 THEN
      v_new_status := 'paid'::public.invoice_status;
    ELSIF COALESCE(r.paid_amount, 0) > 0 THEN
      v_new_status := 'partial_paid'::public.invoice_status;
    ELSE
      v_new_status := COALESCE(r.invoice_status, 'generated'::public.invoice_status);
    END IF;

    UPDATE public.irrigation_invoices
    SET billed_area_shotok = v_new_area,
        parcel_area_shotok = v_total,
        owner_farmer_id = v_owner,
        is_borga = v_is_borga,
        irrigation_amount = v_new_irr,
        payable_amount = v_new_payable,
        due_amount = v_new_due,
        invoice_status = v_new_status,
        calculation_snapshot = COALESCE(calculation_snapshot, '{}'::jsonb) || jsonb_build_object(
          'billed_area_shotok', v_new_area,
          'land_size_shotok', v_new_area,
          'parcel_size_shotok', v_total,
          'backfilled_at', now(),
          'backfill_source', 'borga_area_fix_2026_07_14_permanent',
          'backfill_old', jsonb_build_object(
            'billed_area_shotok', v_old_area,
            'irrigation_amount', r.irrigation_amount,
            'payable_amount', r.payable_amount,
            'due_amount', r.due_amount,
            'paid_amount', r.paid_amount,
            'invoice_status', r.invoice_status
          ),
          'backfill_new', jsonb_build_object(
            'billed_area_shotok', v_new_area,
            'irrigation_amount', v_new_irr,
            'payable_amount', v_new_payable,
            'due_amount', v_new_due,
            'paid_amount', r.paid_amount,
            'invoice_status', v_new_status
          )
        ),
        updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.irrigation_invoice_backfill_audit
      (invoice_id, invoice_no, farmer_id, land_id, old_area, new_area,
       old_payable, new_payable, old_irrigation_amount, new_irrigation_amount,
       old_due, new_due, paid_amount, action, reason, backfill_source)
    VALUES
      (r.id, r.invoice_no, r.farmer_id, r.land_id, v_old_area, v_new_area,
       r.payable_amount, v_new_payable, r.irrigation_amount, v_new_irr,
       r.due_amount, v_new_due, r.paid_amount,
       CASE
         WHEN COALESCE(r.paid_amount, 0) > v_new_payable THEN 'updated_paid_overpay'
         WHEN COALESCE(r.paid_amount, 0) > 0 THEN 'updated_paid'
         ELSE 'updated'
       END,
       CASE WHEN COALESCE(r.paid_amount, 0) > v_new_payable THEN 'paid_amount exceeds recalculated payable; payment rows left unchanged' ELSE NULL END,
       'borga_area_fix_2026_07_14_permanent');
  END LOOP;
END
$backfill$;

CREATE OR REPLACE FUNCTION public.enforce_irrigation_invoice_billed_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_as_of date;
  v_owner uuid;
  v_total numeric;
  v_expected numeric;
  v_allocated numeric;
  v_is_borga boolean := false;
BEGIN
  IF NEW.land_id IS NULL OR NEW.farmer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.owner_farmer_id, l.farmer_id), COALESCE(l.land_size, l.area_decimal, 0)
    INTO v_owner, v_total
  FROM public.lands l
  WHERE l.id = NEW.land_id;

  IF v_owner IS NULL OR v_total <= 0 THEN
    RETURN NEW;
  END IF;

  v_as_of := COALESCE(NEW.due_date, NEW.generated_at::date, CURRENT_DATE);

  SELECT COALESCE(NULLIF(lr.area_decimal, 0), round((COALESCE(NULLIF(lr.share_percentage, 0), 0) / 100.0) * v_total, 4))
    INTO v_expected
  FROM public.land_relations lr
  WHERE lr.land_id = NEW.land_id
    AND lr.sharecropper_farmer_id = NEW.farmer_id
    AND lr.deleted_at IS NULL
    AND (lr.valid_from IS NULL OR lr.valid_from <= v_as_of)
    AND (lr.valid_to IS NULL OR lr.valid_to >= v_as_of)
  ORDER BY lr.valid_from DESC NULLS LAST, lr.created_at DESC NULLS LAST, lr.id DESC
  LIMIT 1;

  IF v_expected IS NOT NULL AND v_expected > 0 THEN
    v_is_borga := true;
    NEW.owner_farmer_id := v_owner;
    NEW.is_borga := true;
  ELSIF NEW.farmer_id = v_owner THEN
    SELECT COALESCE(sum(COALESCE(NULLIF(lr.area_decimal, 0), round((COALESCE(NULLIF(lr.share_percentage, 0), 0) / 100.0) * v_total, 4))), 0)
      INTO v_allocated
    FROM public.land_relations lr
    WHERE lr.land_id = NEW.land_id
      AND lr.sharecropper_farmer_id IS NOT NULL
      AND lr.deleted_at IS NULL
      AND (lr.valid_from IS NULL OR lr.valid_from <= v_as_of)
      AND (lr.valid_to IS NULL OR lr.valid_to >= v_as_of);
    v_expected := GREATEST(v_total - COALESCE(v_allocated, 0), 0);
    NEW.owner_farmer_id := v_owner;
    NEW.is_borga := false;
  ELSE
    RETURN NEW;
  END IF;

  NEW.parcel_area_shotok := v_total;

  IF v_expected <= 0 THEN
    RAISE EXCEPTION 'No billable irrigation area remains for this farmer on the selected land.';
  END IF;

  IF NEW.billed_area_shotok IS NULL OR NEW.billed_area_shotok <= 0 THEN
    RAISE EXCEPTION 'Irrigation invoice requires billed_area_shotok. Expected % shotok for this farmer.', v_expected;
  END IF;

  IF abs(NEW.billed_area_shotok - v_expected) > 0.0001 THEN
    RAISE EXCEPTION 'Invalid irrigation billed area %. Expected % shotok for this farmer, parcel % shotok.', NEW.billed_area_shotok, v_expected, v_total;
  END IF;

  IF NEW.billed_area_shotok > v_total + 0.0001 THEN
    RAISE EXCEPTION 'Billed area cannot exceed parcel area.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_irrigation_invoice_billed_area ON public.irrigation_invoices;
CREATE TRIGGER trg_enforce_irrigation_invoice_billed_area
BEFORE INSERT OR UPDATE OF land_id, farmer_id, due_date, generated_at, billed_area_shotok, parcel_area_shotok, is_borga, owner_farmer_id
ON public.irrigation_invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_irrigation_invoice_billed_area();

NOTIFY pgrst, 'reload schema';