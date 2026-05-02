CREATE TABLE public.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX qr_tokens_farmer_idx ON public.qr_tokens(farmer_id);
CREATE INDEX qr_tokens_active_idx ON public.qr_tokens(farmer_id) WHERE revoked = false;

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- Deny-all: only service-role edge functions touch this table.
CREATE POLICY "qr_tokens deny all" ON public.qr_tokens
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
