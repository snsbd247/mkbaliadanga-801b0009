CREATE OR REPLACE FUNCTION public.audit_farmer_voter_number_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.voter_number, '') IS DISTINCT FROM COALESCE(NEW.voter_number, '') THEN
    INSERT INTO public.audit_logs (user_id, office_id, action, entity, entity_id, old_values, new_values, meta)
    VALUES (
      auth.uid(),
      NEW.office_id,
      'voter_number_change',
      'farmers',
      NEW.id,
      jsonb_build_object('voter_number', OLD.voter_number, 'is_voter', OLD.is_voter),
      jsonb_build_object('voter_number', NEW.voter_number, 'is_voter', NEW.is_voter),
      jsonb_build_object('source', 'trigger', 'farmer_code', NEW.farmer_code)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_farmer_voter_number ON public.farmers;
CREATE TRIGGER trg_audit_farmer_voter_number
AFTER UPDATE OF voter_number, is_voter ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.audit_farmer_voter_number_changes();