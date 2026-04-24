import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  Alert, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, FilterPills, Button } from '@/components/ui';
import { InspectionResult, DefectSeverity } from '@/constants/Enums';
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
import { formatAssetType, getAssetTypeIcon } from '@/utils/assetHelpers';
import { getJobById } from '@/lib/database';

// ─── Asset row type icon — delegates to centralised AssetData lookup ──────────
function assetIconName(type: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  return getAssetTypeIcon(type);
}

// ─── Individual asset card ────────────────────────────────────
const AssetCard = React.memo(({ asset, index }: {
  asset: AssetWithResult;
  index: number;
}) => {
  const C = useColors();
  const { updateAssetResult } = useInspectionStore();

  const [showFailModal,  setShowFailModal]  = useState(false);
  const [showChecklist,  setShowChecklist]  = useState(false);

  const checklistItems = useMemo(() =>
    COMPLIANCE_CHECKLISTS[asset.asset_type] || GENERIC_CHECKLIST
  , [asset.asset_type]);

  const parsedChecklist = useMemo(() => {
    try { return asset.checklist_data ? JSON.parse(asset.checklist_data) : null; }
    catch { return null; }
  }, [asset.checklist_data]);

  const handleSaveChecklist = (data: any, isCompliant: boolean) => {
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

  const handleSaveFail = (reason: string, notes: string, photos: string[], severity?: DefectSeverity) => {
    // BUG 4 FIX: pass photos[] and severity through to the store so they're persisted
    updateAssetResult(asset.id, InspectionResult.Fail, asset.checklist_data ?? undefined, false, reason, notes, photos, severity);
    setShowFailModal(false);
  };

  // Derive status styling
  const result = asset.result;
  const isPassed  = result === InspectionResult.Pass;
  const isFailed  = result === InspectionResult.Fail;
  const isNT      = result === InspectionResult.NotTested;

  const cardAccentColor = isPassed
    ? C.success
    : isFailed
    ? C.error
    : isNT
    ? C.textTertiary
    : C.border;

  const cardBg = isPassed
    ? C.successLight
    : isFailed
    ? C.errorLight
    : C.surface;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)} style={s.cardWrapper}>
      <View style={[s.assetCard, { backgroundColor: cardBg, borderColor: cardAccentColor }]}>

        {/* ── RESULT STRIPE ──────────────────────────── */}
        <View style={[s.resultStripe, { backgroundColor: cardAccentColor }]} />

        <View style={s.cardInner}>
          {/* ── CARD HEADER ─────────────────────────────── */}
          <View style={s.cardHeader}>
            {/* Asset icon */}
            <View style={[s.assetIconWrap, {
              backgroundColor: isPassed
                ? C.success + '20'
                : isFailed
                ? C.error + '20'
                : C.backgroundTertiary,
            }]}>
              <MaterialCommunityIcons
                name={assetIconName(asset.asset_type)}
                size={22}
                color={isPassed ? C.success : isFailed ? C.error : C.primary}
              />
            </View>

            {/* Asset info */}
            <View style={{ flex: 1 }}>
              <Text style={[s.assetType, { color: C.text }]} numberOfLines={1}>
                {formatAssetType(asset.asset_type)}
              </Text>
              {asset.variant ? (
                <Text style={[s.assetVariant, { color: C.textSecondary }]} numberOfLines={1}>
                  {asset.variant}
                </Text>
              ) : null}
              <Text style={[s.assetLocation, { color: C.textSecondary }]} numberOfLines={1}>
                {asset.location_on_site || 'Location not specified'}
              </Text>
              {asset.asset_ref ? (
                <Text style={[s.assetSerial, { color: C.textTertiary }]}>Ref: {asset.asset_ref}</Text>
              ) : asset.serial_number ? (
                <Text style={[s.assetSerial, { color: C.textTertiary }]}>S/N: {asset.serial_number}</Text>
              ) : null}
            </View>


            {/* Right actions cluster */}
            <View style={s.cardHeaderRight}>

              {/* Photo count badge */}
              {asset.photos && asset.photos.length > 0 && (
                <View style={[s.photoBadge, { backgroundColor: C.accent }]}>
                  <MaterialCommunityIcons name="camera" size={10} color="#FFF" />
                  <Text style={s.photoBadgeTxt}>{asset.photos.length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── PREVIOUS RESULT ──────────────────────── */}
          {asset.previousResult ? (
            <View style={[s.prevResultRow, { backgroundColor: C.backgroundTertiary }]}>
              <MaterialCommunityIcons
                name="history"
                size={12}
                color={C.textTertiary}
              />
              <Text style={[s.prevResultTxt, { color: C.textTertiary }]}>
                Last inspection:{' '}
                <Text style={{
                  fontWeight: '700',
                  color: asset.previousResult === InspectionResult.Pass ? C.success
                       : asset.previousResult === InspectionResult.Fail ? C.error
                       : C.textTertiary,
                }}>
                  {asset.previousResult === InspectionResult.Pass ? 'Pass ✓'
                   : asset.previousResult === InspectionResult.Fail ? 'Fail ✗'
                   : 'Not Tested'}
                </Text>
                {asset.previousDate ? `  ·  ${asset.previousDate}` : ''}
              </Text>
            </View>
          ) : (
            <View style={[s.prevResultRow, { backgroundColor: C.backgroundTertiary }]}>
              <MaterialCommunityIcons name="star-outline" size={12} color={C.textTertiary} />
              <Text style={[s.prevResultTxt, { color: C.textTertiary, fontStyle: 'italic' }]}>
                First inspection
              </Text>
            </View>
          )}

          {/* ── DEFECT NOTICE (if failed) ──────────── */}
          {isFailed && asset.defect_reason && (
            <Animated.View entering={FadeIn.duration(300)} style={[s.defectNotice, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <MaterialCommunityIcons name="alert-circle" size={15} color={C.errorDark} />
              <View style={{ flex: 1 }}>
                <Text style={[s.defectNoticeTitle, { color: C.errorDark }]}>Defect Logged</Text>
                <Text style={[s.defectNoticeBody, { color: C.error }]}>{asset.defect_reason}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFailModal(true)}
                hitSlop={8}
              >
                <Text style={[s.defectEditTxt, { color: C.errorDark }]}>Edit</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── PASS / FAIL / N/T BUTTONS ─────────── */}
          <View style={s.resultBtnRow}>
            {/* PASS */}
            <TouchableOpacity
              style={[
                s.resultBtn,
                isPassed
                  ? { backgroundColor: C.success, borderColor: C.success }
                  : { backgroundColor: C.successLight, borderColor: C.success },
              ]}
              onPress={() => handleResult(InspectionResult.Pass)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={isPassed ? '#FFF' : C.success}
              />
              <Text style={[s.resultBtnTxt, { color: isPassed ? '#FFF' : C.success }]}>Pass</Text>
            </TouchableOpacity>

            {/* FAIL */}
            <TouchableOpacity
              style={[
                s.resultBtn,
                isFailed
                  ? { backgroundColor: C.error, borderColor: C.error }
                  : { backgroundColor: C.errorLight, borderColor: C.error },
              ]}
              onPress={() => handleResult(InspectionResult.Fail)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={16}
                color={isFailed ? '#FFF' : C.error}
              />
              <Text style={[s.resultBtnTxt, { color: isFailed ? '#FFF' : C.error }]}>Fail</Text>
            </TouchableOpacity>

            {/* N/T */}
            <TouchableOpacity
              style={[
                s.resultBtn,
                isNT
                  ? { backgroundColor: C.textSecondary, borderColor: C.textSecondary }
                  : { backgroundColor: C.backgroundTertiary, borderColor: C.border },
              ]}
              onPress={() => handleResult(InspectionResult.NotTested)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="minus-circle-outline"
                size={16}
                color={isNT ? '#FFF' : C.textSecondary}
              />
              <Text style={[s.resultBtnTxt, { color: isNT ? '#FFF' : C.textSecondary }]}>N/T</Text>
            </TouchableOpacity>
          </View>

          {/* ── CHECKLIST BUTTON ──────────────────── */}
          <TouchableOpacity
            style={[
              s.checklistBtn,
              asset.checklist_data
                ? { backgroundColor: C.successLight, borderColor: C.success }
                : { backgroundColor: C.backgroundTertiary, borderColor: C.border },
            ]}
            onPress={() => setShowChecklist(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={asset.checklist_data ? 'clipboard-check' : 'clipboard-check-outline'}
              size={16}
              color={asset.checklist_data ? C.successDark : C.textSecondary}
            />
            <Text style={[s.checklistBtnTxt, { color: asset.checklist_data ? C.successDark : C.textSecondary }]}>
              {asset.checklist_data ? '✓ Checklist Complete' : 'Run Compliance Checklist'}
            </Text>
            {!asset.checklist_data && (
              <MaterialCommunityIcons name="chevron-right" size={14} color={C.textTertiary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
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
        onClose={() => setShowFailModal(false)}
        onSaveFail={handleSaveFail}
      />
    </Animated.View>
  );
});
AssetCard.displayName = 'AssetCard';

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function AssetInspectionScreen() {
  const C = useColors();
  const navigation = useNavigation();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useInspectionStore();

  const [filter,       setFilter]      = useState<string>('All');

  const [showAddAsset, setShowAddAsset] = useState(false);
  const [propertyId,   setPropertyId]  = useState<string>('');
  const [jobTitle,     setJobTitle]    = useState<string>('');
  const [jobDate,      setJobDate]     = useState<string>('');

  const listRef = useRef<FlatList>(null);

  // Load job info for the form header
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

  const allDone = store.progress.total > 0
    && store.progress.inspected === store.progress.total;

  // Counts per category
  const counts = useMemo(() => ({
    passed:    store.assets.filter(a => a.result === InspectionResult.Pass).length,
    failed:    store.assets.filter(a => a.result === InspectionResult.Fail).length,
    nt:        store.assets.filter(a => a.result === InspectionResult.NotTested).length,
    remaining: store.assets.filter(a => a.result === null).length,
  }), [store.assets]);

  // Hide tab bar
  useFocusEffect(useCallback(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
  }, [navigation]));

  useEffect(() => {
    if (jobId) store.loadAssetsForInspection(jobId);
    // BUG 3 FIX: use soft reset (clears only error/isSaving) — do not wipe assets on unmount
    // so that navigating away mid-inspection doesn't blank the store
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const filteredAssets = useMemo(() => {
    if (!store.assets) return [];
    switch (filter) {
      case 'Passed':    return store.assets.filter(a => a.result === InspectionResult.Pass);
      case 'Failed':    return store.assets.filter(a => a.result === InspectionResult.Fail);
      case 'N/T':       return store.assets.filter(a => a.result === InspectionResult.NotTested);
      case 'Remaining': return store.assets.filter(a => a.result === null);
      default:          return store.assets;
    }
  }, [store.assets, filter]);



  const handleComplete = () => {
    if (!store.isInspectionComplete()) {
      Alert.alert(
        'Incomplete Inspection',
        `${store.progress.total - store.progress.inspected} asset${
          store.progress.total - store.progress.inspected !== 1 ? 's have' : ' has'
        } not been inspected.\n\nComplete anyway?`,
        [
          { text: 'Continue Inspecting', style: 'cancel' },
          {
            text: 'Complete Anyway',
            style: 'destructive',
            // BUG 10 FIX: navigate to report screen, not just router.back()
            onPress: () => {
              store.reset();
              router.replace(`/jobs/${jobId}/report` as never);
            },
          },
        ]
      );
    } else {
      // BUG 10 FIX: route to report screen after successful completion
      store.reset();
      router.replace(`/jobs/${jobId}/report` as never);
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: AssetWithResult; index: number }) => (
      <AssetCard
        asset={item}
        index={index}
      />
    ),
    []
  );

  // Progress percentage
  const fillPct = store.progress.total > 0
    ? (store.progress.inspected / store.progress.total) * 100
    : 0;

  // ── Loading skeleton ───────────────────────────────────────
  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader curved={false} title="Asset Inspection" showBack={true} />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
          <SkeletonBlock width="100%" height={160} borderRadius={16} />
        </View>
      </View>
    );
  }

  // BUG 11 FIX: surface store errors so the technician isn't left with silent failures
  if (store.error) {
    return (
      <View style={[s.screen, { backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={{ marginTop: 10, color: C.error, textAlign: 'center', paddingHorizontal: 32 }}>
          {store.error}
        </Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // Filter pill options
  const filterOptions = [
    { label: 'All',       count: store.assets.length },
    { label: 'Remaining', count: counts.remaining },
    { label: 'Passed',    count: counts.passed },
    { label: 'Failed',    count: counts.failed },
    { label: 'N/T',       count: counts.nt },
  ];

  // Progress badge for header
  const progressBadge = (
    <View style={[s.progressBadge, {
      backgroundColor: allDone ? C.success + '30' : 'rgba(255,255,255,0.2)',
      borderColor: allDone ? C.success : 'transparent',
      borderWidth: allDone ? 1 : 0,
    }]}>
      <Text style={[s.progressBadgeTxt, {
        color: allDone ? C.success : '#FFF',
      }]}>
        {allDone ? '✓ ' : ''}{store.progress.inspected}/{store.progress.total}
      </Text>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <ScreenHeader
        curved={false}
        eyebrow="FIRE SAFETY COMPLIANCE"
        title="Inspection Form"
        showBack={true}
        rightComponent={progressBadge}
      />

      {/* ── FORM INFO BAR ────────────────────────────────── */}
      {(jobTitle || jobDate) && (
        <View style={[s.formInfoBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View style={s.formInfoItem}>
            <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>PROPERTY</Text>
            <Text style={[s.formInfoValue, { color: C.text }]} numberOfLines={1}>
              {jobTitle || '—'}
            </Text>
          </View>
          <View style={[s.formInfoDivider, { backgroundColor: C.border }]} />
          <View style={s.formInfoItem}>
            <Text style={[s.formInfoLabel, { color: C.textTertiary }]}>DATE</Text>
            <Text style={[s.formInfoValue, { color: C.text }]}>
              {jobDate
                ? new Date(jobDate + 'T00:00:00').toLocaleDateString('en-AU', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })
                : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* ── PROGRESS BAR ────────────────────────────────── */}
      <View style={[s.progressTrack, { backgroundColor: C.primary + '40' }]}>
        <Animated.View style={[
          s.progressFill,
          {
            backgroundColor: allDone ? C.success : C.accent,
            width: `${fillPct}%` as `${number}%`,
          },
        ]} />
      </View>

      {/* ── SUMMARY STATS BAR ───────────────────────────── */}
      {store.assets.length > 0 && (
        <View style={[s.summaryBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View style={s.summaryItem}>
            <View style={[s.summaryDot, { backgroundColor: C.success }]} />
            <Text style={[s.summaryCount, { color: C.success }]}>{counts.passed}</Text>
            <Text style={[s.summaryLabel, { color: C.textTertiary }]}>Passed</Text>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
          <View style={s.summaryItem}>
            <View style={[s.summaryDot, { backgroundColor: C.error }]} />
            <Text style={[s.summaryCount, { color: C.error }]}>{counts.failed}</Text>
            <Text style={[s.summaryLabel, { color: C.textTertiary }]}>Failed</Text>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
          <View style={s.summaryItem}>
            <View style={[s.summaryDot, { backgroundColor: C.textTertiary }]} />
            <Text style={[s.summaryCount, { color: C.textTertiary }]}>{counts.nt}</Text>
            <Text style={[s.summaryLabel, { color: C.textTertiary }]}>N/T</Text>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
          <View style={s.summaryItem}>
            <View style={[s.summaryDot, { backgroundColor: C.accent }]} />
            <Text style={[s.summaryCount, { color: C.accent }]}>{counts.remaining}</Text>
            <Text style={[s.summaryLabel, { color: C.textTertiary }]}>Remaining</Text>
          </View>
        </View>
      )}

      {/* ── FILTER PILLS ────────────────────────────────── */}
      <View style={s.filterWrap}>
        <FilterPills
          options={filterOptions}
          activeIndex={filterOptions.findIndex(o => o.label === filter)}
          onSelect={(idx) => setFilter(filterOptions[idx].label)}
          variant="dark"
        />
      </View>

      {/* ── ASSET LIST ──────────────────────────────────── */}
      {store.assets.length === 0 ? (
        <View style={s.emptyState}>
          <View style={[s.emptyIconWrap, { backgroundColor: C.backgroundTertiary }]}>
            <MaterialCommunityIcons name="shield-search" size={40} color={C.textTertiary} />
          </View>
          <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            No fire safety assets are on record for this property.
          </Text>
          <View style={{ marginTop: 24, width: '100%', paddingHorizontal: 32, gap: 12 }}>
            <Button
              title="➕  Add Asset On-Site"
              onPress={() => setShowAddAsset(true)}
              style={{ borderRadius: 14 }}
            />
            <Button variant="outline" title="Go Back" onPress={() => router.back()} />
          </View>
        </View>
      ) : filteredAssets.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>✨</Text>
          <Text style={[s.emptyTitle, { color: C.text }]}>All Clear</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            No assets match this filter.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredAssets}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
          renderItem={renderItem}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={8}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            // Graceful fallback: scroll to approximate position if item is not yet rendered
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      )}

      {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
      {store.assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomBarTitle, { color: C.text }]}>
              {allDone ? '✅ All assets inspected' : `${counts.remaining} remaining`}
            </Text>
            <Text style={[s.bottomBarSub, { color: C.textSecondary }]}>
              {store.progress.inspected} of {store.progress.total} inspected
            </Text>
          </View>
          <Button
            title={allDone ? 'Complete ✓' : 'Complete Inspection'}
            disabled={store.progress.inspected === 0}
            onPress={handleComplete}
            style={{ minWidth: 140, borderRadius: 22, height: 46 }}
          />
        </View>
      )}

      {/* ── ADD ASSET FAB ───────────────────────────────── */}
      {store.assets.length > 0 && (
        <TouchableOpacity
          style={[s.addAssetFab, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]}
          onPress={() => setShowAddAsset(true)}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={18} color={C.primary} />
          <Text style={[s.addAssetFabTxt, { color: C.primary }]}>Add Asset</Text>
        </TouchableOpacity>
      )}

      {/* ── ADD ASSET MODAL ─────────────────────────────── */}
      <AddAssetModal
        visible={showAddAsset}
        propertyId={propertyId}
        onClose={() => setShowAddAsset(false)}
        onAssetAdded={() => {
          setShowAddAsset(false);
          // Reload so the new asset appears in the list immediately
          if (jobId) store.loadAssetsForInspection(jobId);
          Toast.show({ type: 'success', text1: 'Asset added ✓', text2: 'Asset registered and added to this inspection.' });
        }}
      />


    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  // Progress
  progressTrack: { height: 5, width: '100%' },
  progressFill:  { height: 5, borderTopRightRadius: 5, borderBottomRightRadius: 5 },

  // Progress badge in header
  progressBadge:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progressBadgeTxt: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  // Summary bar
  summaryBar:     { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 2 },
  summaryDot:     { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  summaryCount:   { fontSize: 16, fontWeight: '800' },
  summaryLabel:   { fontSize: 10, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' },
  summaryDivider: { width: 1, height: 32, alignSelf: 'center', marginHorizontal: 4 },

  // Form info bar (property + date)
  formInfoBar:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  formInfoItem:    { flex: 1 },
  formInfoLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 3, textTransform: 'uppercase' },
  formInfoValue:   { fontSize: 13, fontWeight: '600' },
  formInfoDivider: { width: 1, marginHorizontal: 16, alignSelf: 'stretch' },

  // Filters
  filterWrap: { paddingVertical: 10, paddingHorizontal: 16 },

  // Asset card
  cardWrapper: { marginHorizontal: 14, marginBottom: 12 },
  assetCard:   { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row' },
  resultStripe:{ width: 5 },
  cardInner:   { flex: 1, padding: 14 },

  // Card header
  cardHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  assetIconWrap:   { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  assetType:       { fontSize: 15, fontWeight: '800', marginBottom: 1 },
  assetVariant:    { fontSize: 12, fontWeight: '600', marginTop: 1, opacity: 0.85 },
  assetLocation:   { fontSize: 12, marginTop: 1 },
  assetSerial:     { fontSize: 11, fontFamily: 'monospace', marginTop: 3, opacity: 0.7 },
  cardHeaderRight: { alignItems: 'flex-end', gap: 6 },

  photoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  photoBadgeTxt:   { fontSize: 10, fontWeight: '700', color: '#FFF' },

  // Previous result strip
  prevResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10 },
  prevResultTxt: { fontSize: 12, flex: 1 },

  // Defect notice
  defectNotice:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  defectNoticeTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2, textTransform: 'uppercase' },
  defectNoticeBody:  { fontSize: 13, fontWeight: '500', marginTop: 1 },
  defectEditTxt:     { fontSize: 12, fontWeight: '700' },

  // Result buttons
  resultBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  resultBtn:    {
    flex: 1, height: 46, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5,
  },
  resultBtnTxt: { fontSize: 14, fontWeight: '700' },

  // Checklist button
  checklistBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, height: 42, borderRadius: 10, borderWidth: 1.5, marginTop: 10,
  },
  checklistBtnTxt: { fontSize: 13, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  bottomBarTitle: { fontSize: 14, fontWeight: '700' },
  bottomBarSub:   { fontSize: 12, marginTop: 1 },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  // Add-asset FAB (pill style, bottom-left corner so it doesn't clash with the Complete button)
  addAssetFab:    {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 120 : 100, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1,
    backgroundColor: '#fff',
  },
  addAssetFabTxt: { fontSize: 13, fontWeight: '700' },


});
