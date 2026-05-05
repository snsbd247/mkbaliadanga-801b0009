
-- Enable RLS on shares table
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read shares" ON public.shares;
CREATE POLICY "office read shares" ON public.shares
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR office_id = current_user_office() OR office_id IS NULL);

DROP POLICY IF EXISTS "super manage shares" ON public.shares;
CREATE POLICY "super manage shares" ON public.shares
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Trigger function: recompute share balance for affected farmer
CREATE OR REPLACE FUNCTION public.recompute_share_balance(_farmer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_office uuid;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.savings_transactions
  WHERE farmer_id = _farmer_id
    AND type IN ('share_collection','share_deposit')
    AND status = 'approved'
    AND deleted_at IS NULL;

  SELECT office_id INTO v_office FROM public.farmers WHERE id = _farmer_id;

  INSERT INTO public.shares (farmer_id, balance, office_id, updated_at)
  VALUES (_farmer_id, v_balance, v_office, now())
  ON CONFLICT (farmer_id) DO UPDATE
    SET balance = EXCLUDED.balance, office_id = EXCLUDED.office_id, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.recompute_share_balance(uuid) FROM PUBLIC, anon, authenticated;

-- Ensure unique constraint on farmer_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS shares_farmer_id_key ON public.shares (farmer_id);

-- Trigger on savings_transactions to keep shares in sync
CREATE OR REPLACE FUNCTION public.trg_sync_share_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.type IN ('share_collection','share_deposit') THEN
      PERFORM public.recompute_share_balance(OLD.farmer_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.type IN ('share_collection','share_deposit')
     OR (TG_OP = 'UPDATE' AND OLD.type IN ('share_collection','share_deposit')) THEN
    PERFORM public.recompute_share_balance(NEW.farmer_id);
    IF TG_OP = 'UPDATE' AND OLD.farmer_id <> NEW.farmer_id THEN
      PERFORM public.recompute_share_balance(OLD.farmer_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trg_sync_share_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_share_balance ON public.savings_transactions;
CREATE TRIGGER trg_sync_share_balance
AFTER INSERT OR UPDATE OR DELETE ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_share_balance();

-- Backfill existing balances
INSERT INTO public.shares (farmer_id, balance, office_id, updated_at)
SELECT st.farmer_id,
       COALESCE(SUM(st.amount), 0),
       (SELECT office_id FROM public.farmers WHERE id = st.farmer_id),
       now()
FROM public.savings_transactions st
WHERE st.type IN ('share_collection','share_deposit')
  AND st.status = 'approved'
  AND st.deleted_at IS NULL
GROUP BY st.farmer_id
ON CONFLICT (farmer_id) DO UPDATE
  SET balance = EXCLUDED.balance, office_id = EXCLUDED.office_id, updated_at = now();
