-- ============================================================
-- Migration: overdue_service notification toggle — the one that needs
-- scheduling, not just a trigger
-- ============================================================
-- The other 3 toggles wired up in 20260914000000_admin_notification_toggles.sql
-- are all real one-time EVENTS (a defect gets logged, a job completes, a
-- quote goes out) — an AFTER INSERT/UPDATE trigger fires exactly once, at
-- the moment it happens. "A property is overdue for service" isn't like
-- that: nothing is ever inserted or updated when next_inspection_date
-- quietly passes — it becomes true purely from the calendar turning over.
-- There's no row-level event to hang a trigger on, so this needs something
-- that actually checks on a schedule instead.
--
-- Read your own Supabase project's own Overdue definition from the admin
-- Reports page before this: "overdue" = next_inspection_date < today,
-- checked directly (NOT the separate compliance_status field, which can
-- drift out of sync with it) — this function uses the exact same rule.
--
-- overdue_notified_at tracks the last time THIS property was notified
-- about, so re-running the daily check doesn't re-notify the same overdue
-- property every single day forever — only once per time it newly becomes
-- overdue (i.e., again if a later next_inspection_date is set and THAT one
-- also passes).
--
-- IMPORTANT — this one needs a step the other 3 didn't: pg_cron. Run the
-- CREATE EXTENSION / cron.schedule block at the bottom too (same SQL
-- Editor), but note pg_cron isn't available on every Supabase plan/project
-- configuration — if the CREATE EXTENSION line fails, the function itself
-- is still created and safe to call manually or wire up to an external
-- scheduler (a Supabase Edge Function on a cron trigger, for instance) —
-- just tell me and I'll help wire up whichever path is actually available
-- to you.
-- ============================================================

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS overdue_notified_at date;

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
      v_property.name || ' was due for service on ' || to_char(v_property.next_inspection_date, 'DD Mon YYYY') || ' and has not been scheduled.'
    );
    UPDATE public.properties SET overdue_notified_at = CURRENT_DATE WHERE id = v_property.id;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

-- Attempt to schedule it to run once a day at 07:00 UTC. If pg_cron isn't
-- available on this project, this block will error — that's fine, the
-- function above is already created either way and can be called manually
-- (`SELECT public.check_overdue_properties();`) or scheduled externally.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'check-overdue-properties-daily',
    '0 7 * * *',
    'SELECT public.check_overdue_properties();'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped (extension likely unavailable on this project) — check_overdue_properties() was still created and can be called manually or scheduled externally.';
END $$;
