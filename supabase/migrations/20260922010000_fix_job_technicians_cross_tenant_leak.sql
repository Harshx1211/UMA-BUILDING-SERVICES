-- Fixes a confirmed cross-tenant vulnerability found during a full
-- security audit: a user could delete another company's inspection
-- photos, and the deletion would actively propagate to that company's
-- own devices via deletion_log/Realtime.
--
-- THE CHAIN:
-- 1. job_technicians_self_assign_insert (20260921030000) only checks that
--    the row being inserted has `company_id = get_user_company_id()` and
--    `user_id = auth.uid()` — it never verifies that the `job_id` being
--    referenced actually belongs to that company. A user can INSERT a
--    job_technicians row with their OWN company_id but a job_id that
--    belongs to a DIFFERENT company; nothing rejects it.
-- 2. photos_delete_via_job_technicians (20260824020000) grants DELETE on
--    inspection_photos to anyone with a job_technicians row for that
--    job_id — with NO company_id check of its own. Since RLS permissive
--    policies are OR'd together, this policy alone is enough to delete a
--    photo that the table's own inspection_photos_tenant_isolation policy
--    would otherwise correctly block.
-- Chained: plant a job_technicians row pointing at a victim company's job
-- (step 1), then DELETE FROM inspection_photos WHERE job_id = <that job>
-- succeeds via step 2 — a real cross-tenant destructive write, reachable
-- through the app's own normal INSERT payload shape (lib/sync.ts fills in
-- company_id from the device's own cached profile without ever checking
-- it against the job being referenced).
--
-- THE FIX: both policies need to verify the job itself actually belongs
-- to the caller's own company — the same pattern already used correctly
-- by time_logs_select_own_or_assigned_job (20260921000000), which ANDs
-- its job_technicians EXISTS check with the outer row's own company_id.

DROP POLICY IF EXISTS "job_technicians_self_assign_insert" ON public.job_technicians;
CREATE POLICY "job_technicians_self_assign_insert" ON public.job_technicians
  FOR INSERT WITH CHECK (
    company_id = (select public.get_user_company_id())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_technicians.job_id
        AND j.company_id = (select public.get_user_company_id())
    )
  );

DROP POLICY IF EXISTS "photos_delete_via_job_technicians" ON public.inspection_photos;
CREATE POLICY "photos_delete_via_job_technicians" ON public.inspection_photos
  FOR DELETE
  TO authenticated
  USING (
    inspection_photos.company_id = (select public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.job_technicians jt
      WHERE jt.job_id = inspection_photos.job_id
        AND jt.user_id = auth.uid()
    )
  );
