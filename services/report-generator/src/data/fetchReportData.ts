import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPaged } from './paginate';
import { parseCategory } from './categoryGrouping';
import { signPhotoUrls } from '../photos/signPhotoUrls';
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

  const signedPhotoUrls = await signPhotoUrls(db, photos, config.photoBucket);

  const { data: signature } = await db
    .from('signatures')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  // One row per distinct technician who logged time on this job (per user's
  // confirmed answer — signoff lists everyone who worked it, not just assigned_to).
  const userIds = [...new Set(timeLogs.map((t) => t.user_id))];
  let timeLogUsers: ReportData['timeLogUsers'] = [];
  if (userIds.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, full_name, fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry')
      .in('id', userIds);
    const usersById = new Map<string, JobUser>((users ?? []).map((u: JobUser) => [u.id, u]));

    timeLogUsers = userIds
      .map((uid) => {
        const sessions = timeLogs.filter((t) => t.user_id === uid);
        const firstClockIn = sessions
          .map((s) => s.clock_in)
          .sort()[0];
        const clockOuts = sessions.map((s) => s.clock_out).filter(Boolean) as string[];
        const lastClockOut = clockOuts.length === sessions.length
          ? clockOuts.sort().at(-1)!
          : null; // still has an open session — don't claim a false "finished at" time
        const user = usersById.get(uid);
        if (!user) return null;
        return { user, firstClockIn, lastClockOut };
      })
      .filter((x): x is ReportData['timeLogUsers'][number] => x !== null)
      .sort((a, b) => a.firstClockIn.localeCompare(b.firstClockIn));
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
