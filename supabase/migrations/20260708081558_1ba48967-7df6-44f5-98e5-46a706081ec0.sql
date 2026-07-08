-- Fix irrigation invoice payable/due double-counting.
-- Billing model: payable = irrigation + delay_fee + other_charge - discount.
-- Maintenance & canal are internal splits of the irrigation amount and must NOT
-- be added on top (they inflated the payable/due, e.g. doubling when the
-- percentages summed to 100%). Align the trigger, recalc function and existing rows.

-- 1) BEFORE INSERT/UPDATE recalc trigger
CREATE OR REPLACE FUNCTION public.tg_irrigation_invoice_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.payable_amount := GREATEST(
      COALESCE(NEW.irrigation_amount,0)
    + COALESCE(NEW.delay_fee,0)
    + COALESCE(NEW.other_charge,0)
    - COALESCE(NEW.discount_amount,0), 0);
  NEW.due_amount := GREATEST(NEW.payable_amount - COALESCE(NEW.paid_amount,0), 0);
  NEW.updated_at := now();

  IF NEW.invoice_status <> 'cancelled' AND NEW.deleted_at IS NULL THEN
    IF NEW.paid_amount >= NEW.payable_amount AND NEW.payable_amount > 0 THEN
      NEW.invoice_status := 'paid';
    ELSIF NEW.paid_amount > 0 THEN
      NEW.invoice_status := 'partial_paid';
    ELSIF NEW.due_date < CURRENT_DATE THEN
      NEW.invoice_status := 'overdue';
    ELSIF NEW.invoice_status = 'draft' THEN
      NEW.invoice_status := 'draft';
    ELSE
      NEW.invoice_status := 'generated';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Admin recalc RPC: exclude maintenance & canal from payable
CREATE OR REPLACE FUNCTION public.recalculate_irrigation_invoice(_invoice_id uuid, _reason text)
 RETURNS irrigation_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.irrigation_invoices%ROWTYPE;
  rate_row public.irrigation_season_rates%ROWTYPE;
  land_row public.lands%ROWTYPE;
  ltype public.land_types%ROWTYPE;
  settings public.irrigation_charge_settings%ROWTYPE;
  irrigation_amt numeric := 0;
  maint_amt numeric := 0;
  canal_amt numeric := 0;
  payable numeric := 0;
  due numeric := 0;
  new_snapshot jsonb;
  old_snapshot jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.is_admin_or_super(auth.uid())) THEN
    RAISE EXCEPTION 'Permission denied: admin role required to recalculate invoices'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO inv FROM public.irrigation_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required for recalculation';
  END IF;

  SELECT * INTO land_row FROM public.lands WHERE id = inv.land_id;

  SELECT * INTO rate_row
  FROM public.irrigation_season_rates
  WHERE irrigation_season_id = inv.season_id
    AND land_type_id = land_row.land_type_id
    AND (office_id = inv.office_id OR office_id IS NULL)
  ORDER BY (office_id IS NOT NULL) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No season rate configured for this season + land type';
  END IF;

  SELECT * INTO ltype FROM public.land_types WHERE id = land_row.land_type_id;

  SELECT * INTO settings FROM public.irrigation_charge_settings
  WHERE office_id = inv.office_id LIMIT 1;

  irrigation_amt := round((COALESCE(land_row.land_size,0) * rate_row.rate_per_shotok)::numeric, 2);
  maint_amt := round((irrigation_amt * COALESCE(settings.maintenance_percent,0) / 100)::numeric, 2);
  canal_amt := round((irrigation_amt * COALESCE(settings.canal_percent,0) / 100)::numeric, 2);
  -- Maintenance & canal are informational only; not added to the payable.
  payable := GREATEST(round((irrigation_amt + COALESCE(inv.delay_fee,0)
                            + COALESCE(inv.other_charge,0)
                            - COALESCE(inv.discount_amount,0))::numeric, 2), 0);
  due := GREATEST(payable - COALESCE(inv.paid_amount,0), 0);

  old_snapshot := jsonb_build_object(
    'season_rate', inv.season_rate,
    'land_type_id', inv.land_type_id,
    'land_type_name', inv.land_type_name,
    'calculation_snapshot', inv.calculation_snapshot,
    'irrigation_amount', inv.irrigation_amount,
    'maintenance_amount', inv.maintenance_amount,
    'canal_amount', inv.canal_amount,
    'payable_amount', inv.payable_amount,
    'due_amount', inv.due_amount
  );

  new_snapshot := jsonb_build_object(
    'rate_per_shotok', rate_row.rate_per_shotok,
    'land_size_shotok', land_row.land_size,
    'land_type_id', land_row.land_type_id,
    'land_type_name', COALESCE(ltype.name_bn, ltype.name, ltype.code),
    'maintenance_percent', COALESCE(settings.maintenance_percent,0),
    'canal_percent', COALESCE(settings.canal_percent,0),
    'irrigation_amount', irrigation_amt,
    'maintenance_amount', maint_amt,
    'canal_amount', canal_amt,
    'payable_amount', payable,
    'recalculated_at', now(),
    'reason', _reason,
    'source', 'recalculate'
  );

  INSERT INTO public.irrigation_invoice_audit (invoice_id, action, user_id, office_id, old_values, new_values, note)
  VALUES (inv.id, 'recalculate', auth.uid(), inv.office_id, old_snapshot, new_snapshot, _reason);

  PERFORM set_config('app.allow_snapshot_rewrite', 'on', true);

  UPDATE public.irrigation_invoices SET
    season_rate = rate_row.rate_per_shotok,
    land_type_id = land_row.land_type_id,
    land_type_name = COALESCE(ltype.name_bn, ltype.name, ltype.code),
    calculation_snapshot = new_snapshot,
    irrigation_amount = irrigation_amt,
    maintenance_amount = maint_amt,
    canal_amount = canal_amt,
    payable_amount = payable,
    due_amount = due,
    recalculated_at = now(),
    recalculated_by = auth.uid(),
    updated_at = now()
  WHERE id = inv.id
  RETURNING * INTO inv;

  PERFORM set_config('app.allow_snapshot_rewrite', 'off', true);

  RETURN inv;
END;
$function$;

-- 3) Backfill existing invoices so payable/due exclude maintenance & canal.
--    The BEFORE UPDATE trigger recomputes payable/due/status from the columns.
UPDATE public.irrigation_invoices
   SET updated_at = now()
 WHERE deleted_at IS NULL
   AND invoice_status <> 'cancelled';

NOTIFY pgrst, 'reload schema';