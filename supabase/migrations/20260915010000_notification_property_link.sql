-- ============================================================
-- Migration: let a notification link to a property, not just a job
-- ============================================================
-- The admin dashboard's Notifications page never wired job_id through to
-- an onClick at all (n.job_id was saved but never read in the JSX) — fixed
-- app-side alongside this migration. But overdue_service notifications
-- have no job to link to in the first place (an overdue property isn't
-- tied to any job) — notify_company_admins only ever accepted a job id, so
-- check_overdue_properties() passed NULL and that notification type could
-- never deep-link anywhere even once the onClick handler existed. This
-- adds a property_id column and threads it through both call sites.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

CREATE OR REPLACE FUNCTION public.notify_company_admins(
  p_company_id uuid,
  p_setting_key text,
  p_job_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_property_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wants_notif boolean;
  v_admin record;
BEGIN
  SELECT COALESCE((notification_settings ->> p_setting_key)::boolean, false)
    INTO v_wants_notif
    FROM public.companies
    WHERE id = p_company_id;
  IF v_wants_notif IS NOT TRUE THEN
    RETURN;
  END IF;

  FOR v_admin IN
    SELECT id FROM public.users
    WHERE company_id = p_company_id AND role = 'admin' AND is_active = true
  LOOP
    INSERT INTO public.notifications (user_id, job_id, property_id, type, title, message)
    VALUES (v_admin.id, p_job_id, p_property_id, p_type, p_title, p_message);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_overdue_properties() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property record;
BEGIN
  FOR v_property IN
    SELECT id, company_id, name, next_inspection_date
    FROM public.properties
    WHERE next_inspection_date IS NOT NULL
      AND next_inspection_date < CURRENT_DATE
      AND (overdue_notified_at IS NULL OR overdue_notified_at < next_inspection_date)
  LOOP
    PERFORM public.notify_company_admins(
      v_property.company_id, 'overdue_service', NULL, 'overdue_service',
      'Property overdue for service',
      v_property.name || ' was due for service on ' || to_char(v_property.next_inspection_date, 'DD Mon YYYY') || ' and has not been scheduled.',
      v_property.id
    );
    UPDATE public.properties SET overdue_notified_at = CURRENT_DATE WHERE id = v_property.id;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;
