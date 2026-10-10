-- ============================================================
-- Migration: enquiries can only be written by the server
-- ============================================================
-- !! RUN ONLY AFTER both marketing sites post to the admin portal's
-- /api/public/enquiry (Site-Track-Website: contact page ENQUIRY_ENDPOINT;
-- UMA-Building-Compliance: contact page ENQUIRY_ENDPOINT) AND Turnstile is
-- configured there — before that, this would stop the SiteTrack website's
-- form from saving anything.
--
-- enquiries_public_insert was `FOR INSERT WITH CHECK (true)` for every role,
-- so anyone holding the public anon key could insert enquiries straight
-- into the table via REST — for ANY company_id, with any status, any
-- length, any volume — skipping the CAPTCHA, validation, duplicate check
-- and throttle that the server route applies. Every enquiry form now goes
-- through that one route, which writes with the service role, so no
-- client-side insert path is needed at all.
--
-- enquiry_email_exists() existed only so the marketing site's own route
-- could run its duplicate check with the anon key; the admin route does
-- that check itself with the service role, so the anon grant goes too.
-- ============================================================

DROP POLICY IF EXISTS "enquiries_public_insert" ON public.enquiries;
REVOKE INSERT ON public.enquiries FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enquiry_email_exists(text) FROM PUBLIC, anon, authenticated;

-- Remaining enquiries policies (expected: only the tenant admins' SELECT one):
SELECT policyname, roles::text, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'enquiries';
