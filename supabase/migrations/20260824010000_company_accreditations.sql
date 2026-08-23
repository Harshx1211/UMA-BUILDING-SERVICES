-- AS1851 Plan Phase 5: the Signoff page's "Company Accreditations" line
-- (matching the reference report's footer) needs a place to source the
-- company's accreditation text from. Nullable/optional — a company with
-- nothing set here just renders a blank line, same as abn/logo_url today.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accreditations text;
