ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'bn'
  CHECK (language IN ('en','bn'));

COMMENT ON COLUMN public.profiles.language IS
  'UI language preference for this user. Read by LanguageProvider on login.';