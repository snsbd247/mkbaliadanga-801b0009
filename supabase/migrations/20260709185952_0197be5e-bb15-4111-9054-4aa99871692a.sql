CREATE TABLE IF NOT EXISTS public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  fiscal_year text NOT NULL,
  irrigation_cash numeric NOT NULL DEFAULT 0,
  savings_cash numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, fiscal_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_balances TO authenticated;
GRANT ALL ON public.opening_balances TO service_role;

ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read opening_balances" ON public.opening_balances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth write opening_balances" ON public.opening_balances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_opening_balances_updated_at BEFORE UPDATE ON public.opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();