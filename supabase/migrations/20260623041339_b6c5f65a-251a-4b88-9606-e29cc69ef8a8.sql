ALTER TABLE public.irrigation_season_rates
  ADD COLUMN IF NOT EXISTS calculation_basis text NOT NULL DEFAULT 'per_shotok';

DO $$
BEGIN
  PERFORM set_config('app.allow_snapshot_rewrite', 'on', true);
  UPDATE public.irrigation_invoices
  SET calculation_snapshot = jsonb_strip_nulls(jsonb_build_object(
        'backfilled', true,
        'basis', 'per_shotok',
        'season_rate', season_rate,
        'applied_rate', applied_rate,
        'land_type_id', land_type_id,
        'land_type_name', land_type_name,
        'irrigation_amount', irrigation_amount,
        'maintenance_amount', maintenance_amount,
        'canal_amount', canal_amount,
        'delay_fee', delay_fee,
        'other_charge', other_charge,
        'payable_amount', payable_amount,
        'paid_amount', paid_amount,
        'due_amount', due_amount
      ))
  WHERE calculation_snapshot IS NULL;
END $$;