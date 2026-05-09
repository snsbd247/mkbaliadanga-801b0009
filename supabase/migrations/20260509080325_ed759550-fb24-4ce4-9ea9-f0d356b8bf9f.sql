
-- ============================================================
-- Phase 1: Irrigation Invoice System (additive, non-breaking)
-- ============================================================

-- 1. Enum for invoice status
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft', 'generated', 'partial_paid', 'paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. irrigation_charge_settings (per office)
CREATE TABLE IF NOT EXISTS public.irrigation_charge_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid UNIQUE,
  delay_fee_percent numeric NOT NULL DEFAULT 0,
  maintenance_percent numeric NOT NULL DEFAULT 0,
  canal_percent numeric NOT NULL DEFAULT 0,
  grace_days integer NOT NULL DEFAULT 0,
  auto_apply_delay_fee boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.irrigation_charge_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read irrigation_charge_settings"
  ON public.irrigation_charge_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin manage irrigation_charge_settings"
  ON public.irrigation_charge_settings FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office()))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office()));

-- 3. irrigation_invoices
CREATE TABLE IF NOT EXISTS public.irrigation_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  office_id uuid,
  season_id uuid NOT NULL,
  land_id uuid NOT NULL,
  owner_farmer_id uuid NOT NULL,
  farmer_id uuid NOT NULL,                  -- billed farmer (owner or sharecropper)
  is_borga boolean NOT NULL DEFAULT false,
  irrigation_amount numeric NOT NULL DEFAULT 0,
  maintenance_amount numeric NOT NULL DEFAULT 0,
  canal_amount numeric NOT NULL DEFAULT 0,
  delay_fee numeric NOT NULL DEFAULT 0,
  other_charge numeric NOT NULL DEFAULT 0,
  payable_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  due_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  invoice_status public.invoice_status NOT NULL DEFAULT 'generated',
  note text,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_irrigation_invoices_active_land_season
  ON public.irrigation_invoices (season_id, land_id)
  WHERE deleted_at IS NULL AND invoice_status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_farmer ON public.irrigation_invoices(farmer_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_season_office ON public.irrigation_invoices(season_id, office_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_status ON public.irrigation_invoices(invoice_status);
CREATE INDEX IF NOT EXISTS idx_irrigation_invoices_due_date ON public.irrigation_invoices(due_date);

ALTER TABLE public.irrigation_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read irrigation_invoices"
  ON public.irrigation_invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "office insert irrigation_invoices"
  ON public.irrigation_invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin update irrigation_invoices"
  ON public.irrigation_invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office()))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office()));

CREATE POLICY "super delete irrigation_invoices"
  ON public.irrigation_invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. irrigation_invoice_payments (link table)
CREATE TABLE IF NOT EXISTS public.irrigation_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.irrigation_invoices(id) ON DELETE CASCADE,
  payment_id uuid,
  collected_amount numeric NOT NULL DEFAULT 0,
  delay_fee_collected numeric NOT NULL DEFAULT 0,
  maintenance_collected numeric NOT NULL DEFAULT 0,
  canal_collected numeric NOT NULL DEFAULT 0,
  irrigation_collected numeric NOT NULL DEFAULT 0,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iip_invoice ON public.irrigation_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_iip_payment ON public.irrigation_invoice_payments(payment_id);

ALTER TABLE public.irrigation_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read iip"
  ON public.irrigation_invoice_payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "office insert iip"
  ON public.irrigation_invoice_payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "super delete iip"
  ON public.irrigation_invoice_payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. irrigation_invoice_audit
CREATE TABLE IF NOT EXISTS public.irrigation_invoice_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.irrigation_invoices(id) ON DELETE CASCADE,
  action text NOT NULL,                    -- created|updated|cancelled|regenerated|payment_applied|override
  old_values jsonb,
  new_values jsonb,
  note text,
  user_id uuid,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iia_invoice ON public.irrigation_invoice_audit(invoice_id);

ALTER TABLE public.irrigation_invoice_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read iia"
  ON public.irrigation_invoice_audit FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "auth insert iia"
  ON public.irrigation_invoice_audit FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 6. Helper: get billed farmer for a land at a date
CREATE OR REPLACE FUNCTION public.get_billed_farmer_for_land(_land_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(farmer_id uuid, owner_farmer_id uuid, is_borga boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _crop  uuid;
BEGIN
  SELECT l.owner_farmer_id INTO _owner FROM public.lands l WHERE l.id = _land_id;
  IF _owner IS NULL THEN
    SELECT l.farmer_id INTO _owner FROM public.lands l WHERE l.id = _land_id;
  END IF;

  SELECT lr.sharecropper_farmer_id INTO _crop
  FROM public.land_relations lr
  WHERE lr.land_id = _land_id
    AND lr.deleted_at IS NULL
    AND lr.sharecropper_farmer_id IS NOT NULL
    AND lr.valid_from <= _as_of
    AND (lr.valid_to IS NULL OR lr.valid_to >= _as_of)
  ORDER BY lr.valid_from DESC
  LIMIT 1;

  IF _crop IS NOT NULL THEN
    RETURN QUERY SELECT _crop, _owner, true;
  ELSE
    RETURN QUERY SELECT _owner, _owner, false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_billed_farmer_for_land(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billed_farmer_for_land(uuid, date) TO authenticated;

-- 7. Helper: generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _date text := to_char(now(), 'YYYYMMDD');
  _seq  int;
  _no   text;
BEGIN
  SELECT COUNT(*) + 1 INTO _seq
  FROM public.irrigation_invoices
  WHERE invoice_no LIKE 'INV-' || _date || '-%';
  _no := 'INV-' || _date || '-' || lpad(_seq::text, 4, '0');
  RETURN _no;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoice_no() TO authenticated;

-- 8. Trigger: keep due_amount + invoice_status in sync
CREATE OR REPLACE FUNCTION public.tg_irrigation_invoice_recalc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.payable_amount := COALESCE(NEW.irrigation_amount,0) + COALESCE(NEW.maintenance_amount,0)
                      + COALESCE(NEW.canal_amount,0) + COALESCE(NEW.delay_fee,0)
                      + COALESCE(NEW.other_charge,0);
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
$$;

DROP TRIGGER IF EXISTS trg_irrigation_invoice_recalc ON public.irrigation_invoices;
CREATE TRIGGER trg_irrigation_invoice_recalc
  BEFORE INSERT OR UPDATE ON public.irrigation_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_irrigation_invoice_recalc();
