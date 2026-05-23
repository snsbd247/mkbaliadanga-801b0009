CREATE TABLE IF NOT EXISTS public.cashbook_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  opening_cash numeric NOT NULL DEFAULT 0,
  closing_cash numeric NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  note text,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

ALTER TABLE public.cashbook_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cashbook submissions"
  ON public.cashbook_submissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Committee can insert cashbook submissions"
  ON public.cashbook_submissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'committee') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admin can unlock cashbook submissions"
  ON public.cashbook_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete cashbook submissions"
  ON public.cashbook_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));