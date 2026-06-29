-- ============ STORAGE: farmer-photos ============
-- Remove overly permissive blanket delete
DROP POLICY IF EXISTS "auth delete farmer photos" ON storage.objects;

-- Office-scoped delete (mirrors existing office read policy); admins keep blanket delete via existing "farmer photos admin delete"
CREATE POLICY "farmer photos office delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'farmer-photos'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.farmers f
      WHERE f.office_id = current_user_office()
        AND ((objects.name LIKE (f.id::text || '%')) OR (objects.name LIKE ('%/' || f.id::text || '%')))
    )
  )
);

-- ============ STORAGE: land-note-attachments ============
DROP POLICY IF EXISTS land_note_files_read ON storage.objects;
DROP POLICY IF EXISTS land_note_files_delete ON storage.objects;

CREATE POLICY land_note_files_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'land-note-attachments'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.land_note_attachments a
      WHERE a.file_path = objects.name
        AND a.office_id = current_user_office()
    )
  )
);

CREATE POLICY land_note_files_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'land-note-attachments'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.land_note_attachments a
      WHERE a.file_path = objects.name
        AND a.office_id = current_user_office()
    )
  )
);

-- ============ TABLE: hand_cash_submissions ============
DROP POLICY IF EXISTS "Authenticated can view hand cash submissions" ON public.hand_cash_submissions;
CREATE POLICY "Office can view hand cash submissions" ON public.hand_cash_submissions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = current_user_office()
);

-- ============ TABLE: loan_discount_audit ============
DROP POLICY IF EXISTS "Authenticated can view discount audit" ON public.loan_discount_audit;
CREATE POLICY "Office can view discount audit" ON public.loan_discount_audit
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = current_user_office()
);
