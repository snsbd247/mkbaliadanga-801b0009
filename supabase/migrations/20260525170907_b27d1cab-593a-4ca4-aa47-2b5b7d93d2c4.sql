
-- Tighten office-scoped read policies

DROP POLICY IF EXISTS bank_accounts_read ON public.bank_accounts;
CREATE POLICY bank_accounts_read ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS bank_txn_read ON public.bank_transactions;
CREATE POLICY bank_txn_read ON public.bank_transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS vouchers_read ON public.vouchers;
CREATE POLICY vouchers_read ON public.vouchers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

-- farmer_notes: filter by farmer's office
DROP POLICY IF EXISTS farmer_notes_read ON public.farmer_notes;
CREATE POLICY farmer_notes_read ON public.farmer_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.id = farmer_notes.farmer_id
        AND f.office_id = current_user_office()
    )
  );

-- land_history: tighten writes to office
DROP POLICY IF EXISTS land_history_insert ON public.land_history;
CREATE POLICY land_history_insert ON public.land_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS land_history_update ON public.land_history;
CREATE POLICY land_history_update ON public.land_history
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office())
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS land_history_select ON public.land_history;
CREATE POLICY land_history_select ON public.land_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

-- cashbook_submissions: restrict reads via submitter's office
DROP POLICY IF EXISTS "Authenticated can view cashbook submissions" ON public.cashbook_submissions;
CREATE POLICY "Authenticated can view cashbook submissions"
  ON public.cashbook_submissions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = cashbook_submissions.submitted_by
        AND p.office_id = current_user_office()
    )
  );

-- profiles: restrict to own profile + admin/super
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
CREATE POLICY "profiles read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_developer(auth.uid())
    OR is_admin_or_super(auth.uid())
  );

-- voucher_sequences: split overly-permissive ALL policy
DROP POLICY IF EXISTS voucher_seq_all ON public.voucher_sequences;
CREATE POLICY voucher_seq_select ON public.voucher_sequences
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());
CREATE POLICY voucher_seq_insert ON public.voucher_sequences
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());
CREATE POLICY voucher_seq_update ON public.voucher_sequences
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office())
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());
CREATE POLICY voucher_seq_delete ON public.voucher_sequences
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Make farmer-photos bucket private and add office-scoped read
UPDATE storage.buckets SET public = false WHERE id = 'farmer-photos';

DROP POLICY IF EXISTS "farmer photos read by name" ON storage.objects;
CREATE POLICY "farmer photos office read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'farmer-photos'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.farmers f
        WHERE f.office_id = current_user_office()
          AND (
            storage.objects.name LIKE f.id::text || '%'
            OR storage.objects.name LIKE '%/' || f.id::text || '%'
          )
      )
    )
  );

-- payment-receipts: restrict reads by ownership / office membership / super_admin
DROP POLICY IF EXISTS "auth read receipts" ON storage.objects;
CREATE POLICY "auth read receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.office_id IS NOT NULL
          AND position(p.office_id::text in storage.objects.name) > 0
      )
    )
  );
