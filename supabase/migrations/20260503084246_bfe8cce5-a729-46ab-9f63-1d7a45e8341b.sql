-- Prevent edits to cancelled / rejected enrollments unless super admin
CREATE OR REPLACE FUNCTION public.fsp_block_terminal_state_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('cancelled', 'rejected')
     AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Cannot modify a % enrollment', OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fsp_block_terminal ON public.farmer_savings_plans;
CREATE TRIGGER trg_fsp_block_terminal
  BEFORE UPDATE ON public.farmer_savings_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.fsp_block_terminal_state_edits();