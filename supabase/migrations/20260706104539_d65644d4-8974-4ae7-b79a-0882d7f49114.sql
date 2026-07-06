-- 1. land_change_log: scope policies to authenticated
DROP POLICY IF EXISTS "Admin/staff read land change log" ON public.land_change_log;
CREATE POLICY "Admin/staff read land change log" ON public.land_change_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated insert land change log" ON public.land_change_log;
CREATE POLICY "Authenticated insert land change log" ON public.land_change_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. land_note_attachments: scope policies to authenticated
DROP POLICY IF EXISTS "land_note_att_delete" ON public.land_note_attachments;
CREATE POLICY "land_note_att_delete" ON public.land_note_attachments
  FOR DELETE TO authenticated
  USING ((created_by = auth.uid()) OR is_committee_or_super(auth.uid()));

DROP POLICY IF EXISTS "land_note_att_insert" ON public.land_note_attachments;
CREATE POLICY "land_note_att_insert" ON public.land_note_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM lands l
    WHERE ((l.id = land_note_attachments.land_id) AND (has_role(auth.uid(), 'super_admin'::app_role) OR (l.office_id = current_user_office())))));

DROP POLICY IF EXISTS "land_note_att_read" ON public.land_note_attachments;
CREATE POLICY "land_note_att_read" ON public.land_note_attachments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (EXISTS ( SELECT 1 FROM lands l
    WHERE ((l.id = land_note_attachments.land_id) AND (l.office_id = current_user_office())))));

-- 3. land_note_audit: scope policies to authenticated
DROP POLICY IF EXISTS "land_note_audit_insert" ON public.land_note_audit;
CREATE POLICY "land_note_audit_insert" ON public.land_note_audit
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM lands l
    WHERE ((l.id = land_note_audit.land_id) AND (has_role(auth.uid(), 'super_admin'::app_role) OR (l.office_id = current_user_office())))));

DROP POLICY IF EXISTS "land_note_audit_read" ON public.land_note_audit;
CREATE POLICY "land_note_audit_read" ON public.land_note_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (EXISTS ( SELECT 1 FROM lands l
    WHERE ((l.id = land_note_audit.land_id) AND (l.office_id = current_user_office())))));

-- 4. public_payment_intents: scope policies to authenticated
DROP POLICY IF EXISTS "Admin/staff read payment intents" ON public.public_payment_intents;
CREATE POLICY "Admin/staff read payment intents" ON public.public_payment_intents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin/staff update payment intents" ON public.public_payment_intents;
CREATE POLICY "Admin/staff update payment intents" ON public.public_payment_intents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 5. profiles: office-scope the admin (non-super) read; keep super_admin/developer global and own-row access
DROP POLICY IF EXISTS "profiles read" ON public.profiles;
CREATE POLICY "profiles read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (id = auth.uid())
    OR is_developer(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND office_id = current_user_office())
  );

-- 6. Storage: remove broad public listing on the branding bucket.
-- Public direct downloads by known path still work via the public storage endpoint.
DROP POLICY IF EXISTS "branding read by name" ON storage.objects;
CREATE POLICY "branding read by name" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding'::text);