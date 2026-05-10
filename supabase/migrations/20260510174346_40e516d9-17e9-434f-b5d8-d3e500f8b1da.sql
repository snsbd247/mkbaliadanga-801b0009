
-- Phase 1: Asset module foundation (additive)

-- 1. asset_type enum + column
DO $$ BEGIN
  CREATE TYPE public.asset_type AS ENUM ('inventory','fixed_asset','consumable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS asset_type public.asset_type NOT NULL DEFAULT 'fixed_asset';

CREATE INDEX IF NOT EXISTS idx_assets_office_type
  ON public.assets(office_id, asset_type) WHERE deleted_at IS NULL;

-- 2. extend asset_status enum
ALTER TYPE public.asset_status ADD VALUE IF NOT EXISTS 'in_use';
ALTER TYPE public.asset_status ADD VALUE IF NOT EXISTS 'scrapped';
ALTER TYPE public.asset_status ADD VALUE IF NOT EXISTS 'lost';

-- 3. lifecycle_status mirror column
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS lifecycle_status text;

UPDATE public.assets
   SET lifecycle_status = current_status::text
 WHERE lifecycle_status IS NULL;

CREATE OR REPLACE FUNCTION public.assets_status_mirror()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    NEW.lifecycle_status := NEW.current_status::text;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assets_status_mirror ON public.assets;
CREATE TRIGGER trg_assets_status_mirror
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.assets_status_mirror();

-- 4. soft-delete columns
ALTER TABLE public.asset_movements        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.asset_installations    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.asset_maintenance_logs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.asset_damage_reports   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.asset_disposals        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 5. perf indexes
CREATE INDEX IF NOT EXISTS idx_asset_movements_asset_date
  ON public.asset_movements(asset_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_asset_stocks_loc_asset
  ON public.asset_stocks(location_id, asset_id);

-- 6. depreciation type guard — only fixed_asset can have depreciation rows
CREATE OR REPLACE FUNCTION public.depreciation_type_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_type public.asset_type;
BEGIN
  SELECT asset_type INTO v_type FROM public.assets WHERE id = NEW.asset_id;
  IF v_type IS DISTINCT FROM 'fixed_asset' THEN
    RAISE EXCEPTION 'Depreciation is only allowed for fixed_asset items (asset_id=%, type=%)', NEW.asset_id, v_type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_depreciation_settings_type_guard ON public.asset_depreciation_settings;
CREATE TRIGGER trg_depreciation_settings_type_guard
  BEFORE INSERT OR UPDATE ON public.asset_depreciation_settings
  FOR EACH ROW EXECUTE FUNCTION public.depreciation_type_guard();

DROP TRIGGER IF EXISTS trg_depreciation_schedule_type_guard ON public.asset_depreciation_schedule;
CREATE TRIGGER trg_depreciation_schedule_type_guard
  BEFORE INSERT ON public.asset_depreciation_schedule
  FOR EACH ROW EXECUTE FUNCTION public.depreciation_type_guard();
