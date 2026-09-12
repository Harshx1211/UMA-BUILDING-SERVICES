/**
 * store/inspectionStore.ts
 *
 * Fix summary (this revision):
 *   1. updateAssetResult: photos[] now written to the in-memory asset after a FAIL result.
 *      Previously photos were inserted into inspection_photos + queued for upload, but the
 *      in-memory AssetWithResult.photos array was never updated. This caused getReferencedPhotoIds
 *      in pdfGenerator to correctly include the asset, but loadAssetsForInspection had to be
 *      called again to see the photos — meaning a PDF generated in the same session as the
 *      inspection would always have blank photo slots for fail assets.
 *
 *   2. updateAssetResult: when updating an existing defect, photos are now also re-queued
 *      so a re-inspection with new photos doesn't silently drop them.
 *
 *   3. addPhotoToAsset: passes defect_id: null explicitly to queuePhotoUpload via photosStore
 *      (no change to behaviour, just made explicit for clarity).
 *
 *   4. Minor: consistent null coalescing, removed a stray indent on newAssets declaration.
 */

import { create } from 'zustand';
import type { Asset, JobAsset } from '@/types';
import {
  getAssetsForProperty,
  queryRecords,
  queryRecordsIn,
  upsertRecord,
  addToSyncQueue,
  insertRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  getJobById,
  cancelPendingPhotoUpload,
  recordDeletedPhoto,
  openDatabase,
  logFieldAudit,
} from '@/lib/database';
import { SyncOperation, InspectionResult, DefectStatus, DefectSeverity, JobStatus } from '@/constants/Enums';
import { usePhotosStore } from '@/store/photosStore';
import { useAuthStore } from '@/store/authStore';
import { useDefectsStore } from '@/store/defectsStore';
import { generateUUID } from '@/utils/uuid';
import { queuePhotoUpload } from '@/lib/photoUpload';
import { syncNow } from '@/lib/sync';

// ─── Helper ───────────────────────────────────────────────────
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ─── Types ────────────────────────────────────────────────────

export type AssetWithResult = Asset & {
  result: InspectionResult | null;
  checklist_data: string | null;
  is_compliant: boolean;
  defect_reason: string | null;
  technician_notes: string | null;
  internal_notes: string | null;
  job_asset_id: string | null;
  photos: string[];
  previousResult: InspectionResult | null;
  previousDate: string | null;
};

interface InspectionState {
  assets: AssetWithResult[];
  currentJobId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: { inspected: number; total: number };

  loadAssetsForInspection: (jobId: string) => void;
  updateAssetResult: (
    assetId: string,
    result: InspectionResult | null,
    checklistData?: string,
    isCompliant?: boolean,
    defectReason?: string,
    notes?: string,
    photos?: string[],
    severity?: DefectSeverity,
    defectCode?: string | null,
    quotePrice?: number | null,
    // Set by a fresh Pass/N-T -> Fail transition (asset/[assetId].tsx's
    // pendingFail) so this always creates an independent defect instead of
    // merging into whatever unrelated defect might already exist on this
    // asset — see the "Defect auto-create / update" block's own comment.
    forceNewDefect?: boolean,
    // job_assets.internal_notes — team-internal communication only, never
    // read by the report-generator (see its fetchReportData.ts/types.ts).
    // Appended at the end (not inserted alongside `notes`) so every
    // existing positional call site keeps working unchanged; only a call
    // site that actually cares about internal notes needs to reach this far.
    internalNotes?: string,
  ) => void;
  addPhotoToAsset: (assetId: string, photoUri: string) => void;
  removePhotoFromAsset: (assetId: string, photoUri: string) => void;
  isInspectionComplete: () => boolean;
  reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function calcProgress(assets: AssetWithResult[]) {
  return {
    total: assets.length,
    inspected: assets.filter(a => a.result !== null).length,
  };
}

// ─── Store ────────────────────────────────────────────────────

export const useInspectionStore = create<InspectionState>((set, get) => ({
  assets: [],
  currentJobId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  progress: { inspected: 0, total: 0 },

  loadAssetsForInspection: (jobId) => {
    try {
      set({ isLoading: true, error: null, currentJobId: jobId });

      const job = getJobById<{ property_id: string }>(jobId);
      if (!job) throw new Error('Job not found');

      const dbAssets         = getAssetsForProperty<Asset>(job.property_id);
      const jobAssets        = queryRecords<JobAsset>('job_assets', { job_id: jobId })
        .sort((a, b) => (b.actioned_at ?? '').localeCompare(a.actioned_at ?? ''));
      const inspectionPhotos = queryRecords<{ asset_id: string; photo_url: string }>(
        'inspection_photos', { job_id: jobId }
      );

      // Load previous results only for assets in this property (avoids full table scan)
      const assetIds = dbAssets.map(a => a.id);
      const allPreviousJobAssets = queryRecordsIn<{
        asset_id: string; result: string; actioned_at: string; job_id: string;
      }>('job_assets', 'asset_id', assetIds);

      const merged: AssetWithResult[] = dbAssets.map(asset => {
        const ja = jobAssets.find(j => j.asset_id === asset.id);
        const photosForAsset = inspectionPhotos
          .filter(p => p.asset_id === asset.id)
          .map(p => p.photo_url);

        const prevRecords = allPreviousJobAssets
          .filter(r => r.asset_id === asset.id && r.job_id !== jobId && r.result != null)
          .sort((a, b) => (b.actioned_at ?? '').localeCompare(a.actioned_at ?? ''));
        const prev = prevRecords[0] ?? null;

        return {
          ...asset,
          result: ja?.result ?? null,
          checklist_data: ja?.checklist_data ?? null,
          is_compliant: Boolean(ja?.is_compliant),
          defect_reason: ja?.defect_reason ?? null,
          technician_notes: ja?.technician_notes ?? null,
          internal_notes: ja?.internal_notes ?? null,
          job_asset_id: ja?.id ?? null,
          photos: photosForAsset,
          previousResult: prev ? (prev.result as InspectionResult) : null,
          previousDate: prev?.actioned_at ? prev.actioned_at.slice(0, 10) : null,
        };
      });

      set({ assets: merged, progress: calcProgress(merged), isLoading: false });
    } catch (err: unknown) {
      set({ error: errorMessage(err), isLoading: false });
    }
  },

  updateAssetResult: (
    assetId, result, checklistData, isCompliant,
    defectReason, notes, photos, severity, defectCode, quotePrice,
    forceNewDefect, internalNotes,
  ) => {
    try {
      set({ isSaving: true, error: null });
      const { assets, currentJobId } = get();
      if (!currentJobId) throw new Error('No active job');

      // Defense-in-depth: a completed job's report is treated as final, and
      // "Continue Working" (which resets status + clears the stale report_url)
      // is the only sanctioned way back into edit mode. inspect.tsx already
      // blocks entry for a completed job, but guard the actual write here too
      // so no other/future call site can silently change data behind a report
      // that's supposed to be locked.
      const job = getJobById<{ status: string }>(currentJobId);
      if (job?.status === JobStatus.Completed) {
        set({ isSaving: false });
        throw new Error('This job is completed — tap "Continue Working" to make changes.');
      }
      // FIX: Cancelled was never treated as a locked state here — an asset
      // result/defect could still be written against a job that had already
      // been cancelled.
      if (job?.status === JobStatus.Cancelled) {
        set({ isSaving: false });
        throw new Error('This job has been cancelled and can no longer be edited.');
      }

      const assetIndex = assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) throw new Error('Asset not found');
      const asset = assets[assetIndex];

      // Resolve the job_asset id — prefer the in-memory one (fastest path), then fall
      // back to a DB lookup.  This prevents duplicate rows when the modal is saved
      // before the in-memory state has been refreshed with the newly-assigned id.
      // A9 FIX: Merged two separate queryRecords calls into one.
      // FIX: the in-memory job_asset_id can be stale if this exact row was
      // deleted by someone else (e.g. "Delete Asset" on inspect.tsx, from
      // another device) while this screen was open — this screen has no
      // live-deletion signal while focused (a deletion only ever arrives via
      // deletion_log's own onSyncComplete event, a separate bus from the
      // per-job channel's onChange this screen actually listens to).
      // Trusting a stale id blindly meant upsertRecord's INSERT ... ON
      // CONFLICT DO UPDATE silently RESURRECTED the deleted row locally
      // under its old id below, then queued an Update (isExistingRecord
      // looked true) that matched zero rows server-side and "succeeded" as
      // a no-op — a permanent, silent, per-device data divergence with no
      // error anywhere. A cheap local existence check closes this: if the
      // row's actually gone, this falls through to the exact same path a
      // first-ever inspection of this asset already takes.
      let jobAssetId: string;
      let isExistingRecord = Boolean(asset.job_asset_id) && Boolean(getRecord('job_assets', asset.job_asset_id as string));
      if (isExistingRecord) {
        jobAssetId = asset.job_asset_id as string;
      } else {
        const existing = queryRecords<{ id: string }>(
          'job_assets', { job_id: currentJobId, asset_id: assetId }
        )[0];
        jobAssetId = existing?.id ?? generateUUID();
        isExistingRecord = Boolean(existing);
      }

      // FIX: inject company_id for RLS on job_assets INSERT/UPDATE.
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const userId = useAuthStore.getState().user?.id ?? '';

      const jobAssetPayload: Record<string, string | number | null> = {
        id: jobAssetId,
        job_id: currentJobId,
        asset_id: assetId,
        company_id: companyId,
        result: result ?? null,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ? 1 : 0,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        internal_notes: internalNotes ?? null,
        actioned_at: new Date().toISOString(),
        actioned_by: userId || null,
      };

      // Field-level audit Timeline — one row per SAVE (not per changed
      // field). `asset` still holds the OLD values here, right up until
      // upsertRecord below writes the new ones.
      const AUDITED_JOB_ASSET_FIELDS = ['result', 'checklist_data', 'is_compliant', 'defect_reason', 'technician_notes', 'internal_notes'] as const;
      const jobAssetChanges = AUDITED_JOB_ASSET_FIELDS
        .map((field) => ({ field, old: (asset as unknown as Record<string, unknown>)[field] ?? null, new: jobAssetPayload[field] ?? null }))
        .filter((c) => JSON.stringify(c.old) !== JSON.stringify(c.new));
      logFieldAudit('job_assets', jobAssetId, currentJobId, companyId, userId || null, jobAssetChanges);

      upsertRecord('job_assets', jobAssetPayload);

      // Purge any duplicate rows for this asset+job that have a different id.
      // These can accumulate from rapid taps before the first save completes.
      try {
        const db = openDatabase();
        db.runSync(
          `DELETE FROM job_assets WHERE job_id = ? AND asset_id = ? AND id != ?`,
          [currentJobId, assetId, jobAssetId],
        );
      } catch { /* non-fatal */ }

      const syncOp = isExistingRecord ? SyncOperation.Update : SyncOperation.Insert;
      addToSyncQueue('job_assets', jobAssetId, syncOp, jobAssetPayload);


      // ── Photo reconciliation ────────────────────────────────────────────────
      // `photos` is the FINAL desired set of URIs the user left in the modal.
      // We diff it against what is currently in SQLite:
      //   • Deleted photos  → remove from SQLite immediately.
      //                       If the photo was already uploaded (https://) → also
      //                       queue a Supabase DB row delete + Storage binary delete.
      //                       If still local (file://) → cancel the pending
      //                       photo_upload task so it never reaches Supabase.
      //   • Kept photos     → leave as-is (preserve upload state).
      //   • New photos      → insert into SQLite and queue for upload.
      if (photos !== undefined) {
        const existingRows = queryRecords<{ id: string; photo_url: string }>(
          'inspection_photos',
          { job_id: currentJobId, asset_id: assetId },
        );

        const desiredUrlSet  = new Set(photos);
        const existingUrlSet = new Set(existingRows.map(r => r.photo_url));

        // ── Deletions ────────────────────────────────────────────────────────
        for (const row of existingRows) {
          if (!desiredUrlSet.has(row.photo_url)) {
            // 1. Remove from local SQLite immediately
            deleteRecord('inspection_photos', row.id);

            // 2. Permanently record in tombstone — survives retries/reinstalls
            recordDeletedPhoto(row.id);

            if (row.photo_url.startsWith('https://')) {
              // Photo is already in Supabase — queue a delete for both the DB row
              // and the Storage binary (sync.ts _pushQueue handles both).
              // FIX: job_id included so lib/sync.ts's report-generation
              // blocker check can see this pending Delete via its payload
              // substring fallback — the row is already gone locally by the
              // time that check runs, so a bare {id, photo_url} payload gave
              // it nothing to match this job against.
              addToSyncQueue('inspection_photos', row.id, SyncOperation.Delete, {
                id: row.id,
                photo_url: row.photo_url,
                job_id: currentJobId,
              });
            } else {
              // Photo only exists locally (file:// URI, not yet uploaded).
              // Cancel the pending photo_upload task so it is never sent to Supabase.
              // No Supabase row exists yet, so no DB delete is needed.
              cancelPendingPhotoUpload(row.id);
            }
          }
        }

        // ── Insertions ────────────────────────────────────────────────────────
        const newPhotoUris = photos.filter(uri => !existingUrlSet.has(uri));

        for (const uri of newPhotoUris) {
          const photoId = generateUUID();
          const photoObj = {
            id: photoId,
            job_id: currentJobId,
            asset_id: assetId,
            defect_id: null as string | null,
            photo_url: uri,
            // FIX: Store the original file:// URI so offline PDF generation can
            // fall back to the local copy after photo_url is replaced with https://.
            local_uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : null,
            caption: null,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userId,
          };
          insertRecord('inspection_photos', photoObj as Record<string, string | number | boolean | null>);
          queuePhotoUpload(uri, currentJobId, assetId, photoId, undefined);
        }
      }

      // ── Auto-delete defect when asset passes / not-tested ─
      // If the previous result was Fail and the new result is Pass or NotTested,
      // an OPEN defect is no longer valid — remove it automatically. A defect
      // that has already progressed past Open (quoted/repaired/monitoring —
      // i.e. someone has actually actioned it) is a real historical record
      // and must survive a later re-inspection finding the asset now passes;
      // it's deliberately NOT filtered back out here.
      // A3 FIX: Also cancel/delete the defect's associated inspection_photos so
      // they don't get uploaded as orphaned rows in Supabase.
      if (result !== InspectionResult.Fail) {
        const staleDefects = queryRecords<{ id: string }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
          status: DefectStatus.Open,
        });
        for (const stale of staleDefects) {
          // Cancel associated photos first
          const stalePhotos = queryRecords<{ id: string; photo_url: string }>(
            'inspection_photos', { defect_id: stale.id }
          );
          for (const p of stalePhotos) {
            deleteRecord('inspection_photos', p.id);
            recordDeletedPhoto(p.id);
            if (p.photo_url.startsWith('https://')) {
              // FIX: job_id included — see the equivalent fix a few lines up
              // in this same function for why (report-generation blocker
              // check's payload substring fallback).
              addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
                id: p.id, photo_url: p.photo_url, job_id: currentJobId,
              });
            } else {
              cancelPendingPhotoUpload(p.id);
            }
          }
          deleteRecord('defects', stale.id);
          addToSyncQueue('defects', stale.id, SyncOperation.Delete, { id: stale.id, job_id: currentJobId });
        }
        if (staleDefects.length > 0) {
          // Refresh defects store so the badge and list update immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        }
      }

      // ── Defect auto-create / update ───────────────────────
      if (result === InspectionResult.Fail && defectReason) {
        // FIX: this used to unconditionally look up "any defect already on
        // this asset" and merge into it — so failing an asset that already
        // carried an UNRELATED defect (logged earlier via the standalone
        // Defects screen against an asset that wasn't Fail yet) silently
        // overwrote that defect's description/severity/price with the new
        // Fail reason, permanently losing the original record. The asset
        // screen now passes forceNewDefect for a fresh Pass/N-T -> Fail
        // transition specifically so this always creates an independent
        // defect instead — the technician's own deliberate "Edit" on an
        // existing defect card still goes through the merge branch below
        // exactly as before (forceNewDefect is never set for that path).
        const existingDefects = forceNewDefect ? [] : queryRecords<{
          id: string; description: string; severity: string; status: string;
          defect_code: string | null; quote_price: number | null;
        }>('defects', {
          job_id: currentJobId,
          asset_id: assetId,
        });

        if (existingDefects.length === 0) {
          const defectId = generateUUID();
          const resolvedSeverity = severity ?? DefectSeverity.NonCritical;

          // FIX: photos are deliberately NOT linked to a specific defect —
          // they live purely on the asset (inspection_photos.asset_id),
          // shown once in the asset's own Photos section and once in the
          // PDF's asset-level photo row. This used to back-fill defect_id
          // onto every unlinked photo for this asset and copy them into
          // defects.photos, which made the SAME photo also show up under
          // the defect card (in-app) and, in the report, under whichever
          // rendering path checked defect_id first — a form of the same
          // "photo association" the report's own asset/defect split was
          // built to avoid duplicating.
          const defectPayload: Record<string, string | number | null> = {
            id: defectId,
            job_id: currentJobId,
            asset_id: assetId,
            property_id: asset.property_id,
            company_id: companyId,
            description: defectReason,
            severity: resolvedSeverity,
            status: DefectStatus.Open,
            photos: '[]',
            created_at: new Date().toISOString(),
            defect_code: defectCode ?? null,
            quote_price: quotePrice ?? null,
          };
          insertRecord('defects', defectPayload);
          addToSyncQueue('defects', defectId, SyncOperation.Insert, defectPayload);

          // FIX: this path bypasses defectsStore.addDefect (which already
          // logs this synthetic entry) — without it, every asset's FIRST
          // defect (the vast majority of all defects, created here rather
          // than through the "additional defect" flow) showed an
          // permanently empty Timeline no matter how many times it was
          // later edited.
          logFieldAudit('defects', defectId, currentJobId, companyId, userId || null, [
            { field: '_created', old: null, new: 'defect created' },
          ]);

          // Refresh defects store so the badge updates immediately
          useDefectsStore.getState().loadDefects(currentJobId);
        } else {
          // Update existing defect description/severity/code/price and reconcile photos
          const existing = existingDefects[0];
          const existingId = existing.id;
          // FIX: a defect already moved past Open (Quoted/Monitoring/Repaired
          // — e.g. an admin actioned it from the web dashboard while the
          // technician was still on site) kept that status forever even when
          // its description was rewritten out from under it here, so a
          // "Repaired" defect could end up describing an entirely different,
          // still-unresolved problem with no indication anything changed.
          // Only reset to Open when the description actually changed — a
          // notes-only resave (handleSaveNote passes the asset's own
          // unchanged defect_reason back through here) must not silently
          // un-resolve an already-actioned defect.
          const descriptionChanged = existing.description !== defectReason;
          const updates: Record<string, string | number | null> = {
            description: defectReason,
            severity: severity ?? DefectSeverity.NonCritical,
            // FIX: defect_code/quote_price were never included in this
            // update payload, so re-picking a Defect Code (or its price) on
            // an asset's primary defect appeared to save — the form showed
            // the new value — but updateRecord's partial SET left the
            // column at its old value forever. Same bug class as the
            // already-fixed Notes/severity-reset issue, on two other
            // fields of this same update path.
            defect_code: defectCode ?? null,
            quote_price: quotePrice ?? null,
            updated_at: new Date().toISOString(),
            ...(descriptionChanged ? { status: DefectStatus.Open } : {}),
          };

          // FIX: photos are deliberately NOT copied onto defect.photos or
          // linked via defect_id — see the matching comment in the create
          // branch above. They stay purely asset-scoped.

          updateRecord('defects', existingId, updates);
          addToSyncQueue('defects', existingId, SyncOperation.Update, updates);

          // FIX: this path bypasses defectsStore.updateDefect (which already
          // does both of these) — without them, editing an asset's primary
          // defect (a) never appeared in its own Timeline and (b) showed
          // stale pre-edit data immediately after saving, since nothing
          // reloaded defectsStore until the technician left and returned to
          // this screen.
          const changes = [
            { field: 'description', old: existing.description ?? null, new: updates.description },
            { field: 'severity',    old: existing.severity ?? null,    new: updates.severity },
            { field: 'defect_code', old: existing.defect_code ?? null, new: updates.defect_code },
            { field: 'quote_price', old: existing.quote_price ?? null, new: updates.quote_price },
            ...(descriptionChanged ? [{ field: 'status', old: existing.status ?? null, new: DefectStatus.Open as string }] : []),
          ].filter((c) => JSON.stringify(c.old) !== JSON.stringify(c.new));
          if (changes.length > 0) {
            logFieldAudit('defects', existingId, currentJobId, companyId, userId || null, changes);
          }
          useDefectsStore.getState().loadDefects(currentJobId);
        }
      }

      // ── Update in-memory state ─────────────────────────────
      // Set in-memory photos to exactly what is currently in SQLite after reconciliation.
      // This is critical: using an additive merge (old + new) means deleted photos
      // remain in memory and get passed back into the modal the next time it opens,
      // causing them to be re-saved as if the user kept them.
      const finalPhotoUris = photos !== undefined
        ? photos  // the modal's desired set IS the final set
        : asset.photos;

      const newAssets = [...assets];
      newAssets[assetIndex] = {
        ...asset,
        result,
        checklist_data: checklistData ?? null,
        is_compliant: isCompliant ?? false,
        defect_reason: defectReason ?? null,
        technician_notes: notes ?? null,
        internal_notes: internalNotes ?? null,
        job_asset_id: jobAssetId,
        photos: finalPhotoUris,
      };

      set({
        assets: newAssets,
        progress: calcProgress(newAssets),
        isSaving: false,
      });

      // Push this device's own change out immediately rather than waiting
      // for the next background sync tick — the other half of making a
      // crew job feel live: this device's writes reach the server fast,
      // and lib/sync.ts's subscribeToJobLive() Realtime channel pushes it
      // straight to other devices' screens.
      syncNow();
    } catch (err: unknown) {
      set({ error: errorMessage(err), isSaving: false });
    }
  },

  addPhotoToAsset: (assetId, photoUri) => {
    const { assets, currentJobId } = get();
    if (!currentJobId) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.warn('[InspectionStore] addPhotoToAsset: no authenticated user — skipping');
      return;
    }

    // FIX: photos taken from the asset's own Photos section are
    // deliberately never linked to a defect (defect_id stays null) — they
    // belong to the asset generally, shown once in the asset's own Photos
    // section and once in the PDF's asset-level photo row, not duplicated
    // or reassigned under whichever defect happens to exist.
    usePhotosStore.getState().addPhoto({
      job_id: currentJobId,
      company_id: useAuthStore.getState().user?.company_id ?? null,
      asset_id: assetId,
      defect_id: null,
      photo_url: photoUri,
      local_uri: (photoUri.startsWith('file://') || photoUri.startsWith('content://')) ? photoUri : null,
      caption: null,
      uploaded_by: userId,
    });

    const newAssets = assets.map(a =>
      a.id === assetId ? { ...a, photos: [...a.photos, photoUri] } : a
    );
    set({ assets: newAssets });
  },

  removePhotoFromAsset: (assetId, photoUri) => {
    const { assets, currentJobId } = get();
    if (!currentJobId) return;

    const row = queryRecords<{ id: string; photo_url: string; defect_id: string | null }>(
      'inspection_photos', { job_id: currentJobId, asset_id: assetId, photo_url: photoUri },
    )[0];

    if (row) {
      deleteRecord('inspection_photos', row.id);
      recordDeletedPhoto(row.id);
      if (row.photo_url.startsWith('https://')) {
        // FIX: job_id included — see the equivalent fix in updateAssetResult
        // for why (report-generation blocker check's payload substring
        // fallback can't see a Delete once the local row's already gone).
        addToSyncQueue('inspection_photos', row.id, SyncOperation.Delete, {
          id: row.id, photo_url: row.photo_url, job_id: currentJobId,
        });
      } else {
        cancelPendingPhotoUpload(row.id);
      }

      if (row.defect_id) {
        const defect = queryRecords<{ id: string; photos: string | null }>(
          'defects', { id: row.defect_id },
        )[0];
        if (defect) {
          // FIX: deleting a photo of a logged defect left no trace anywhere
          // — same fix as photosStore.ts's deletePhoto, applied to this
          // OTHER standalone photo-removal path (editing a defect's photo
          // set directly, not the separate Job Photos gallery).
          logFieldAudit('defects', defect.id, currentJobId, useAuthStore.getState().user?.company_id ?? null, useAuthStore.getState().user?.id ?? null, [
            { field: '_photo_deleted', old: 'photo attached', new: null },
          ]);
          let defectPhotos: string[] = [];
          try { defectPhotos = defect.photos ? JSON.parse(defect.photos) : []; }
          catch { defectPhotos = []; }
          const updates = { photos: JSON.stringify(defectPhotos.filter(p => p !== photoUri)) };
          updateRecord('defects', defect.id, updates);
          addToSyncQueue('defects', defect.id, SyncOperation.Update, updates);
        }
      }
    }

    const newAssets = assets.map(a =>
      a.id === assetId ? { ...a, photos: a.photos.filter(p => p !== photoUri) } : a
    );
    set({ assets: newAssets });
  },

  isInspectionComplete: () => {
    const { assets } = get();
    const hasActualResult = assets.some(
      a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail
    );
    const allAnswered = assets.length > 0 && assets.every(a => a.result !== null);
    return allAnswered && hasActualResult;
  },

  reset: () => {
    // Full reset — clears all fields to prevent stale data from a previous
    // inspection job from flashing when the user navigates to a new job.
    set({
      assets:       [],
      currentJobId: null,
      isLoading:    false,
      isSaving:     false,
      error:        null,
      progress:     { inspected: 0, total: 0 },
    });
  },
}));
