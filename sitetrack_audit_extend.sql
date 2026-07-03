-- Attach triggers to core operational tables

-- 1. properties
DROP TRIGGER IF EXISTS audit_properties_trigger ON public.properties;
CREATE TRIGGER audit_properties_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 2. assets
DROP TRIGGER IF EXISTS audit_assets_trigger ON public.assets;
CREATE TRIGGER audit_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 3. jobs
DROP TRIGGER IF EXISTS audit_jobs_trigger ON public.jobs;
CREATE TRIGGER audit_jobs_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. job_assets (Inspection Pass/Fail Results)
DROP TRIGGER IF EXISTS audit_job_assets_trigger ON public.job_assets;
CREATE TRIGGER audit_job_assets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.job_assets
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 5. defects
DROP TRIGGER IF EXISTS audit_defects_trigger ON public.defects;
CREATE TRIGGER audit_defects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 6. quotes
DROP TRIGGER IF EXISTS audit_quotes_trigger ON public.quotes;
CREATE TRIGGER audit_quotes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Notify PostgREST to reload the schema
NOTIFY pgrst, 'reload schema';
