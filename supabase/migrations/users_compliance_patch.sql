-- Add compliance and licensing fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fpas_number TEXT,
  ADD COLUMN IF NOT EXISTS fpas_class TEXT,
  ADD COLUMN IF NOT EXISTS fpas_expiry DATE,
  ADD COLUMN IF NOT EXISTS state_license TEXT,
  ADD COLUMN IF NOT EXISTS state_license_expiry DATE;

-- Update the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
