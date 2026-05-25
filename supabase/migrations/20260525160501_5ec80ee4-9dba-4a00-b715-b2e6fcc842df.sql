ALTER TABLE public.irrigation_due_promises
  ADD CONSTRAINT irrigation_due_promises_farmer_id_fkey
  FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE CASCADE;