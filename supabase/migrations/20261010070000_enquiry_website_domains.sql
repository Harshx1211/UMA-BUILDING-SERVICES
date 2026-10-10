-- ============================================================
-- Migration: which websites may send enquiries for which company
-- ============================================================
-- Every enquiry form posts to the admin portal's /api/public/enquiry with a
-- company_id. company_ids aren't secret (each marketing site ships its own
-- in its page code), so on its own nothing stopped someone passing the
-- CAPTCHA on one site and aiming the enquiry at a DIFFERENT company's id.
--
-- Cloudflare's siteverify response reports the hostname the Turnstile
-- challenge was actually solved on, and the visitor can't forge it. The
-- endpoint now only accepts an enquiry for a company if that hostname is in
-- the company's own website_domains — and a platform lead (no company) only
-- from platform_settings.website_domains (SiteTrack's own site). Empty list
-- = that target accepts no enquiries at all (fail closed).
--
-- Only superadmins edit these (superadmin console, service role). The
-- tenant admin portal's company-settings update deliberately doesn't
-- include this column, so a tenant can't register someone else's domain to
-- receive leads solved there.
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website_domains text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_website_domains_limit;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_website_domains_limit CHECK (cardinality(website_domains) <= 20);

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS website_domains text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_website_domains_limit;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_website_domains_limit CHECK (cardinality(website_domains) <= 20);

-- UMA's live marketing site (verified 2026-10-10: its contact form posts
-- company 008af296-… "Uma Building Services"). Only fills an empty list.
UPDATE public.companies
SET website_domains = ARRAY['uma-building-compliances.vercel.app']
WHERE id = '008af296-ec0c-4102-b241-93aec780315a'
  AND cardinality(website_domains) = 0;

SELECT 'company' AS kind, name, website_domains FROM public.companies
UNION ALL
SELECT 'platform', platform_name, website_domains FROM public.platform_settings
ORDER BY 1, 2;
