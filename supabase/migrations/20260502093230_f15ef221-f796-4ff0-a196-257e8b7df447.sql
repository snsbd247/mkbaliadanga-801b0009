-- OTP storage (hashed)
CREATE TABLE public.farmer_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  otp_hash text NOT NULL,
  mobile_masked text,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_farmer_otps_farmer ON public.farmer_otps(farmer_id, created_at DESC);
CREATE INDEX idx_farmer_otps_expires ON public.farmer_otps(expires_at);

ALTER TABLE public.farmer_otps ENABLE ROW LEVEL SECURITY;
-- No policies: only service-role (edge functions) can access.

-- Farmer portal session tokens (hashed)
CREATE TABLE public.farmer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  ip text,
  user_agent text
);

CREATE INDEX idx_farmer_sessions_farmer ON public.farmer_portal_sessions(farmer_id);
CREATE INDEX idx_farmer_sessions_expires ON public.farmer_portal_sessions(expires_at);

ALTER TABLE public.farmer_portal_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: only service-role (edge functions) can access.