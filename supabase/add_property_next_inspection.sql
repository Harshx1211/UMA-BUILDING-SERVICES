-- 1. Add the column to the properties table
ALTER TABLE public.properties 
ADD COLUMN next_inspection_date DATE;

-- 2. Add comment for documentation
COMMENT ON COLUMN public.properties.next_inspection_date IS 
  'Date when the site is next due for a full inspection. Replaces asset-level next_service_date.';
