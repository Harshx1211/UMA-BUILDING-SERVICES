import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllByIds, fetchAllPaged } from './paginate';
import { parseCategory } from './categoryGrouping';
import { prepareInlinePhotos } from '../photos/prepareInlinePhotos';
import { prepareFullResUrls } from '../photos/prepareFullResUrls';
import { config } from '../config';
import type { StageTimer } from '../generation/stageTimer';
import { shrinkSignature } from '../photos/shrinkSignature';
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

/**
 * Every query below feeds content into a compliance document. A failed read
 * must stop generation (the technician just taps Generate again) rather than
 * quietly producing a PDF with the company details, signature or crew
 * missing — the same reasoning as the asset_type_definitions fix in
 * generation/pipeline.ts.
 */
function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Failed to load ${what}: ${result.error.message}`);
  return result.data;
}

export type FetchedReportData = ReportData & {
  /** asset_type value -> definition (company's own + global). Returned so
   * the pipeline doesn't fetch the exact same rows a second time. */
  assetTypesByValue: Map<string, AssetTypeDefinition>;
};

export async function fetchReportData(
  db: SupabaseClient,
  jobId: string,
  timer?: StageTimer,
): Promise<FetchedReportData> {
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('*, property:properties(*), assigned_user:users(*)')
    .eq('id', jobId)
    .single();
  if (jobErr || !job) throw new JobNotFoundError(`Job ${jobId} not found`);

  // PERF: everything below depends only on the job row, not on each other —
  // one round of concurrent requests instead of ~8 back-to-back ones. Photo
  // preparation (download + resize every photo — by far the slowest part of
  // the whole fetch) starts the moment the photo list arrives and overlaps
  // all the other queries, instead of waiting until they'd all finished.
  const photosPromise = fetchAllPaged<InspectionPhoto>(db, () =>
    db.from('inspection_photos').select('*').eq('job_id', jobId),
  );
  // Independent of each other (one downloads+resizes originals, the other
  // just signs URLs for them) — run concurrently.
  const photoPrep = photosPromise.then((list) =>
    Promise.all([
      prepareInlinePhotos(db, list, config.photoBucket),
      prepareFullResUrls(db, list, config.photoBucket),
    ]),
  );
  // Awaited further down; this only stops an early failure elsewhere from
  // also surfacing as an unhandled rejection of this promise.
  photoPrep.catch(() => {});

  const [jobAssets, defects, photos, timeLogs, quotes, companyRes, assetTypeRes, signatureRes, jobTechRes] =
    await Promise.all([
      fetchAllPaged<JobAsset>(db, () => db.from('job_assets').select('*').eq('job_id', jobId)),
      fetchAllPaged<Defect>(db, () => db.from('defects').select('*').eq('job_id', jobId)),
      photosPromise,
      fetchAllPaged<TimeLog>(db, () => db.from('time_logs').select('*').eq('job_id', jobId)),
      fetchAllPaged<Quote & { items: Quote['items'] }>(db, () =>
        db
          .from('quotes')
          .select('*, items:quote_items(*, inventory_item:inventory_items(name))')
          .eq('job_id', jobId),
      ),
      db.from('companies').select('*').eq('id', job.company_id).single(),
      db
        .from('asset_type_definitions')
        .select('value, label, full_label, inspection_routine')
        .or(`company_id.eq.${job.company_id},company_id.is.null`),
      db.from('signatures').select('*').eq('job_id', jobId).maybeSingle(),
      // The assigned crew — a flat list, no primary (see job_technicians
      // migration).
      db
        .from('job_technicians')
        .select('user:users(id, full_name, fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry)')
        .eq('job_id', jobId),
    ]);

  timer?.lap('queries');
  const company = check(companyRes, 'company details');
  const assetTypeDefRows = check(assetTypeRes, 'asset type definitions');
  const signature = check(signatureRes, 'signature');
  // Shrunk to print size alongside the rest of the photo work (see
  // shrinkSignature) — never fails.
  const signaturePrep = Promise.all([
    shrinkSignature(signature?.signature_url as string | null | undefined),
    shrinkSignature(signature?.tech_signature_url as string | null | undefined),
  ]);
  const jobTechRows = check(jobTechRes, 'assigned technicians');
  const assetTypesByValue = new Map<string, AssetTypeDefinition>(
    (assetTypeDefRows ?? []).map((t: AssetTypeDefinition) => [t.value, t]),
  );

  // Falls back to the legacy single assigned_user for any job whose
  // job_technicians rows haven't been created (created before that feature).
  const assignedUsers: JobUser[] =
    jobTechRows && jobTechRows.length > 0
      ? ((jobTechRows as unknown as { user: JobUser | null }[]).map((r) => r.user).filter(Boolean) as JobUser[])
      : job.assigned_user
        ? [job.assigned_user as JobUser]
        : [];
  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));

  // Only fetch assets that actually have a job_assets row for THIS job — fetching
  // every property asset (the original bug) makes out-of-scope assets show as N/T.
  const assetIds = [...new Set(jobAssets.map((ja) => ja.asset_id).filter(Boolean))];
  // Resolve actioned_by -> name for every technician who's touched this
  // job's assets, independent of the current crew (job_technicians) — a
  // job_assets row's actioned_by should still be attributable even if that
  // tech is later removed from the job's assignment.
  const actionedByIds = [...new Set(jobAssets.map((ja) => ja.actioned_by).filter((id): id is string => !!id))];
  // One row per distinct technician who worked this job: every assigned
  // technician first, plus anyone else who logged time (time-tracking is
  // optional, so time_logs alone can't be the source of who worked it).
  const extraUserIds = [...new Set(timeLogs.map((t) => t.user_id))].filter((id) => !assignedUserIds.has(id));

  // Second (and last) round — these three depend on the first round's
  // results but not on each other.
  const [assets, actionedByUsers, extraUsers] = await Promise.all([
    assetIds.length > 0
      ? fetchAllByIds<Asset>(assetIds, (batch) => db.from('assets').select('*').in('id', batch))
      : Promise.resolve([] as Asset[]),
    actionedByIds.length > 0
      ? fetchAllByIds<{ id: string; full_name: string }>(actionedByIds, (batch) =>
          db.from('users').select('id, full_name').in('id', batch),
        )
      : Promise.resolve([] as { id: string; full_name: string }[]),
    extraUserIds.length > 0
      ? fetchAllByIds<JobUser>(extraUserIds, (batch) =>
          db
            .from('users')
            .select('id, full_name, fpas_number, fpas_class, fpas_expiry, state_license, state_license_expiry')
            .in('id', batch),
        )
      : Promise.resolve([] as JobUser[]),
  ]);
  timer?.lap('assets');
  const actionedByNameById = new Map<string, string>();
  for (const u of actionedByUsers ?? []) actionedByNameById.set(u.id, u.full_name);

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
      actionedByName: latest?.actioned_by ? (actionedByNameById.get(latest.actioned_by) ?? null) : null,
      categoryLabel: parsed.label,
      categoryNumber: parsed.number,
      categoryOfficialSection: parsed.officialSection,
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

  const [signedPhotoUrls, fullResPhotoUrls] = await photoPrep;
  const [clientSignatureUrl, techSignatureUrl] = await signaturePrep;
  // Whatever photo work was still outstanding once the queries finished —
  // the part of photo prep that actually added to the wait.
  timer?.lap('photos');
  const usersById = new Map<string, JobUser>((extraUsers ?? []).map((u: JobUser) => [u.id, u]));

  const sessionsFor = (uid: string) => timeLogs.filter((t) => t.user_id === uid);
  const rangeFor = (sessions: TimeLog[]): { firstClockIn: string; lastClockOut: string | null } | null => {
    if (sessions.length === 0) return null;
    const firstClockIn = sessions.map((s) => s.clock_in).sort()[0];
    const clockOuts = sessions.map((s) => s.clock_out).filter(Boolean) as string[];
    const lastClockOut = clockOuts.length === sessions.length ? clockOuts.sort().at(-1)! : null;
    return { firstClockIn, lastClockOut };
  };

  const timeLogUsers: ReportData['timeLogUsers'] = [];
  for (const assignedUser of assignedUsers) {
    const assignedRange = rangeFor(sessionsFor(assignedUser.id));
    timeLogUsers.push({
      user: assignedUser,
      // No time_logs for this tech is common (time-tracking is optional) —
      // fall back to the job's own dates rather than an empty cell.
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
    fullResPhotoUrls,
    signature: (signature
      ? { ...signature, signature_url: clientSignatureUrl, tech_signature_url: techSignatureUrl }
      : null) as Signature | null,
    assignedUsers,
    timeLogUsers,
    approvedQuote,
    reportId,
    dateOfService,
    assetTypesByValue,
  };
}
