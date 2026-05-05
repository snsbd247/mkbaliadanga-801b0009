
-- Audit trigger for share_collection decisions
CREATE OR REPLACE FUNCTION public.audit_share_collection_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type <> 'share_collection' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, office_id, old_values, new_values, meta)
    VALUES (
      auth.uid(),
      'share_collection.' || NEW.status,
      'savings_transactions',
      NEW.id,
      NEW.office_id,
      jsonb_build_object('status', OLD.status, 'amount', OLD.amount, 'txn_date', OLD.txn_date),
      jsonb_build_object('status', NEW.status, 'amount', NEW.amount, 'reject_reason', NEW.reject_reason),
      jsonb_build_object('farmer_id', NEW.farmer_id, 'decided_at', now())
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_share_collection_decision ON public.savings_transactions;
CREATE TRIGGER trg_audit_share_collection_decision
AFTER UPDATE ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_share_collection_decision();

-- Tighten permissions on internal trigger functions (callable only by trigger executor)
REVOKE ALL ON FUNCTION public.post_share_collection_ledger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_share_collection_decision() FROM PUBLIC, anon, authenticated;
