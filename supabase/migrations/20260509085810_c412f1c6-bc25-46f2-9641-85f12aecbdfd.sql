
-- 1) Rename + extend lookups (tables are empty/freshly created in prior migration)
ALTER TABLE public.season_types RENAME TO irrigation_season_types;
ALTER TABLE public.field_types RENAME TO land_types;

ALTER TABLE public.irrigation_season_types
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE public.irrigation_season_types SET name_en = name WHERE name_en IS NULL;

ALTER TABLE public.land_types
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE public.land_types SET name_en = name WHERE name_en IS NULL;

-- 2) Drop & recreate the rate table with FK to land_types (was empty)
DROP TABLE IF EXISTS public.season_field_rates CASCADE;
CREATE TABLE public.irrigation_season_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  irrigation_season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  land_type_id uuid NOT NULL REFERENCES public.land_types(id) ON DELETE RESTRICT,
  rate_per_shotok numeric NOT NULL DEFAULT 0,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_isr ON public.irrigation_season_rates
  (irrigation_season_id, land_type_id, COALESCE(office_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_isr_season ON public.irrigation_season_rates(irrigation_season_id);

ALTER TABLE public.irrigation_season_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office read isr" ON public.irrigation_season_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "admin manage isr" ON public.irrigation_season_rates FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));
CREATE TRIGGER trg_isr_updated_at BEFORE UPDATE ON public.irrigation_season_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Extend seasons (additive, nullable for backward compat)
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS fiscal_year text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 4) Lands: optional land_type_id overlay (keeps legacy field_type enum)
ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS land_type_id uuid REFERENCES public.land_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lands_land_type_id ON public.lands(land_type_id);

-- Backfill: link existing lands to seeded land_types via matching code
UPDATE public.lands l SET land_type_id = lt.id
  FROM public.land_types lt WHERE lt.code = l.field_type::text AND l.land_type_id IS NULL;

-- 5) Invoice snapshot fields (so historical invoices are immutable)
ALTER TABLE public.irrigation_invoices
  ADD COLUMN IF NOT EXISTS season_rate numeric,
  ADD COLUMN IF NOT EXISTS land_type_id uuid REFERENCES public.land_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS land_type_name text,
  ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb;

-- 6) Dependency guard: prevent hard delete if referenced; force soft delete
CREATE OR REPLACE FUNCTION public.guard_lookup_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  used_count int := 0;
BEGIN
  IF TG_TABLE_NAME = 'land_types' THEN
    SELECT count(*) INTO used_count FROM public.lands WHERE land_type_id = OLD.id AND deleted_at IS NULL;
    IF used_count > 0 THEN
      RAISE EXCEPTION 'এই জমির ধরন % টি জমিতে ব্যবহৃত হচ্ছে — মুছে ফেলা যাবে না (deactivate করুন)', used_count;
    END IF;
    SELECT count(*) INTO used_count FROM public.irrigation_invoices WHERE land_type_id = OLD.id;
    IF used_count > 0 THEN
      RAISE EXCEPTION 'এই জমির ধরন % টি ইনভয়েসে রেফারড — মুছে ফেলা যাবে না', used_count;
    END IF;
  ELSIF TG_TABLE_NAME = 'irrigation_season_types' THEN
    SELECT count(*) INTO used_count FROM public.seasons WHERE season_type_id = OLD.id;
    IF used_count > 0 THEN
      RAISE EXCEPTION 'এই সিজন টাইপ % টি সিজনে ব্যবহৃত — মুছে ফেলা যাবে না', used_count;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_land_types_del ON public.land_types;
CREATE TRIGGER trg_guard_land_types_del BEFORE DELETE ON public.land_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_lookup_delete();

DROP TRIGGER IF EXISTS trg_guard_season_types_del ON public.irrigation_season_types;
CREATE TRIGGER trg_guard_season_types_del BEFORE DELETE ON public.irrigation_season_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_lookup_delete();
