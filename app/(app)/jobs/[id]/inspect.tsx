import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  Alert, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, FilterPills, Button } from '@/components/ui';
import { InspectionResult, DefectSeverity, AssetStatus, SyncOperation } from '@/constants/Enums';
import { useInspectionStore, AssetWithResult } from '@/store/inspectionStore';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { SkeletonBlock } from '@/components/ui/SkeletonCard';
import { cardShadow } from '@/components/ui/Card';

import ChecklistModal from '@/components/inspections/ChecklistModal';
import { COMPLIANCE_CHECKLISTS, GENERIC_CHECKLIST } from '@/constants/Checklists';
import AssetInspectModal from '@/components/inspections/AssetInspectModal';
import AddAssetModal from '@/components/inspections/AddAssetModal';
import EditAssetModal from '@/components/inspections/EditAssetModal';
import { formatAssetType, getAssetTypeIcon } from '@/utils/assetHelpers';
import { getJobById, upsertRecord, addToSyncQueue, updateRecord, deleteRecord, queryRecords, cancelPendingPhotoUpload, recordDeletedPhoto } from '@/lib/database';
import { generateUUID } from '@/utils/uuid';
import { Asset } from '@/types';
import { useAuthStore } from '@/store/authStore';


function assetIconName(type: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  return getAssetTypeIcon(type);
}

const AssetCard = React.memo(({ asset, index, jobId, onEdit, onClone, onDelete }: {
  asset: AssetWithResult;
  index: number;
  jobId: string;
  onEdit: (asset: AssetWithResult) => void;
  onClone: (asset: AssetWithResult) => void;
  onDelete: (asset: AssetWithResult) => void;
}) => {
  const C = useColors();
  const { updateAssetResult, isSaving } = useInspectionStore();

  const [showFailModal,  setShowFailModal]  = useState(false);
  const [showChecklist,  setShowChecklist]  = useState(false);

  const checklistItems = useMemo(() =>
    COMPLIANCE_CHECKLISTS[asset.asset_type] || GENERIC_CHECKLIST
  , [asset.asset_type]);

  const parsedChecklist = useMemo(() => {
    try { return asset.checklist_data ? JSON.parse(asset.checklist_data) : null; }
    catch { return null; }
  }, [asset.checklist_data]);

  const handleSaveChecklist = (data: Record<string, unknown>, isCompliant: boolean) => {
    setShowChecklist(false);
    if (isCompliant) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateAssetResult(asset.id, InspectionResult.Pass, JSON.stringify(data), true, undefined, asset.technician_notes || '');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowFailModal(true);
    }
  };

  const handleResult = (res: InspectionResult) => {
    if (res === InspectionResult.Pass) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, asset.is_compliant ?? true, undefined, asset.technician_notes || '');
    } else if (res === InspectionResult.Fail) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowFailModal(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateAssetResult(asset.id, res, asset.checklist_data ?? undefined, true, undefined, asset.technician_notes || '');
    }
  };

  const handleSaveFail = (
    reason: string,
    notes: string,
    photos: string[],
    severity?: DefectSeverity,
    defectCode?: string | null,
    quotePrice?: number | null,
  ) => {
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, reason, notes, photos, severity, defectCode, quotePrice);
    setShowFailModal(false);
  };

  const result = asset.result;
  const isPassed  = result === InspectionResult.Pass;
  const isFailed  = result === InspectionResult.Fail;
  const isNT      = result === InspectionResult.NotTested;

  const cardAccentColor = isPassed ? C.success : isFailed ? C.error : isNT ? C.textTertiary : C.border;
  const cardBg = isPassed ? C.successLight : isFailed ? C.errorLight : C.surface;

  return (
    <Animated.View entering={index < 12 ? FadeInDown.delay(index * 40).duration(300) : undefined} style={s.cardWrapper}>
      <View style={[s.assetCard, { backgroundColor: cardBg, borderColor: cardAccentColor }, cardShadow]}>
        <View style={s.cardInner}>
          <View style={s.cardHeader}>
            <View style={[s.assetIconWrap, {
              backgroundColor: isPassed ? C.success + '20' : isFailed ? C.error + '20' : C.backgroundTertiary,
            }]}>
              <MaterialCommunityIcons
                name={assetIconName(asset.asset_type)} size={22}
                color={isPassed ? C.success : isFailed ? C.error : C.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.assetType, { color: C.text }]} numberOfLines={1}>{formatAssetType(asset.asset_type)}</Text>
              {asset.variant ? <Text style={[s.assetVariant, { color: C.textSecondary }]} numberOfLines={1}>{asset.variant}</Text> : null}
              <Text style={[s.assetLocation, { color: C.textSecondary }]} numberOfLines={1}>{asset.location_on_site || 'Location not specified'}</Text>
              {asset.asset_ref ? <Text style={[s.assetSerial, { color: C.textTertiary }]}>Ref: {asset.asset_ref}</Text>
                : asset.serial_number ? <Text style={[s.assetSerial, { color: C.textTertiary }]}>S/N: {asset.serial_number}</Text> : null}
            </View>
            <View style={[s.cardHeaderRight, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              {asset.photos && asset.photos.length > 0 && (
                <View style={[s.photoBadge, { backgroundColor: C.accent }]}>
                  <MaterialCommunityIcons name="camera" size={10} color={C.textOnPrimary} />
                  <Text style={[s.photoBadgeTxt, { color: C.textOnPrimary }]}>{asset.photos.length}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => onClone(asset)} hitSlop={8}>
                <MaterialCommunityIcons name="content-copy" size={18} color={C.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onEdit(asset)} hitSlop={8}>
                <MaterialCommunityIcons name="pencil" size={18} color={C.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(asset)} hitSlop={8}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.error} />
              </TouchableOpacity>
            </View>
          </View>

          {asset.previousResult ? (
            <View style={[s.prevResultRow, { backgroundColor: C.backgroundTertiary }]}>
              <MaterialCommunityIcons name="history" size={12} color={C.textTertiary} />
              <Text style={[s.prevResultTxt, { color: C.textTertiary }]}>
                Last inspection:{' '}
                <Text style={{
                  fontWeight: '700',
                  color: asset.previousResult === InspectionResult.Pass ? C.success
                       : asset.previousResult === InspectionResult.Fail ? C.error : C.textTertiary,
                }}>
                  {asset.previousResult === InspectionResult.Pass ? 'Pass' : asset.previousResult === InspectionResult.Fail ? 'Fail' : 'Not Tested'}
                </Text>
                {asset.previousDate ? `  ·  ${asset.previousDate}` : ''}
              </Text>
            </View>
          ) : (
            <View style={[s.prevResultRow, { backgroundColor: C.backgroundTertiary }]}>
              <MaterialCommunityIcons name="star-outline" size={12} color={C.textTertiary} />
              <Text style={[s.prevResultTxt, { color: C.textTertiary, fontStyle: 'italic' }]}>First inspection</Text>
            </View>
          )}

          {isFailed && Boolean(asset.defect_reason) && (
            <Animated.View entering={FadeIn.duration(300)} style={[s.defectNotice, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <MaterialCommunityIcons name="alert-circle" size={15} color={C.errorDark} />
              <View style={{ flex: 1 }}>
                <Text style={[s.defectNoticeTitle, { color: C.errorDark }]}>Defect Logged</Text>
                <Text style={[s.defectNoticeBody, { color: C.error }]}>{asset.defect_reason}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFailModal(true)} hitSlop={8}>
                <Text style={[s.defectEditTxt, { color: C.errorDark }]}>Edit</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* BUG-N7 FIX: Disable all result buttons while a save is in flight to prevent
              rapid-tap duplicates from creating two job_assets rows for the same asset. */}
          <View style={[s.resultBtnRow, { opacity: isSaving ? 0.5 : 1 }]}>
            <TouchableOpacity
              style={[s.resultBtn, isPassed ? { backgroundColor: C.success, borderColor: C.success } : { backgroundColor: C.successLight, borderColor: C.success }]}
              onPress={() => !isSaving && handleResult(InspectionResult.Pass)}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <MaterialCommunityIcons name="check-circle" size={16} color={isPassed ? C.textOnPrimary : C.success} />
              <Text style={[s.resultBtnTxt, { color: isPassed ? C.textOnPrimary : C.success }]}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.resultBtn, isFailed ? { backgroundColor: C.error, borderColor: C.error } : { backgroundColor: C.errorLight, borderColor: C.error }]}
              onPress={() => !isSaving && handleResult(InspectionResult.Fail)}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <MaterialCommunityIcons name="close-circle" size={16} color={isFailed ? C.textOnPrimary : C.error} />
              <Text style={[s.resultBtnTxt, { color: isFailed ? C.textOnPrimary : C.error }]}>Fail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.resultBtn, isNT ? { backgroundColor: C.textSecondary, borderColor: C.textSecondary } : { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
              onPress={() => !isSaving && handleResult(InspectionResult.NotTested)}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <MaterialCommunityIcons name="minus-circle-outline" size={16} color={isNT ? C.textOnPrimary : C.textSecondary} />
              <Text style={[s.resultBtnTxt, { color: isNT ? C.textOnPrimary : C.textSecondary }]}>N/T</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.checklistBtn, asset.checklist_data ? { backgroundColor: C.successLight, borderColor: C.success } : { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
            onPress={() => setShowChecklist(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name={asset.checklist_data ? 'clipboard-check' : 'clipboard-check-outline'} size={16} color={asset.checklist_data ? C.successDark : C.textSecondary} />
            <Text style={[s.checklistBtnTxt, { color: asset.checklist_data ? C.successDark : C.textSecondary }]}>
              {asset.checklist_data ? 'Checklist Complete' : 'Run Compliance Checklist'}
            </Text>
            {!asset.checklist_data && <MaterialCommunityIcons name="chevron-right" size={14} color={C.textTertiary} />}
          </TouchableOpacity>
        </View>
      </View>

      <ChecklistModal
        visible={showChecklist}
        assetType={asset.asset_type}
        items={checklistItems}
        initialData={parsedChecklist}
        onSave={handleSaveChecklist}
        onCancel={() => setShowChecklist(false)}
      />
      <AssetInspectModal
        visible={showFailModal}
        asset={asset}
        jobId={jobId as string}
        onClose={() => setShowFailModal(false)}
        onSaveFail={handleSaveFail}
      />
    </Animated.View>
  );
});
AssetCard.displayName = 'AssetCard';

export default function AssetInspectionScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useInspectionStore();

  const [filter, setFilter] = useState<string>('All');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetWithResult | null>(null);
  const [propertyId, setPropertyId]  = useState<string>('');
  const [jobTitle, setJobTitle]    = useState<string>('');
  const [jobDate, setJobDate]     = useState<string>('');

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (jobId) {
      const job = getJobById<{ property_id: string; property_name: string | null; scheduled_date: string }>(jobId);
      if (job) {
        setPropertyId(job.property_id);
        setJobTitle(job.property_name ?? '');
        setJobDate(job.scheduled_date ?? '');
      }
    }
  }, [jobId]);

  const allDone = store.progress.total > 0 && store.progress.inspected === store.progress.total;
  const hasActualResults = store.assets.some(a => a.result === InspectionResult.Pass || a.result === InspectionResult.Fail);

  // Single-pass reduce instead of 4 separate .filter() calls — O(n) vs O(4n)
  const counts = useMemo(() => {
    const acc = { passed: 0, failed: 0, nt: 0, remaining: 0 };
    for (const a of store.assets) {
      if      (a.result === InspectionResult.Pass)      acc.passed++;
      else if (a.result === InspectionResult.Fail)      acc.failed++;
      else if (a.result === InspectionResult.NotTested) acc.nt++;
      else                                              acc.remaining++;
    }
    return acc;
  }, [store.assets]);

  useEffect(() => {
    if (jobId) store.loadAssetsForInspection(jobId);
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const filteredAssets = useMemo(() => {
    switch (filter) {
      case 'Passed':    return store.assets.filter(a => a.result === InspectionResult.Pass);
      case 'Failed':    return store.assets.filter(a => a.result === InspectionResult.Fail);
      case 'N/T':       return store.assets.filter(a => a.result === InspectionResult.NotTested);
      case 'Remaining': return store.assets.filter(a => a.result === null);
      default:          return store.assets;
    }
  }, [store.assets, filter]);

  // Decision #2: mark all uninspected assets as not_tested before completing.
  // This runs synchronously before navigation — the store's updateAssetResult
  // writes to SQLite + queues sync for each asset.
  const markUninspectedAsNotTested = useCallback(() => {
    for (const asset of store.assets) {
      if (asset.result === null) {
        store.updateAssetResult(asset.id, InspectionResult.NotTested);
      }
    }
  }, [store]);

  const handleComplete = () => {
    if (!store.isInspectionComplete()) {
      Alert.alert(
        'Incomplete Inspection',
        `${store.progress.total - store.progress.inspected} asset${
          store.progress.total - store.progress.inspected !== 1 ? 's have' : ' has'
        } not been inspected.\n\nUninspected assets will be automatically marked as Not Tested.\n\nComplete anyway?`,
        [
          { text: 'Continue Inspecting', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: () => {
              markUninspectedAsNotTested();
              router.replace(`/jobs/${jobId}/report` as never);
            },
          },
        ]
      );
    } else {
      router.replace(`/jobs/${jobId}/report` as never);
    }
  };

  const handleClone = useCallback((assetToClone: AssetWithResult) => {
    try {
      const newId = generateUUID();
      const now = new Date().toISOString();
      // FIX: Add company_id to the cloned payload so the sync queue INSERT
      // passes Supabase RLS (all asset rows must belong to a company).
      const companyId = useAuthStore.getState().user?.company_id ?? null;
      const payload = {
        id: newId,
        property_id: assetToClone.property_id,
        company_id: companyId,
        asset_type: assetToClone.asset_type,
        variant: assetToClone.variant,
        asset_ref: null,
        description: assetToClone.description,
        location_on_site: assetToClone.location_on_site,
        serial_number: null,
        barcode_id: null,
        install_date: assetToClone.install_date,
        last_service_date: null,
        next_service_date: null,
        status: AssetStatus.Active,
        created_at: now,
      };

      upsertRecord('assets', payload);
      addToSyncQueue('assets', newId, SyncOperation.Insert, payload);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Asset cloned' });
      
      if (jobId) store.loadAssetsForInspection(jobId);
    } catch (err) {
      console.error('Failed to clone asset:', err);
      Toast.show({ type: 'error', text1: 'Failed to clone asset' });
    }
  }, [jobId, store]);

  const handleDelete = useCallback((assetToDelete: AssetWithResult) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete this ${formatAssetType(assetToDelete.asset_type)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              // BUG-N5 FIX: Clean up ALL related rows before soft-deleting the asset.
              // Without this, the deleted asset's inspection result + photos still appear
              // in getAssetsWithJobResults (LEFT JOIN on job_assets) and in the PDF.

              // 1. Cancel/delete all inspection_photos for this asset in this job
              if (jobId) {
                const assetPhotos = queryRecords<{ id: string; photo_url: string }>(
                  'inspection_photos', { job_id: jobId, asset_id: assetToDelete.id }
                );
                for (const p of assetPhotos) {
                  deleteRecord('inspection_photos', p.id);
                  recordDeletedPhoto(p.id);
                  if (p.photo_url.startsWith('https://')) {
                    addToSyncQueue('inspection_photos', p.id, SyncOperation.Delete, {
                      id: p.id, photo_url: p.photo_url,
                    });
                  } else {
                    cancelPendingPhotoUpload(p.id);
                  }
                }

                // 2. Delete the job_asset (inspection result) row for this asset
                const jobAssetRows = queryRecords<{ id: string }>(
                  'job_assets', { job_id: jobId, asset_id: assetToDelete.id }
                );
                for (const ja of jobAssetRows) {
                  deleteRecord('job_assets', ja.id);
                  addToSyncQueue('job_assets', ja.id, SyncOperation.Delete, { id: ja.id });
                }
              }

              // 3. Soft-delete the asset by setting status = decommissioned
              const payload = { status: AssetStatus.Decommissioned };
              updateRecord('assets', assetToDelete.id, payload);
              addToSyncQueue('assets', assetToDelete.id, SyncOperation.Update, payload);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.show({ type: 'success', text1: 'Asset deleted' });

              if (jobId) store.loadAssetsForInspection(jobId);
            } catch (err) {
              console.error('Failed to delete asset:', err);
              Toast.show({ type: 'error', text1: 'Failed to delete asset' });
            }
          }
        }
      ]
    );
  }, [jobId, store]);

  const renderItem = useCallback(({ item, index }: { item: AssetWithResult; index: number }) => (
    <AssetCard asset={item} index={index} jobId={jobId as string} onEdit={setEditingAsset} onClone={handleClone} onDelete={handleDelete} />
  ), [jobId, handleClone, handleDelete]);

  const fillPct = store.progress.total > 0 ? (store.progress.inspected / store.progress.total) * 100 : 0;

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Asset Inspection" showBack={true} />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (store.error) {
    return (
      <View style={[s.screen, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="alert" size={40} color={C.error} />
        <Text style={{ marginTop: 10, color: C.error, textAlign: 'center', paddingHorizontal: 32 }}>{store.error}</Text>
        <View style={{ marginTop: 16 }}><Button title="Go Back" onPress={() => router.back()} /></View>
      </View>
    );
  }

  const filterOptions = [
    { label: 'All',       count: store.assets.length },
    { label: 'Remaining', count: counts.remaining },
    { label: 'Passed',    count: counts.passed },
    { label: 'Failed',    count: counts.failed },
    { label: 'N/T',       count: counts.nt },
  ];

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="FIRE SAFETY COMPLIANCE"
        title="Inspection Form"
        showBack={true}
        rightComponent={
          <View style={[s.progressBadge, { backgroundColor: allDone ? C.successLight : C.backgroundTertiary, borderColor: allDone ? C.success : C.border, borderWidth: 1 }]}>
            <Text style={[s.progressBadgeTxt, { color: allDone ? C.success : C.textSecondary }]}>
              {allDone ? 'All Done ' : ''}{store.progress.inspected}/{store.progress.total}
            </Text>
          </View>
        }
      />

      <FlatList
        ref={listRef}
        data={filteredAssets}
        keyExtractor={i => i.id}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={8}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[s.overviewCard, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}>
                {Boolean(jobTitle || jobDate) && (
                  <View style={[s.formInfoBar, { borderBottomColor: C.border }]}>
                    <View style={s.formInfoItem}>
                      <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>PROPERTY</Text>
                      <Text style={[s.formInfoValue, { color: C.text }]} numberOfLines={1}>{jobTitle || '—'}</Text>
                    </View>
                    <View style={[s.formInfoDivider, { backgroundColor: C.border }]} />
                    <View style={s.formInfoItem}>
                      <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>DATE</Text>
                      <Text style={[s.formInfoValue, { color: C.text }]}>
                        {jobDate ? new Date(jobDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary }]}>
                  <Animated.View style={[s.progressFill, { backgroundColor: allDone ? C.success : C.primary, width: `${fillPct}%` as `${number}%` }]} />
                </View>
                {store.assets.length > 0 && (
                  <View style={s.summaryBar}>
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.success }]} /><Text style={[s.summaryCount, { color: C.success }]}>{counts.passed}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Passed</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.error }]} /><Text style={[s.summaryCount, { color: C.error }]}>{counts.failed}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Failed</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.textTertiary }]} /><Text style={[s.summaryCount, { color: C.textTertiary }]}>{counts.nt}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>N/T</Text></View>
                    <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
                    <View style={s.summaryItem}><View style={[s.summaryDot, { backgroundColor: C.primary }]} /><Text style={[s.summaryCount, { color: C.primary }]}>{counts.remaining}</Text><Text style={[s.summaryLabel, { color: C.textTertiary }]}>Remaining</Text></View>
                  </View>
                )}
              </View>
            </View>
            <View style={s.filterWrap}>
              <FilterPills options={filterOptions} activeIndex={filterOptions.findIndex(o => o.label === filter)} onSelect={(idx) => setFilter(filterOptions[idx].label)} variant="dark" />
            </View>
          </View>
        }
        ListEmptyComponent={
          store.assets.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIconWrap, { backgroundColor: C.backgroundTertiary }]}><MaterialCommunityIcons name="shield-search" size={40} color={C.textTertiary} /></View>
              <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>No fire safety assets are on record for this property.</Text>
              <View style={{ marginTop: 24, width: '100%', paddingHorizontal: 32, gap: 12 }}>
                <Button title="Add Asset On-Site" icon="plus" onPress={() => setShowAddAsset(true)} style={{ borderRadius: 14 }} />
                <Button variant="secondary" title="Go Back" onPress={() => router.back()} />
              </View>
            </View>
          ) : (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="check-circle-outline" size={40} color={C.success} />
              <Text style={[s.emptyTitle, { color: C.text }]}>All Clear</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>No assets match this filter.</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />

      {store.assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border, shadowColor: C.shadow }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomBarTitle, { color: C.text }]}>{allDone ? (hasActualResults ? 'All assets inspected' : 'All assets marked (N/T)') : `${counts.remaining} remaining`}</Text>
            <Text style={[s.bottomBarSub, { color: C.textSecondary }]}>{store.progress.inspected} of {store.progress.total} inspected</Text>
          </View>
          <Button title={allDone ? 'Complete' : 'Complete Inspection'} disabled={store.progress.inspected === 0} onPress={handleComplete} style={{ minWidth: 140, borderRadius: 22, height: 46 }} />
        </View>
      )}

      {store.assets.length > 0 && (
        <TouchableOpacity style={[s.addAssetFab, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]} onPress={() => setShowAddAsset(true)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus" size={18} color={C.primary} />
          <Text style={[s.addAssetFabTxt, { color: C.primary }]}>Add Asset</Text>
        </TouchableOpacity>
      )}

      <AddAssetModal
        visible={showAddAsset}
        propertyId={propertyId}
        onClose={() => setShowAddAsset(false)}
        onAssetAdded={(newAssets: Asset[]) => {
          setShowAddAsset(false);
          if (jobId) store.loadAssetsForInspection(jobId);
          Toast.show({ type: 'success', text1: 'Asset added', text2: `${newAssets.length} asset(s) registered.` });
        }}
      />
      <EditAssetModal
        visible={!!editingAsset}
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onAssetEdited={() => {
          setEditingAsset(null);
          if (jobId) store.loadAssetsForInspection(jobId);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  overviewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  progressTrack: { height: 6, width: '100%' },
  progressFill:  { height: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  progressBadge:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progressBadgeTxt: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  summaryBar:     { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16 },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 2 },
  summaryDot:     { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  summaryCount:   { fontSize: 18, fontWeight: '800' },
  summaryLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
  summaryDivider: { width: 1, height: 32, alignSelf: 'center', marginHorizontal: 4 },
  formInfoBar:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  formInfoItem:    { flex: 1 },
  formInfoLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, textTransform: 'uppercase' },
  formInfoValue:   { fontSize: 14, fontWeight: '700' },
  formInfoDivider: { width: 1, marginHorizontal: 16, alignSelf: 'stretch' },
  filterWrap: { paddingVertical: 10, paddingHorizontal: 16 },
  cardWrapper: { marginHorizontal: 16, marginBottom: 14 },
  assetCard:   { borderRadius: 16, borderWidth: 1 },
  cardInner:   { padding: 18 },
  cardHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  assetIconWrap:   { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  assetType:       { fontSize: 16, fontWeight: '800', marginBottom: 2, letterSpacing: -0.2 },
  assetVariant:    { fontSize: 13, fontWeight: '600', marginTop: 1, opacity: 0.85 },
  assetLocation:   { fontSize: 13, marginTop: 2 },
  assetSerial:     { fontSize: 12, fontFamily: 'monospace', marginTop: 4, opacity: 0.7 },
  cardHeaderRight: { alignItems: 'flex-end', gap: 6 },
  photoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  photoBadgeTxt:   { fontSize: 10, fontWeight: '700' },
  prevResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10 },
  prevResultTxt: { fontSize: 12, flex: 1 },
  defectNotice:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  defectNoticeTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2, textTransform: 'uppercase' },
  defectNoticeBody:  { fontSize: 13, fontWeight: '500', marginTop: 1 },
  defectEditTxt:     { fontSize: 12, fontWeight: '700' },
  resultBtnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  resultBtn:    { flex: 1, height: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
  resultBtnTxt: { fontSize: 14, fontWeight: '700' },
  checklistBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: 14, borderWidth: 1, marginTop: 12 },
  checklistBtnTxt: { fontSize: 14, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16, borderTopWidth: 1, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  bottomBarTitle: { fontSize: 14, fontWeight: '700' },
  bottomBarSub:   { fontSize: 12, marginTop: 1 },
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  addAssetFab:    { position: 'absolute', bottom: Platform.OS === 'ios' ? 120 : 100, right: 16, width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addAssetFabTxt: { display: 'none' },
});
