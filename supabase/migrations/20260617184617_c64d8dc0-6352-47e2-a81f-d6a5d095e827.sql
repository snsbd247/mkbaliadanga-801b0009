-- hand_cash_submissions: replace always-true INSERT/UPDATE policies with office-scoped ones
DROP POLICY IF EXISTS "Authenticated can insert hand cash submissions" ON public.hand_cash_submissions;
DROP POLICY IF EXISTS "Authenticated can update hand cash submissions" ON public.hand_cash_submissions;

CREATE POLICY "Office can insert hand cash submissions"
ON public.hand_cash_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  office_id IS NOT NULL
  AND office_id = (SELECT profiles.office_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Office can update hand cash submissions"
ON public.hand_cash_submissions
FOR UPDATE
TO authenticated
USING (
  office_id = (SELECT profiles.office_id FROM public.profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  office_id = (SELECT profiles.office_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- member_block_audit: replace always-true INSERT policy with office-scoped one
DROP POLICY IF EXISTS "Authenticated can log member blocks" ON public.member_block_audit;

CREATE POLICY "Office can log member blocks"
ON public.member_block_audit
FOR INSERT
TO authenticated
WITH CHECK (
  office_id IS NULL
  OR office_id = (SELECT profiles.office_id FROM public.profiles WHERE profiles.id = auth.uid())
);
