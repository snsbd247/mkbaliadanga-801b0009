
CREATE TABLE IF NOT EXISTS public.land_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  land_id uuid REFERENCES public.lands(id) ON DELETE SET NULL,
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  season text,
  mouza text,
  dag_no text,
  land_size numeric(12,3) NOT NULL,
  owner_type text,
  field_type text,
  cultivator_farmer_id uuid REFERENCES public.farmers(id) ON DELETE SET NULL,
  remarks text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_land_history_farmer ON public.land_history(farmer_id);
CREATE INDEX IF NOT EXISTS idx_land_history_year ON public.land_history(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_land_history_office ON public.land_history(office_id);

ALTER TABLE public.land_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "land_history_select" ON public.land_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "land_history_insert" ON public.land_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "land_history_update" ON public.land_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "land_history_delete" ON public.land_history FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_purpose text;
CREATE INDEX IF NOT EXISTS idx_loans_temporary ON public.loans(is_temporary) WHERE is_temporary = true;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  branch text,
  account_no text NOT NULL,
  account_title text,
  account_type text DEFAULT 'savings',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts ON public.bank_accounts(office_id, bank_name, account_no);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_read" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_accounts_write" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  txn_type text NOT NULL CHECK (txn_type IN ('deposit','withdraw','transfer_in','transfer_out','charge','interest')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reference_no text,
  counterparty_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  transfer_group uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_txn_account ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON public.bank_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_group ON public.bank_transactions(transfer_group);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_txn_read" ON public.bank_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_txn_write" ON public.bank_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  voucher_no text NOT NULL,
  voucher_type text NOT NULL CHECK (voucher_type IN ('payment','receipt','journal','contra')),
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payee text,
  narration text,
  attachment_path text,
  attachment_mime text,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_no ON public.vouchers(office_id, voucher_no);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON public.vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_type ON public.vouchers(voucher_type);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouchers_read" ON public.vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "vouchers_write" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'));

CREATE TABLE IF NOT EXISTS public.voucher_sequences (
  office_id uuid NOT NULL,
  voucher_type text NOT NULL,
  fiscal_year integer NOT NULL,
  last_no integer NOT NULL DEFAULT 0,
  PRIMARY KEY (office_id, voucher_type, fiscal_year)
);
ALTER TABLE public.voucher_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voucher_seq_all" ON public.voucher_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_voucher_no(_office uuid, _type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fy integer;
  next_no integer;
  prefix text;
BEGIN
  fy := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  IF EXTRACT(MONTH FROM CURRENT_DATE)::int < 7 THEN fy := fy - 1; END IF;

  INSERT INTO public.voucher_sequences (office_id, voucher_type, fiscal_year, last_no)
  VALUES (_office, _type, fy, 1)
  ON CONFLICT (office_id, voucher_type, fiscal_year)
  DO UPDATE SET last_no = public.voucher_sequences.last_no + 1
  RETURNING last_no INTO next_no;

  prefix := CASE _type WHEN 'payment' THEN 'PV' WHEN 'receipt' THEN 'RV' WHEN 'journal' THEN 'JV' WHEN 'contra' THEN 'CV' ELSE 'V' END;
  RETURN prefix || '-' || fy::text || '-' || LPAD(next_no::text, 5, '0');
END;
$$;

INSERT INTO storage.buckets (id, name, public) VALUES ('vouchers', 'vouchers', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vouchers_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vouchers');
CREATE POLICY "vouchers_storage_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vouchers');
CREATE POLICY "vouchers_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vouchers');
CREATE POLICY "vouchers_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vouchers' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
