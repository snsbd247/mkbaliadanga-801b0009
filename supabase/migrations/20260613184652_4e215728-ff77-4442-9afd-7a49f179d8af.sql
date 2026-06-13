
-- 1. irrigation_invoices: office-scoped read
DROP POLICY IF EXISTS "read irrigation_invoices" ON public.irrigation_invoices;
CREATE POLICY "read irrigation_invoices" ON public.irrigation_invoices
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR office_id = current_user_office()
);

-- 2. office_incomes: office-scoped read, admin-gated writes
DROP POLICY IF EXISTS "Authenticated can view office incomes" ON public.office_incomes;
DROP POLICY IF EXISTS "Authenticated can insert office incomes" ON public.office_incomes;
DROP POLICY IF EXISTS "Authenticated can update office incomes" ON public.office_incomes;
DROP POLICY IF EXISTS "Authenticated can delete office incomes" ON public.office_incomes;

CREATE POLICY "view office incomes" ON public.office_incomes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR office_id = current_user_office());

CREATE POLICY "insert office incomes" ON public.office_incomes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office())
);

CREATE POLICY "update office incomes" ON public.office_incomes
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office()))
WITH CHECK (has_role(auth.uid(), 'super_admin') OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office()));

CREATE POLICY "delete office incomes" ON public.office_incomes
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR (is_admin_or_super(auth.uid()) AND office_id = current_user_office()));

-- 3. vouchers storage: office-scoped read & update (paths are prefixed "<office_id>/...")
DROP POLICY IF EXISTS "vouchers_storage_read" ON storage.objects;
CREATE POLICY "vouchers_storage_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'vouchers' AND (
    has_role(auth.uid(), 'super_admin')
    OR name LIKE current_user_office()::text || '/%'
  )
);

DROP POLICY IF EXISTS "vouchers_storage_update" ON storage.objects;
CREATE POLICY "vouchers_storage_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'vouchers' AND (
    has_role(auth.uid(), 'super_admin')
    OR name LIKE current_user_office()::text || '/%'
  )
);

-- 4. farmer-photos storage: office-scoped insert/update (paths contain farmer id)
DROP POLICY IF EXISTS "auth upload farmer photos" ON storage.objects;
DROP POLICY IF EXISTS "farmer photos auth write" ON storage.objects;
CREATE POLICY "farmer photos office insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'farmer-photos' AND (
    has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.office_id = current_user_office()
        AND (objects.name LIKE f.id::text || '%' OR objects.name LIKE '%/' || f.id::text || '%')
    )
  )
);

DROP POLICY IF EXISTS "auth update farmer photos" ON storage.objects;
DROP POLICY IF EXISTS "farmer photos auth update" ON storage.objects;
CREATE POLICY "farmer photos office update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'farmer-photos' AND (
    has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.office_id = current_user_office()
        AND (objects.name LIKE f.id::text || '%' OR objects.name LIKE '%/' || f.id::text || '%')
    )
  )
);

-- 5. farmer_notes: office-scoped insert
DROP POLICY IF EXISTS "farmer_notes_insert" ON public.farmer_notes;
CREATE POLICY "farmer_notes_insert" ON public.farmer_notes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.farmers f
    WHERE f.id = farmer_id
      AND (has_role(auth.uid(), 'super_admin') OR f.office_id = current_user_office())
  )
);
