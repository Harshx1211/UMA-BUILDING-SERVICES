-- ==========================================
-- UMA BUILDING SERVICES — DUMMY DATA SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR
-- ==========================================

-- 1. Get test user id
-- You must first create a user in Supabase Authentication and copy their UUID here.
-- Replace the UUID below with your actual auth user UUID.
DO $$
DECLARE
  test_tech_id UUID := '00000000-0000-0000-0000-000000000000'; -- ⚠️ REPLACE THIS
  prop1_id UUID := gen_random_uuid();
  prop2_id UUID := gen_random_uuid();
  job1_id UUID := gen_random_uuid();
  job2_id UUID := gen_random_uuid();
BEGIN

  -- Create internal User Profile (if not created via trigger)
  INSERT INTO public.users (id, email, full_name, role, phone)
  VALUES 
    (test_tech_id, 'tech@uma-building-services.test', 'Test Technician', 'technician', '0400000000')
  ON CONFLICT (id) DO UPDATE SET full_name = 'Test Technician';

  -- Create Properties
  INSERT INTO public.properties (id, name, address, suburb, state, postcode, site_contact_name, site_contact_phone, access_notes, hazard_notes)
  VALUES
    (prop1_id, 'Acme Corp HQ', '100 Business Blvd', 'Sydney', 'NSW', '2000', 'John Smith', '0412345678', 'Check in at security desk. Need ID.', NULL),
    (prop2_id, 'Westside Mall', '42 Shopping Centre Rd', 'Parramatta', 'NSW', '2150', 'Jane Doe', NULL, NULL, 'Active forklift zone in loading dock.');

  -- Create Assets for Prop 1
  INSERT INTO public.assets (id, property_id, asset_type, location_on_site, description, install_date)
  VALUES
    (gen_random_uuid(), prop1_id, 'Fire Extinguisher', 'Lobby near elevators', 'Chubb', '2023-01-10'),
    (gen_random_uuid(), prop1_id, 'Smoke Detector', 'Server Room ceiling', 'Brooks', '2022-05-15'),
    (gen_random_uuid(), prop1_id, 'Fire Hose Reel', 'Basement Parking', 'Wormald', '2021-11-20');

  -- Create Assets for Prop 2
  INSERT INTO public.assets (id, property_id, asset_type, location_on_site, description)
  VALUES
    (gen_random_uuid(), prop2_id, 'Fire Extinguisher', 'Food Court South', 'Eversafe'),
    (gen_random_uuid(), prop2_id, 'Fire Blanket', 'Kitchen area 1', 'Chubb');

  -- Create Jobs assigned to test_tech_id
  -- Job 1: Scheduled for Today
  INSERT INTO public.jobs (
    id, property_id, assigned_to, job_type, status, scheduled_date, scheduled_time, priority, notes
  ) VALUES (
    job1_id, prop1_id, test_tech_id, 'routine_service', 'scheduled', current_date, '09:00', 'high',
    'Please see reception for keys.'
  );

  -- Job 2: Scheduled for Tomorrow
  INSERT INTO public.jobs (
    id, property_id, assigned_to, job_type, status, scheduled_date, scheduled_time, priority, notes
  ) VALUES (
    job2_id, prop2_id, test_tech_id, 'defect_repair', 'scheduled', current_date + interval '1 day', '13:30', 'normal',
    'Repairing smoke detectors reported faulty.'
  );

  -- Log success
  RAISE NOTICE 'Dummy data successfully populated!';

END $$;
