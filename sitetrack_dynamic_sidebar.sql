-- 1. Add Dynamic Sidebar Link fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_sidebar_label text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_sidebar_url text;

-- 2. Ensure enquiries table allows Tenant Admins to read their own leads
-- First check if RLS is enabled on enquiries
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Create policy for Tenant Admins to see their own enquiries (company_id matches)
-- Using the standard SiteTrack auth pattern (auth.uid() is matched against user's company_id)
DROP POLICY IF EXISTS "Tenant Admins can view their own company enquiries" ON enquiries;

CREATE POLICY "Tenant Admins can view their own company enquiries"
ON enquiries
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);
