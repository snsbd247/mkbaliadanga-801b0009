-- Tighten opening_balances RLS: remove permissive USING (true) policies and
-- scope reads/writes by office, restricting writes to admin/super_admin.
DROP POLICY IF EXISTS "auth read opening_balances" ON public.opening_balances;
DROP POLICY IF EXISTS "auth write opening_balances" ON public.opening_balances;

-- Reads: users see their own office's rows (and global rows where office_id IS NULL); super_admin sees all.
CREATE POLICY "opening_balances select scoped"
  ON public.opening_balances
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR office_id IS NULL
    OR office_id = public.current_user_office()
  );

-- Writes: only admin/super_admin, and only within their office (super_admin unrestricted).
CREATE POLICY "opening_balances insert admin scoped"
  ON public.opening_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND (office_id IS NULL OR office_id = public.current_user_office())
    )
  );

CREATE POLICY "opening_balances update admin scoped"
  ON public.opening_balances
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND (office_id IS NULL OR office_id = public.current_user_office())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND (office_id IS NULL OR office_id = public.current_user_office())
    )
  );

CREATE POLICY "opening_balances delete admin scoped"
  ON public.opening_balances
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND (office_id IS NULL OR office_id = public.current_user_office())
    )
  );