
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS stream text NOT NULL DEFAULT 'savings',
  ADD COLUMN IF NOT EXISTS voucher_no text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id),
  ADD COLUMN IF NOT EXISTS is_bank_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS head_id uuid;

CREATE TABLE IF NOT EXISTS public.cashbook_expense_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  stream text NOT NULL,
  name_bn text NOT NULL,
  name_en text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashbook_expense_heads TO authenticated;
GRANT ALL ON public.cashbook_expense_heads TO service_role;
ALTER TABLE public.cashbook_expense_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read expense heads" ON public.cashbook_expense_heads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR office_id IS NULL OR office_id = current_user_office());
CREATE POLICY "manage expense heads" ON public.cashbook_expense_heads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'committee'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'committee'));

CREATE TABLE IF NOT EXISTS public.cashbook_voucher_seq (
  office_id uuid NOT NULL,
  stream text NOT NULL,
  last_no integer NOT NULL DEFAULT 0,
  PRIMARY KEY (office_id, stream)
);
GRANT SELECT ON public.cashbook_voucher_seq TO authenticated;
GRANT ALL ON public.cashbook_voucher_seq TO service_role;
ALTER TABLE public.cashbook_voucher_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read voucher seq" ON public.cashbook_voucher_seq
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR office_id = current_user_office());

CREATE OR REPLACE FUNCTION public.next_cashbook_voucher_no(_office uuid, _stream text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  INSERT INTO public.cashbook_voucher_seq (office_id, stream, last_no)
  VALUES (COALESCE(_office,'00000000-0000-0000-0000-000000000000'::uuid), _stream, 1)
  ON CONFLICT (office_id, stream)
  DO UPDATE SET last_no = public.cashbook_voucher_seq.last_no + 1
  RETURNING last_no INTO _n;
  RETURN _n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_cashbook_voucher_no(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_cashbook_voucher_no(uuid, text) TO authenticated, service_role;

ALTER TABLE public.cashbook_submissions
  ADD COLUMN IF NOT EXISTS stream text NOT NULL DEFAULT 'all';
DROP INDEX IF EXISTS cashbook_submissions_ym_stream_uidx;
CREATE UNIQUE INDEX cashbook_submissions_ym_stream_uidx
  ON public.cashbook_submissions (year, month, stream);

INSERT INTO public.cashbook_expense_heads (office_id, stream, name_bn, name_en, sort_order) VALUES
  (NULL,'irrigation','ডিজেল/জ্বালানি','Diesel / Fuel',1),
  (NULL,'irrigation','বিদ্যুৎ বিল','Electricity Bill',2),
  (NULL,'irrigation','মেশিন মেরামত','Machine Repair',3),
  (NULL,'irrigation','ড্রাইভার/অপারেটর বেতন','Operator Salary',4),
  (NULL,'irrigation','ক্যানেল/ড্রেন মেরামত','Canal/Drain Maintenance',5),
  (NULL,'irrigation','ব্যাংক জমা','Bank Deposit',98),
  (NULL,'irrigation','বিবিধ','Miscellaneous',99),
  (NULL,'savings','অফিস খরচ','Office Expense',1),
  (NULL,'savings','বেতন/সম্মানী','Salary / Honorarium',2),
  (NULL,'savings','স্টেশনারি','Stationery',3),
  (NULL,'savings','যাতায়াত','Transport',4),
  (NULL,'savings','ব্যাংক জমা','Bank Deposit',98),
  (NULL,'savings','বিবিধ','Miscellaneous',99);
