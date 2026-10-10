-- ============================================================
-- Migration: a user sees only their own notifications
-- ============================================================
-- notifications_select_own_or_broadcast allowed `user_id IS NULL` rows to
-- every signed-in user. notifications has no company_id, so a "broadcast"
-- row is visible to EVERY tenant on the platform, not just the company
-- that sent it. Nothing creates such rows today (the admin portal's
-- broadcast writes one row per user, and every notify_* trigger sets
-- user_id), so this was a latent cross-tenant leak waiting for the first
-- feature that did. The mobile app's pull (user_id = me OR user_id IS NULL)
-- keeps working unchanged — it simply only ever gets its own rows.
--
-- Safe to run any time. Reports how many no-recipient rows exist (they
-- become invisible to users after this; the admin portal still sees them).
-- ============================================================

DROP POLICY IF EXISTS "notifications_select_own_or_broadcast" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

SELECT count(*) AS rows_with_no_recipient FROM public.notifications WHERE user_id IS NULL;
