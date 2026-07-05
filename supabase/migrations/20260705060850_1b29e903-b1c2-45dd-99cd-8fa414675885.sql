
-- 1. Unions: restrict writes to admins/super_admins (fixes always-true write policy)
DROP POLICY IF EXISTS "Authenticated users can manage unions" ON public.unions;
CREATE POLICY "Admins can manage unions"
  ON public.unions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. payment-receipts: uploads must live under the uploader's own user id folder
DROP POLICY IF EXISTS "auth upload receipts" ON storage.objects;
CREATE POLICY "auth upload receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR split_part(name, '/', 1) = auth.uid()::text
    )
  );

-- 3. vouchers: uploads must live under the uploader's own office folder
DROP POLICY IF EXISTS "vouchers_storage_write" ON storage.objects;
CREATE POLICY "vouchers_storage_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vouchers'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR name LIKE ((current_user_office())::text || '/%')
    )
  );

-- 4. land-note-attachments: uploads must reference a land record in the uploader's office
DROP POLICY IF EXISTS "land_note_files_insert" ON storage.objects;
CREATE POLICY "land_note_files_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'land-note-attachments'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.lands l
        WHERE l.id::text = split_part(objects.name, '/', 1)
          AND l.office_id = current_user_office()
      )
    )
  );

-- 5. branding: allow public reads of this public bucket (fixes always-false condition)
DROP POLICY IF EXISTS "branding read by name" ON storage.objects;
CREATE POLICY "branding read by name"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'branding');
