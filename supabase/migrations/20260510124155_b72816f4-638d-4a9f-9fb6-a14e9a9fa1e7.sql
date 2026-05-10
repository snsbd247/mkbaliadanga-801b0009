
-- Enums
DO $$ BEGIN
  CREATE TYPE public.asset_tracking_mode AS ENUM ('quantity','serial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_status AS ENUM ('purchased','in_stock','transferred','installed','maintenance','damaged','disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_disposal_method AS ENUM ('scrap_sale','write_off','donation','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- asset_categories
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  name_bn text,
  name_en text NOT NULL,
  code text NOT NULL,
  tracking_mode public.asset_tracking_mode NOT NULL DEFAULT 'quantity',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_asset_categories_office ON public.asset_categories(office_id) WHERE deleted_at IS NULL;

-- assets registry
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_category_id uuid REFERENCES public.asset_categories(id),
  asset_code text NOT NULL,
  serial_no text,
  name_bn text,
  name_en text NOT NULL,
  tracking_mode public.asset_tracking_mode NOT NULL DEFAULT 'quantity',
  unit text,
  purchase_price numeric NOT NULL DEFAULT 0,
  warranty_until date,
  current_status public.asset_status NOT NULL DEFAULT 'purchased',
  current_location_id uuid,
  installed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_office_code ON public.assets(office_id, asset_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_office_status ON public.assets(office_id, current_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(asset_category_id);

-- asset_stocks
CREATE TABLE IF NOT EXISTS public.asset_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  location_id uuid,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_stocks_asset_loc ON public.asset_stocks(asset_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_asset_stocks_office ON public.asset_stocks(office_id);

-- asset_purchases
CREATE TABLE IF NOT EXISTS public.asset_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  supplier text,
  invoice_no text,
  payment_method text DEFAULT 'cash',
  journal_entry_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_asset_purchases_office ON public.asset_purchases(office_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_asset_purchases_asset ON public.asset_purchases(asset_id);

-- asset_movements
CREATE TABLE IF NOT EXISTS public.asset_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  from_location_id uuid,
  to_location_id uuid,
  quantity numeric NOT NULL DEFAULT 1,
  moved_by uuid,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_movements_asset ON public.asset_movements(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_movements_office ON public.asset_movements(office_id, movement_date);

-- asset_installations
CREATE TABLE IF NOT EXISTS public.asset_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  location_id uuid,
  location_name text,
  installed_by uuid,
  install_date date NOT NULL DEFAULT CURRENT_DATE,
  condition_status text DEFAULT 'good',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_installations_asset ON public.asset_installations(asset_id, install_date DESC);

-- asset_maintenance_logs
CREATE TABLE IF NOT EXISTS public.asset_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  cost numeric NOT NULL DEFAULT 0,
  downtime_days integer NOT NULL DEFAULT 0,
  status text DEFAULT 'completed',
  remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON public.asset_maintenance_logs(asset_id, maintenance_date DESC);

-- asset_damage_reports
CREATE TABLE IF NOT EXISTS public.asset_damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  severity text DEFAULT 'minor',
  reported_by uuid,
  status text DEFAULT 'open',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_damage_asset ON public.asset_damage_reports(asset_id, report_date DESC);

-- asset_disposals
CREATE TABLE IF NOT EXISTS public.asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  method public.asset_disposal_method NOT NULL DEFAULT 'scrap_sale',
  sale_amount numeric NOT NULL DEFAULT 0,
  book_value numeric NOT NULL DEFAULT 0,
  gain_loss numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid,
  remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON public.asset_disposals(asset_id, disposal_date DESC);

-- asset_audit_logs
CREATE TABLE IF NOT EXISTS public.asset_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  user_id uuid,
  asset_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_audit_asset ON public.asset_audit_logs(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_audit_office ON public.asset_audit_logs(office_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.asset_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_stocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_installations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_damage_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_disposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_audit_logs       ENABLE ROW LEVEL SECURITY;

-- Generic RLS pattern: office-scoped read; staff insert in own office; admin update; super delete
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'asset_categories','assets','asset_stocks','asset_purchases',
    'asset_movements','asset_installations','asset_maintenance_logs',
    'asset_damage_reports','asset_disposals'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "office read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "office read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (has_role(auth.uid(),''super_admin''::app_role) OR office_id = current_user_office() OR office_id IS NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS "office insert %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "office insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),''super_admin''::app_role) OR office_id = current_user_office() OR office_id IS NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS "admin update %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "admin update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),''super_admin''::app_role) OR office_id = current_user_office() OR office_id IS NULL)) WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),''super_admin''::app_role) OR office_id = current_user_office() OR office_id IS NULL))', t);

    EXECUTE format('DROP POLICY IF EXISTS "super delete %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "super delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (has_role(auth.uid(),''super_admin''::app_role))', t);
  END LOOP;
END $$;

-- Audit log policies (insert-only)
DROP POLICY IF EXISTS "office read asset_audit_logs" ON public.asset_audit_logs;
CREATE POLICY "office read asset_audit_logs" ON public.asset_audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

DROP POLICY IF EXISTS "auth insert asset_audit_logs" ON public.asset_audit_logs;
CREATE POLICY "auth insert asset_audit_logs" ON public.asset_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR (user_id IS NULL));

-- updated_at triggers (reuse existing helper if present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_asset_categories_uat ON public.asset_categories';
    EXECUTE 'CREATE TRIGGER trg_asset_categories_uat BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_assets_uat ON public.assets';
    EXECUTE 'CREATE TRIGGER trg_assets_uat BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_asset_purchases_uat ON public.asset_purchases';
    EXECUTE 'CREATE TRIGGER trg_asset_purchases_uat BEFORE UPDATE ON public.asset_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;
