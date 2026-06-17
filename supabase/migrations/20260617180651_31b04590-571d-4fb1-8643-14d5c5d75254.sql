CREATE POLICY "users log their own demo ops"
ON public.demo_operations_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);