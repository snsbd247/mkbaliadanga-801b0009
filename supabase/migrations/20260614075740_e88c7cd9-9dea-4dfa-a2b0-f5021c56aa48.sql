CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.hand_cash_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  opening_cash numeric NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  closing_cash numeric NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  submitted_by uuid NULL,
  submitted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hand_cash_submissions TO authenticated;
GRANT ALL ON public.hand_cash_submissions TO service_role;

ALTER TABLE public.hand_cash_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view hand cash submissions"
  ON public.hand_cash_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert hand cash submissions"
  ON public.hand_cash_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update hand cash submissions"
  ON public.hand_cash_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete hand cash submissions"
  ON public.hand_cash_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_hand_cash_submissions_updated_at
  BEFORE UPDATE ON public.hand_cash_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();