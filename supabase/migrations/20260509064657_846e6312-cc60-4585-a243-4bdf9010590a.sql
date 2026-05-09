ALTER TABLE public.farmer_savings_plans
  ADD CONSTRAINT farmer_savings_plans_farmer_id_fkey
  FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_farmer_savings_plans_farmer ON public.farmer_savings_plans(farmer_id);

GRANT EXECUTE ON FUNCTION public.ledger_integrity_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_orphan_refs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_unbalanced_refs() TO authenticated;