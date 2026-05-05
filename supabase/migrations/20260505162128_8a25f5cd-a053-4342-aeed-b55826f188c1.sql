
-- 1. Add Share Capital account if not exists
INSERT INTO public.accounts (code, name, type, is_system, is_active)
VALUES ('3020', 'Share Capital', 'equity', true, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Unique index: one share_collection per farmer per day (active only)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_share_collection_per_day
ON public.savings_transactions (farmer_id, txn_date)
WHERE type = 'share_collection' AND deleted_at IS NULL;

-- 3. Trigger: auto-post ledger entries for approved share collections
CREATE OR REPLACE FUNCTION public.post_share_collection_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_cash uuid;
  a_share uuid;
BEGIN
  IF NEW.type <> 'share_collection' THEN RETURN NEW; END IF;

  SELECT id INTO a_cash FROM public.accounts WHERE code='1010' LIMIT 1;
  SELECT id INTO a_share FROM public.accounts WHERE code='3020' LIMIT 1;

  -- On INSERT/UPDATE to approved (and was not approved before)
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.deleted_at IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND NEW.deleted_at IS NULL
         AND (OLD.status <> 'approved' OR OLD.deleted_at IS NOT NULL)) THEN
    INSERT INTO public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
    VALUES (NEW.txn_date, a_cash, NEW.amount, 0, 'share_collection', NEW.id, 'Share collection', NEW.office_id, NEW.created_by),
           (NEW.txn_date, a_share, 0, NEW.amount, 'share_collection', NEW.id, 'Share collection', NEW.office_id, NEW.created_by);
  END IF;

  -- On UPDATE moving away from approved or being soft-deleted: remove ledger
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND OLD.deleted_at IS NULL
     AND (NEW.status <> 'approved' OR NEW.deleted_at IS NOT NULL) THEN
    DELETE FROM public.ledger_entries
    WHERE reference_type = 'share_collection' AND reference_id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_post_share_collection_ledger ON public.savings_transactions;
CREATE TRIGGER trg_post_share_collection_ledger
AFTER INSERT OR UPDATE ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.post_share_collection_ledger();
