
-- Prevent duplicate scan payments using a per-minute idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS payments_idem_key_uniq
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Allow admins (not just super admin) to read audit logs for their own office
DROP POLICY IF EXISTS "admin read office audit" ON public.audit_logs;
CREATE POLICY "admin read office audit"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (is_admin_or_super(auth.uid()) AND (office_id IS NULL OR office_id = current_user_office()))
);
