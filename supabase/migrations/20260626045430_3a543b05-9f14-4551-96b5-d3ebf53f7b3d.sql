DROP INDEX IF EXISTS public.uq_lands_farmer_dag;
CREATE UNIQUE INDEX uq_lands_farmer_dag ON public.lands USING btree (farmer_id, dag_no)
  WHERE ((dag_no IS NOT NULL) AND (dag_no <> ''::text) AND (deleted_at IS NULL));