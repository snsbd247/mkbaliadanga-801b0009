
-- ===== Period close lock: block ledger writes inside any closed period =====

CREATE OR REPLACE FUNCTION public.is_date_in_closed_period(_date date, _office uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounting_periods p
    WHERE p.status = 'closed'
      AND _date BETWEEN p.period_start AND p.period_end
      AND (p.office_id IS NULL OR p.office_id = _office)
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_closed_period_ledger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_date_in_closed_period(OLD.entry_date, OLD.office_id)
       AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Cannot delete ledger entry inside a closed period (% / office %)',
        OLD.entry_date, COALESCE(OLD.office_id::text,'global');
    END IF;
    RETURN OLD;
  END IF;

  IF public.is_date_in_closed_period(NEW.entry_date, NEW.office_id)
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Cannot post ledger entry inside a closed period (% / office %). Reopen the period or use a date after %.',
      NEW.entry_date, COALESCE(NEW.office_id::text,'global'), NEW.entry_date;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_closed_period ON public.ledger_entries;
CREATE TRIGGER trg_guard_closed_period
BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period_ledger();

-- Also block creating new journal entries dated inside a closed period (early failure)
CREATE OR REPLACE FUNCTION public.guard_closed_period_journal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_date_in_closed_period(NEW.entry_date, NEW.office_id)
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Journal date % falls inside a closed period. Pick a later date.', NEW.entry_date;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_closed_period_journal ON public.journal_entries;
CREATE TRIGGER trg_guard_closed_period_journal
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period_journal();

-- Helper RPC: lightweight integrity counts for dashboards
CREATE OR REPLACE FUNCTION public.ledger_integrity_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unbal int;
  v_orphan int;
  v_missing int;
  v_total int;
BEGIN
  SELECT count(*) INTO v_unbal FROM public.ledger_unbalanced_refs();
  SELECT count(*) INTO v_orphan FROM public.ledger_orphan_refs();
  SELECT count(*) INTO v_missing FROM public.ledger_entries WHERE account_id IS NULL;
  SELECT count(*) INTO v_total FROM public.ledger_entries;
  RETURN jsonb_build_object(
    'unbalanced', v_unbal,
    'orphan', v_orphan,
    'missing_account', v_missing,
    'total_entries', v_total,
    'checked_at', now()
  );
END
$$;
