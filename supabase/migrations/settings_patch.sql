-- Adds JSONB settings columns to the companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"new_job": true, "critical_defect": true, "quote_submitted": true, "job_completed": false, "overdue_service": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_standards JSONB DEFAULT '{"as1851": true, "as2293": true, "as1670": false, "bca": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS appearance_settings JSONB DEFAULT '{"theme": "Light", "primary_color": "#1B2D4F"}'::jsonb;
