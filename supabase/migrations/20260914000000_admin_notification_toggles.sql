-- ============================================================
-- Migration: wire up 3 of the 4 remaining "decorative" admin notification
-- toggles (critical_defect, job_completed, quote_submitted)
-- ============================================================
-- Settings -> Notifications has five toggles on company.notification_settings.
-- Only new_job actually did anything (20260912000000_job_assigned_notifications.sql,
-- fires per assigned technician). The other four wrote to a setting nothing
-- ever read back — an admin who believed they'd be notified the moment a
-- critical defect was logged simply never would be.
--
-- These three are genuine company-wide EVENTS (something happens once, at a
-- specific moment) — the fourth toggle, overdue_service, is fundamentally
-- different: "a property's next_inspection_date has passed" isn't triggered
-- by any insert/update, it becomes true purely from the passage of time, so
-- it needs a scheduled check instead of a trigger. That one is intentionally
-- NOT in this migration — see the follow-up migration
-- (20260914010000_overdue_service_notifications.sql) for why it needs
-- pg_cron specifically and can't just be "one more trigger like the others."
--
-- Audience: notifications.user_id references auth.users directly and the
-- table has NO company_id column at all (confirmed in schema.sql) — a
-- `user_id IS NULL` broadcast row is visible to every company on the
-- platform under the RLS policy this session already added
-- (20260913000000_tenant_isolation_rls_hardening.sql), not just the company
-- the event happened in. So these do NOT broadcast — each inserts one row
-- per active admin of the SPECIFIC company the event belongs to, the same
-- "one row per target user" shape the admin dashboard's own manual
-- broadcast feature (src/app/(dashboard)/notifications/page.tsx) already
-- uses for exactly this reason.
--
-- quote_submitted specifically fires on quotes.status becoming 'sent' — the
-- literal status value the schema already defines for this
-- (draft/sent/approved/rejected) — NOT on 'approved'. As of this migration
-- nothing in the admin dashboard's actual UI ever sets a quote to 'sent'
-- (grepped — only draft->approved/rejected are wired), so this toggle will
-- go quiet until a "Send Quote to Client" action is built; this is the
-- correct, schema-consistent trigger point for it regardless, not a
-- guess at some other meaning of "submitted."
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_company_admins(
  p_company_id uuid,
  p_setting_key text,
  p_job_id uuid,
  p_type text,
  p_title text,
  p_message text
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
    INSERT INTO public.notifications (user_id, job_id, type, title, message)
    VALUES (v_admin.id, p_job_id, p_type, p_title, p_message);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- A notification failing to write must never block the real event it's
  -- attached to (a defect being logged, a job completing, a quote going
  -- out) — same hardening rule as every other trigger in this schema.
  RETURN;
END;
$$;

-- ── 1. Critical defect logged ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_critical_defect() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property_name text;
BEGIN
  IF NEW.severity != 'critical' THEN
    RETURN NEW;
  END IF;
  -- Only fire once per defect actually BECOMING critical — an insert that's
  -- already critical, or an update where severity changed TO critical from
  -- something else. Re-saving an already-critical defect (editing its
  -- description, say) must not re-notify every time.
  IF TG_OP = 'UPDATE' AND OLD.severity = 'critical' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_property_name FROM public.properties WHERE id = NEW.property_id;

  PERFORM public.notify_company_admins(
    NEW.company_id, 'critical_defect', NEW.job_id, 'critical_defect',
    'Critical defect logged',
    'A critical defect was logged at ' || COALESCE(v_property_name, 'a property') || ': ' || left(NEW.description, 120)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_critical_defect ON public.defects;
CREATE TRIGGER trg_notify_critical_defect
  AFTER INSERT OR UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.notify_critical_defect();

-- ── 2. Job completed ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_job_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property_name text;
BEGIN
  IF NEW.status != 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_property_name FROM public.properties WHERE id = NEW.property_id;

  PERFORM public.notify_company_admins(
    NEW.company_id, 'job_completed', NEW.id, 'job_completed',
    'Job completed',
    'The job at ' || COALESCE(v_property_name, 'a property') || ' has been marked completed.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_completed ON public.jobs;
CREATE TRIGGER trg_notify_job_completed
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_completed();

-- ── 3. Quote sent to client ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_quote_submitted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id   uuid;
  v_property_name text;
BEGIN
  IF NEW.status != 'sent' OR (TG_OP = 'UPDATE' AND OLD.status = 'sent') THEN
    RETURN NEW;
  END IF;

  -- quotes.company_id is nullable (unlike most tables here) — same
  -- fallback-via-job_id pattern already established in log_deletion().
  SELECT COALESCE(NEW.company_id, j.company_id), p.name
    INTO v_company_id, v_property_name
    FROM public.jobs j JOIN public.properties p ON p.id = j.property_id
    WHERE j.id = NEW.job_id;

  PERFORM public.notify_company_admins(
    v_company_id, 'quote_submitted', NEW.job_id, 'quote_submitted',
    'Quote sent to client',
    'A quote for ' || COALESCE(v_property_name, 'a property') || ' totalling $' || to_char(NEW.total_amount, 'FM999,999,990.00') || ' has been sent.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_quote_submitted ON public.quotes;
CREATE TRIGGER trg_notify_quote_submitted
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.notify_quote_submitted();
