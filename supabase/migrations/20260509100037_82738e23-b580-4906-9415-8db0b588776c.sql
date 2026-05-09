-- 1. SMS tracking table
CREATE TABLE IF NOT EXISTS public.irrigation_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  irrigation_invoice_id uuid REFERENCES public.irrigation_invoices(id) ON DELETE CASCADE,
  farmer_id uuid REFERENCES public.farmers(id) ON DELETE SET NULL,
  mobile text,
  sms_type text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  gateway_response jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  sent_by uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.irrigation_sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read sms logs" ON public.irrigation_sms_logs;
CREATE POLICY "office read sms logs" ON public.irrigation_sms_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS "super manage sms logs" ON public.irrigation_sms_logs;
CREATE POLICY "super manage sms logs" ON public.irrigation_sms_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "office insert sms logs" ON public.irrigation_sms_logs;
CREATE POLICY "office insert sms logs" ON public.irrigation_sms_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'super_admin'::app_role)
    OR office_id = current_user_office()
    OR office_id IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_isms_office_sent ON public.irrigation_sms_logs (office_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_isms_status ON public.irrigation_sms_logs (status);
CREATE INDEX IF NOT EXISTS idx_isms_invoice ON public.irrigation_sms_logs (irrigation_invoice_id);
CREATE INDEX IF NOT EXISTS idx_isms_farmer ON public.irrigation_sms_logs (farmer_id);

-- 2. Performance indexes for farmer-profile queries
CREATE INDEX IF NOT EXISTS idx_payments_farmer_created ON public.payments (farmer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_irr_invoices_farmer ON public.irrigation_invoices (farmer_id, deleted_at, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_irr_invoices_owner ON public.irrigation_invoices (owner_farmer_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_savings_farmer_created ON public.savings_transactions (farmer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lands_farmer ON public.lands (farmer_id, deleted_at);