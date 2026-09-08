-- ============================================================
-- Migration: create a notification when a technician is assigned a job
-- ============================================================
-- Nothing in this codebase (mobile or admin) has ever actually created a
-- 'new_job' notification row — the mobile app already has a full UI for it
-- (app/(app)/notifications/index.tsx's TYPE_CONFIG maps 'new_job' to an
-- icon/color), users.notification_settings already defaults new_job to
-- true, and the notifications table was added to the realtime publication
-- weeks ago (20260909010000_my_data_live_tables.sql) — every piece of
-- plumbing to DELIVER this notification instantly already exists. Nothing
-- has ever CREATED one. That's the actual gap being reported.
--
-- Trigger-based, on job_technicians INSERT only — not jobs.assigned_to.
-- Checked both real job-creation paths in this codebase
-- (admin/src/app/(dashboard)/jobs/CreateJobModal.tsx and the mobile app's
-- own app/(app)/properties/site-inspect/[id].tsx) and both always write a
-- job_technicians row for the primary assignee too, in the same action —
-- there is no code path anywhere that sets jobs.assigned_to without also
-- inserting a matching job_technicians row, and no "reassign crew" action
-- exists that touches one without the other either. Triggering on both
-- tables would double-notify the primary assignee (once per trigger) for
-- every job; job_technicians alone covers every crew member, including the
-- primary assignee, exactly once, with no gap.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- The mobile UI already reads notification.job_id (to make a "new job"
-- notification tappable, opening straight to that job) but the column
-- never existed — that reference has always silently resolved to
-- undefined. ON DELETE SET NULL rather than CASCADE/RESTRICT: an old
-- notification should survive even if the job it referenced is ever
-- removed, not vanish or block the delete.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON public.notifications(job_id);

CREATE OR REPLACE FUNCTION public.notify_job_crew_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property_name  text;
  v_scheduled_date date;
  v_wants_notif    boolean;
BEGIN
  -- Respects the per-user toggle already sitting unused in
  -- users.notification_settings ('{"new_job": true, ...}' by default).
  SELECT COALESCE((notification_settings ->> 'new_job')::boolean, true)
    INTO v_wants_notif
    FROM public.users
    WHERE id = NEW.user_id;
  IF v_wants_notif IS FALSE THEN
    RETURN NEW;
  END IF;

  SELECT p.name, j.scheduled_date
    INTO v_property_name, v_scheduled_date
    FROM public.jobs j
    JOIN public.properties p ON p.id = j.property_id
    WHERE j.id = NEW.job_id;

  INSERT INTO public.notifications (user_id, job_id, type, title, message)
  VALUES (
    NEW.user_id,
    NEW.job_id,
    'new_job',
    'New job assigned',
    'You''ve been assigned a job at ' || COALESCE(v_property_name, 'a property')
      || CASE WHEN v_scheduled_date IS NOT NULL THEN ' — scheduled ' || v_scheduled_date::text ELSE '' END
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A notification failing to write must never block the actual crew
  -- assignment it's attached to.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_crew_added ON public.job_technicians;
CREATE TRIGGER trg_notify_job_crew_added
  AFTER INSERT ON public.job_technicians
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_crew_added();
