
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
  v_new_area numeric;
  v_old_area numeric;
  v_ratio numeric;
  v_new_irr numeric;
  v_new_payable numeric;
  v_new_due numeric;
  v_new_status public.invoice_status;
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
           l.land_size,
           lr.area_decimal AS rel_area,
           lr.share_percentage AS rel_pct
    FROM public.irrigation_invoices i
    JOIN public.lands l ON l.id = i.land_id
    LEFT JOIN LATERAL (
      SELECT area_decimal, share_percentage
      FROM public.land_relations
      WHERE land_id = i.land_id
        AND sharecropper_farmer_id = i.farmer_id
        AND deleted_at IS NULL
      ORDER BY (valid_to IS NULL) DESC, valid_from DESC
      LIMIT 1
    ) lr ON true
    WHERE i.is_borga = true
      AND i.deleted_at IS NULL
      AND i.invoice_status <> 'cancelled'
  LOOP
    v_old_area := COALESCE(r.billed_area_shotok, r.land_size);
    v_action := NULL;
    v_reason := NULL;
    v_new_area := NULL;
    v_new_irr := NULL;
    v_new_payable := NULL;
    v_new_due := NULL;

    IF r.rel_area IS NOT NULL AND r.rel_area > 0 THEN
      v_new_area := r.rel_area;
    ELSIF r.rel_pct IS NOT NULL AND r.rel_pct > 0 AND r.land_size IS NOT NULL THEN
      v_new_area := round((r.rel_pct::numeric / 100.0) * r.land_size, 4);
    ELSE
      v_action := 'skipped_no_relation';
      v_reason := 'no active land_relations row for this farmer/land';
    END IF;

    IF v_action IS NULL AND (v_old_area IS NULL OR v_old_area = 0) THEN
      v_action := 'skipped_no_old_area';
      v_reason := 'billed_area_shotok/land_size is null or zero';
    END IF;

    IF v_action IS NULL AND COALESCE(r.paid_amount, 0) > 0 THEN
      v_action := 'skipped_paid';
      v_reason := 'paid_amount > 0 (safe mode)';
    END IF;

    IF v_action IS NULL AND abs(v_new_area - v_old_area) < 0.0001 THEN
      v_action := 'noop_same_area';
    END IF;

    IF v_action IS NOT NULL THEN
      INSERT INTO public.irrigation_invoice_backfill_audit
        (invoice_id, invoice_no, farmer_id, land_id, old_area, new_area,
         old_payable, new_payable, old_irrigation_amount, new_irrigation_amount,
         old_due, new_due, paid_amount, action, reason)
      VALUES
        (r.id, r.invoice_no, r.farmer_id, r.land_id, v_old_area, v_new_area,
         r.payable_amount, NULL, r.irrigation_amount, NULL,
         r.due_amount, NULL, r.paid_amount, v_action, v_reason);
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
      v_new_status := r.invoice_status;
    END IF;

    UPDATE public.irrigation_invoices
    SET billed_area_shotok = v_new_area,
        parcel_area_shotok = COALESCE(parcel_area_shotok, r.land_size),
        irrigation_amount = v_new_irr,
        payable_amount = v_new_payable,
        due_amount = v_new_due,
        invoice_status = v_new_status,
        calculation_snapshot = COALESCE(calculation_snapshot, '{}'::jsonb) || jsonb_build_object(
          'backfilled_at', now(),
          'backfill_source', 'borga_area_fix_2026_07_14',
          'backfill_old', jsonb_build_object(
            'billed_area_shotok', v_old_area,
            'irrigation_amount', r.irrigation_amount,
            'payable_amount', r.payable_amount,
            'due_amount', r.due_amount,
            'invoice_status', r.invoice_status
          ),
          'backfill_new', jsonb_build_object(
            'billed_area_shotok', v_new_area,
            'irrigation_amount', v_new_irr,
            'payable_amount', v_new_payable,
            'due_amount', v_new_due,
            'invoice_status', v_new_status
          )
        ),
        updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.irrigation_invoice_backfill_audit
      (invoice_id, invoice_no, farmer_id, land_id, old_area, new_area,
       old_payable, new_payable, old_irrigation_amount, new_irrigation_amount,
       old_due, new_due, paid_amount, action, reason)
    VALUES
      (r.id, r.invoice_no, r.farmer_id, r.land_id, v_old_area, v_new_area,
       r.payable_amount, v_new_payable, r.irrigation_amount, v_new_irr,
       r.due_amount, v_new_due, r.paid_amount, 'updated', NULL);
  END LOOP;
END
$backfill$;

NOTIFY pgrst, 'reload schema';
