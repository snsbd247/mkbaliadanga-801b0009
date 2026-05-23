
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.land_history
  ADD COLUMN IF NOT EXISTS crop text,
  ADD COLUMN IF NOT EXISTS yield_amount numeric,
  ADD COLUMN IF NOT EXISTS yield_unit text;

CREATE TABLE IF NOT EXISTS public.land_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  land_id uuid,
  farmer_id uuid,
  office_id uuid,
  change_type text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  remarks text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.land_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff read land change log"
  ON public.land_change_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated insert land change log"
  ON public.land_change_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_land_change_log_land ON public.land_change_log(land_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_land_change_log_farmer ON public.land_change_log(farmer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.public_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_code text NOT NULL,
  phone text,
  amount numeric NOT NULL CHECK (amount > 0),
  allocation_hint text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  processed_by uuid,
  processed_at timestamptz,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a payment intent"
  ON public.public_payment_intents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin/staff read payment intents"
  ON public.public_payment_intents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin/staff update payment intents"
  ON public.public_payment_intents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_public_payment_intents_status ON public.public_payment_intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_payment_intents_farmer ON public.public_payment_intents(farmer_code);
