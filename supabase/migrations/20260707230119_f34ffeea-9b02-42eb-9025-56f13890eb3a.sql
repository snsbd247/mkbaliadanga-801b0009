-- 1. irrigation_invoices: restrict UPDATE policy to authenticated role
DROP POLICY IF EXISTS "office update irrigation_invoices" ON public.irrigation_invoices;
CREATE POLICY "office update irrigation_invoices"
ON public.irrigation_invoices
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR (office_id = current_user_office()))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (office_id = current_user_office()));

-- 2. member_block_audit: require office_id to match caller's office (no NULL office inserts)
DROP POLICY IF EXISTS "Office can log member blocks" ON public.member_block_audit;
CREATE POLICY "Office can log member blocks"
ON public.member_block_audit
FOR INSERT
TO authenticated
WITH CHECK (
  office_id = (SELECT profiles.office_id FROM profiles WHERE profiles.id = auth.uid())
);

DROP POLICY IF EXISTS "Office can view member block audit" ON public.member_block_audit;
CREATE POLICY "Office can view member block audit"
ON public.member_block_audit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = (SELECT profiles.office_id FROM profiles WHERE profiles.id = auth.uid())
);

-- 3. receipt_sequences: scope SELECT to caller's office
DROP POLICY IF EXISTS "receipt_sequences_read_office" ON public.receipt_sequences;
CREATE POLICY "receipt_sequences_read_office"
ON public.receipt_sequences
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = current_user_office()
);

-- 4. sms_settings: restrict SELECT to admin/super_admin roles only
DROP POLICY IF EXISTS "auth read sms_settings" ON public.sms_settings;
CREATE POLICY "admin read sms_settings"
ON public.sms_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);