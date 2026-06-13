CREATE TABLE public.office_incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid,
  receipt_no text NOT NULL,
  income_type text NOT NULL DEFAULT 'other',
  payer_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  received_on date NOT NULL DEFAULT current_date,
  stream text NOT NULL DEFAULT 'sech',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_incomes TO authenticated;
GRANT ALL ON public.office_incomes TO service_role;

ALTER TABLE public.office_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view office incomes"
  ON public.office_incomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert office incomes"
  ON public.office_incomes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update office incomes"
  ON public.office_incomes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete office incomes"
  ON public.office_incomes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_office_incomes_updated_at
  BEFORE UPDATE ON public.office_incomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();