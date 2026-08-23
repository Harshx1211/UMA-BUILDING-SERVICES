import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPaged } from './paginate';
import { parseCategory } from './categoryGrouping';
import { prepareInlinePhotos } from '../photos/prepareInlinePhotos';
import { config } from '../config';
import {
  Asset,
  AssetTypeDefinition,
  AssetWithResult,
  Company,
  Defect,
  InspectionPhoto,
  Job,
  JobAsset,
  JobUser,
  Quote,
  ReportData,
  Signature,
  TimeLog,
} from '../types';

export class JobNotFoundError extends Error {}

export async function fetchReportData(db: SupabaseClient, jobId: string): Promise<ReportData> {
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('*, property:properties(*), assigned_user:users(*)')
    .eq('id', jobId)
    .single();
  if (jobErr || !job) throw new JobNotFoundError(`Job ${jobId} not found`);

  const [jobAssets, defects, photos, timeLogs, quotes] = await Promise.all([
    fetchAllPaged<JobAsset>(db, () => db.from('job_assets').select('*').eq('job_id', jobId)),
    fetchAllPaged<Defect>(db, () => db.from('defects').select('*').eq('job_id', jobId)),
    fetchAllPaged<InspectionPhoto>(db, () =>
      db.from('inspection_photos').select('*').eq('job_id', jobId),
    ),
    fetchAllPaged<TimeLog>(db, () => db.from('time_logs').select('*').eq('job_id', jobId)),
    fetchAllPaged<Quote & { items: Quote['items'] }>(db, () =>
      db
        .from('quotes')
        .select('*, items:quote_items(*, inventory_item:inventory_items(name))')
        .eq('job_id', jobId),
    ),
  ]);

  const { data: company } = await db
    .from('companies')
    .select('*')
    .eq('id', job.company_id)
    .single();

  // Only fetch assets that actually have a job_assets row for THIS job — fetching
  // every property asset (the original bug) makes out-of-scope assets show as N/T.
  const assetIds = [...new Set(jobAssets.map((ja) => ja.asset_id).filter(Boolean))];
  const assets =
    assetIds.length > 0
      ? await fetchAllPaged<Asset>(db, () => db.from('assets').select('*').in('id', assetIds))
      : [];

  const { data: assetTypeDefRows } = await db
    .from('asset_type_definitions')
    .select('value, label, full_label, inspection_routine')
    .or(`company_id.eq.${job.company_id},company_id.is.null`);
  const assetTypesByValue = new Map<string, AssetTypeDefinition>(
    (assetTypeDefRows ?? []).map((t: AssetTypeDefinition) => [t.value, t]),
  );

  // Merge job_assets result onto each asset — pick the most recently actioned
  // match, not just the first array hit (a job can accumulate multiple
  // job_assets rows per asset over re-inspections).
  const assetsWithResult: AssetWithResult[] = assets.map((asset) => {
    const matches = jobAssets.filter((ja) => ja.asset_id === asset.id);
    const latest = [...matches].sort((a, b) => {
      const aMs = a.actioned_at ? new Date(a.actioned_at).getTime() : 0;
      const bMs = b.actioned_at ? new Date(b.actioned_at).getTime() : 0;
      return bMs - aMs;
    })[0];
    const typeDef = assetTypesByValue.get(asset.asset_type);
    const parsed = parseCategory(typeDef?.inspection_routine ?? 'General Inspection');
    return {
      ...asset,
      result: latest?.result ?? null,
      defect_reason: latest?.defect_reason ?? null,
      technician_notes: latest?.technician_notes ?? null,
      actioned_at: latest?.actioned_at ?? null,
      categoryLabel: parsed.label,
      categoryNumber: parsed.number,
    };
  });

  const photosByAsset = new Map<string, InspectionPhoto[]>();
  const photosByDefect = new Map<string, InspectionPhoto[]>();
  for (const p of photos) {
    if (p.asset_id) {
      const list = photosByAsset.get(p.asset_id) ?? [];
      list.push(p);
      photosByAsset.set(p.asset_id, list);
    }
    if (p.defect_id) {
      const list = photosByDefect.get(p.defect_id) ?? [];
      list.push(p);
      photosByDefect.set(p.defect_id, list);
    }
  }

  const signedPhotoUrls = await prepareInlinePhotos(db, photos, config.photoBucket);

  const { data: signature } = await db
    .from('signatures')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  // One row per distinct technician who worked this job. Time-tracking
  // (clocking in/out) is a separate, optional feature from actually
  // performing the inspection — a job with no time_logs rows (tech never
  // clocked in) still has the technician who did the whole job recorded on
  // `jobs.assigned_to`. Relying on time_logs alone meant a job with no time
  // entries showed NO technician at all on the signoff, which is what "tech
  // details not reflecting" was — always include the assigned technician
  // first, then any additional technicians who logged time (matching the
  // user's confirmed "everyone who worked it" decision as a supplement).
  const userIds = [...new Set(timeLogs.map((t) => t.user_id))];
  const extraUserIds = userIds.filter((id) => id !== job.assigned_to);
  let usersById = new Map<string, JobUser>();
  if (extraUserIds.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, full_name, fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry')
      .in('id', extraUserIds);
    usersById = new Map<string, JobUser>((users ?? []).map((u: JobUser) => [u.id, u]));
  }

  const sessionsFor = (uid: string) => timeLogs.filter((t) => t.user_id === uid);
  const rangeFor = (sessions: TimeLog[]): { firstClockIn: string; lastClockOut: string | null } | null => {
    if (sessions.length === 0) return null;
    const firstClockIn = sessions.map((s) => s.clock_in).sort()[0];
    const clockOuts = sessions.map((s) => s.clock_out).filter(Boolean) as string[];
    const lastClockOut = clockOuts.length === sessions.length ? clockOuts.sort().at(-1)! : null;
    return { firstClockIn, lastClockOut };
  };

  const timeLogUsers: ReportData['timeLogUsers'] = [];
  if (job.assigned_user) {
    const assignedRange = rangeFor(sessionsFor(job.assigned_to));
    timeLogUsers.push({
      user: job.assigned_user as JobUser,
      // No time_logs for the assigned tech is common (time-tracking is
      // optional) — fall back to the job's own dates rather than an empty cell.
      firstClockIn: assignedRange?.firstClockIn ?? job.completed_at ?? job.scheduled_date,
      lastClockOut: assignedRange?.lastClockOut ?? job.completed_at ?? null,
      hasRealSession: assignedRange !== null,
    });
  }
  for (const uid of extraUserIds) {
    const user = usersById.get(uid);
    const range = rangeFor(sessionsFor(uid));
    if (!user || !range) continue;
    timeLogUsers.push({ user, firstClockIn: range.firstClockIn, lastClockOut: range.lastClockOut, hasRealSession: true });
  }

  const approvedQuote = quotes.find((q) => q.status === 'approved') ?? null;
  const reportId = jobId.slice(0, 8).toUpperCase();
  const dateOfService = job.completed_at ?? job.scheduled_date ?? job.created_at ?? null;

  return {
    job: job as Job,
    company: (company ?? {}) as Company,
    assets: assetsWithResult,
    defects,
    photosByAsset,
    photosByDefect,
    signedPhotoUrls,
    signature: (signature ?? null) as Signature | null,
    timeLogUsers,
    approvedQuote,
    reportId,
    dateOfService,
  };
}
