-- ============================================================
-- Migration: narrow-scope duplicate-email check for public enquiry forms
-- ============================================================
-- Site-Track-Website (the SaaS platform's own "become a customer" marketing
-- site — a separate codebase from this app, with its own /api/enquiry route)
-- was using a full service_role key on a public-facing marketing site purely
-- to run one SELECT — checking whether an email had already submitted an
-- enquiry — because RLS only allows anonymous INSERT on `enquiries`, not
-- SELECT. A service_role key bypasses RLS on EVERY table, which is a much
-- bigger blast radius than "can this one form check for a duplicate email."
--
-- This function does exactly that one check, nothing else, and is grantable
-- to the anon role directly — so that marketing site's backend no longer
-- needs a service_role key at all.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enquiry_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS(SELECT 1 FROM public.enquiries WHERE email = p_email);
$$;

GRANT EXECUTE ON FUNCTION public.enquiry_email_exists(text) TO anon;
