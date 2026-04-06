-- Applicant/invite flows: track password completion separately from Supabase one-time magic links.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_set_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_set_password IS 'True after user has completed initial password (invite activation).';

-- Existing active accounts are treated as having set a password.
UPDATE public.profiles
SET has_set_password = true
WHERE account_status = 'active'
  AND has_set_password = false;
