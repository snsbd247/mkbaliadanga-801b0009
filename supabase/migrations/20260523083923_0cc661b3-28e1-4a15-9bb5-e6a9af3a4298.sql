
CREATE TABLE IF NOT EXISTS public.receipt_sequences (
  office_id uuid NOT NULL,
  kind text NOT NULL,
  year int NOT NULL,
  month int NOT NULL,
  last_no int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, kind, year, month)
);

ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipt_sequences_read_office" ON public.receipt_sequences;
CREATE POLICY "receipt_sequences_read_office" ON public.receipt_sequences
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_monthly_receipt_no(p_office_id uuid, p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM now())::int;
  m int := EXTRACT(MONTH FROM now())::int;
  k text := upper(p_kind);
  n int;
BEGIN
  IF k NOT IN ('SAV','LOAN','IRR','PAY','COMBO') THEN
    RAISE EXCEPTION 'invalid receipt kind: %', p_kind;
  END IF;

  INSERT INTO public.receipt_sequences(office_id, kind, year, month, last_no)
  VALUES (p_office_id, k, y, m, 1)
  ON CONFLICT (office_id, kind, year, month)
  DO UPDATE SET last_no = receipt_sequences.last_no + 1, updated_at = now()
  RETURNING last_no INTO n;

  RETURN format('%s-%s-%s-%s', k, y::text, lpad(m::text,2,'0'), lpad(n::text,4,'0'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_monthly_receipt_no(uuid, text) TO authenticated;
