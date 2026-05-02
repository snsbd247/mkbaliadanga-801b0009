
-- Auto-stamp creator/collector for collection-related tables.
-- On INSERT: when the field is NULL, set it to auth.uid() (if any).
-- On UPDATE: prevent non-super_admin from changing the field after creation.

CREATE OR REPLACE FUNCTION public.set_created_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL AND uid IS NOT NULL THEN
      NEW.created_by := uid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
      IF NOT public.has_role(uid, 'super_admin'::app_role) THEN
        NEW.created_by := OLD.created_by;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_collected_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.collected_by IS NULL AND uid IS NOT NULL THEN
      NEW.collected_by := uid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.collected_by IS DISTINCT FROM NEW.collected_by THEN
      IF NOT public.has_role(uid, 'super_admin'::app_role) THEN
        NEW.collected_by := OLD.collected_by;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- created_by triggers
DROP TRIGGER IF EXISTS trg_savings_created_by ON public.savings_transactions;
CREATE TRIGGER trg_savings_created_by
BEFORE INSERT OR UPDATE ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_auth();

DROP TRIGGER IF EXISTS trg_loans_created_by ON public.loans;
CREATE TRIGGER trg_loans_created_by
BEFORE INSERT OR UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_auth();

DROP TRIGGER IF EXISTS trg_irrigation_created_by ON public.irrigation_charges;
CREATE TRIGGER trg_irrigation_created_by
BEFORE INSERT OR UPDATE ON public.irrigation_charges
FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_auth();

DROP TRIGGER IF EXISTS trg_ledger_created_by ON public.ledger_entries;
CREATE TRIGGER trg_ledger_created_by
BEFORE INSERT OR UPDATE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_auth();

DROP TRIGGER IF EXISTS trg_expenses_created_by ON public.expenses;
CREATE TRIGGER trg_expenses_created_by
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_auth();

-- collected_by triggers (payments / loan_payments / receipts)
DROP TRIGGER IF EXISTS trg_payments_collected_by ON public.payments;
CREATE TRIGGER trg_payments_collected_by
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_collected_by_from_auth();

DROP TRIGGER IF EXISTS trg_loan_payments_collected_by ON public.loan_payments;
CREATE TRIGGER trg_loan_payments_collected_by
BEFORE INSERT OR UPDATE ON public.loan_payments
FOR EACH ROW EXECUTE FUNCTION public.set_collected_by_from_auth();

DROP TRIGGER IF EXISTS trg_receipts_collected_by ON public.receipts;
CREATE TRIGGER trg_receipts_collected_by
BEFORE INSERT OR UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.set_collected_by_from_auth();

-- Allow authenticated users to look up basic profile info (id, full_name, email, office_id)
-- through a SECURITY DEFINER RPC for the staff filter dropdown without exposing
-- the entire profiles table to non-super_admins.
CREATE OR REPLACE FUNCTION public.list_collector_users()
RETURNS TABLE (id uuid, full_name text, email text, office_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.office_id
  FROM public.profiles p
  WHERE
    -- super_admin sees everyone; others limited to own office
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR p.office_id = public.current_user_office()
  ORDER BY COALESCE(p.full_name, p.email);
$$;

GRANT EXECUTE ON FUNCTION public.list_collector_users() TO authenticated;
