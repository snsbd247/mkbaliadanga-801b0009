
ALTER TABLE public.developer_update_logs
  ADD COLUMN IF NOT EXISTS status text;
