
CREATE TABLE IF NOT EXISTS public.developer_update_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,                 -- 'check' | 'mark_applied'
  repo_url text NOT NULL,
  commit_sha text,
  commit_message text,
  release_tag text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_update_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developer read update logs"
ON public.developer_update_logs FOR SELECT TO authenticated
USING (public.is_developer(auth.uid()));

CREATE POLICY "developer insert update logs"
ON public.developer_update_logs FOR INSERT TO authenticated
WITH CHECK (public.is_developer(auth.uid()) AND user_id = auth.uid());
