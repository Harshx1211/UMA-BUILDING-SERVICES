/**
 * On-Site Inspection Form — launched from the Property Detail screen.
 * Allows a technician to:
 *   • Mark each asset as Pass / Fail / N/T
 *   • Log a defect reason when failing an asset (inline — no modal needed)
 *   • Add new assets discovered on-site via AddAssetModal
 *   • Complete the inspection — results saved as a job+job_assets record
 */
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  Alert, Modal, TextInput, Platform, BackHandler,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';

import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader, FilterPills, Button } from '@/components/ui';
import { SkeletonBlock } from '@/components/ui/SkeletonCard';
import { InspectionResult, SyncOperation, JobType, JobStatus, Priority, DefectSeverity } from '@/constants/Enums';
import {
  getRecord, getAssetsForProperty, upsertRecord, addToSyncQueue,
} from '@/lib/database';
import type { RecordData } from '@/lib/database';
import type { Property, Asset } from '@/types';
import AddAssetModal from '@/components/inspections/AddAssetModal';

import { generateUUID } from '@/utils/uuid';  // BUG 28 FIX

// ─── Defect quick-suggestion chips per asset type ────────────
const DEFECT_CHIPS: Record<string, string[]> = {
  'fire extinguisher': ['Pressure Low', 'Tag Expired', 'Damaged', 'Missing', 'Obstructed'],
  'sprinkler':         ['Obstructed', 'Damaged', 'Corroded', 'Leaking'],
  'smoke alarm':       ['No Response', 'Battery Low', 'Damaged', 'Dirty'],
  'fire door':         ['Not Self-Closing', 'Damaged', 'Missing Hardware', 'Held Open'],
  'emergency light':   ['Battery Fail', 'Bulb Fail', 'Not Charging'],
  'hose reel':         ['Damaged', 'Hose Perished', 'Missing', 'Valve Stiff'],
};
function getDefectChips(assetType: string): string[] {
  const lower = assetType.toLowerCase();
  const key   = Object.keys(DEFECT_CHIPS).find(k => lower.includes(k));
  return key ? DEFECT_CHIPS[key] : ['Damaged', 'Missing', 'Not Functioning', 'Requires Replacement'];
}

// ─── Per-asset inspection state ──────────────────────────────
type AssetResult = {
  result: InspectionResult | null;
  defectReason: string;
};
function initResult(): AssetResult {
  return { result: null, defectReason: '' };
}

// ─── Asset icon by type ──────────────────────────────────────
function assetIcon(t: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const l = t.toLowerCase();
  if (l.includes('extinguisher')) return 'fire-extinguisher';
  if (l.includes('sprinkler'))    return 'water-outline';
  if (l.includes('door'))         return 'door-open';
  if (l.includes('light'))        return 'lightning-bolt';
  if (l.includes('alarm'))        return 'bell-ring-outline';
  if (l.includes('hose'))         return 'pipe';
  if (l.includes('exit'))         return 'exit-run';
  return 'shield-check-outline';
}

// ═══════════════════════════════════════════════════════════════
// ASSET CARD
// ═══════════════════════════════════════════════════════════════
const AssetInspectCard = React.memo(({
  asset, result, onResult, onDefectChange, index,
}: {
  asset: Asset;
  result: AssetResult;
  onResult: (id: string, r: InspectionResult) => void;
  onDefectChange: (id: string, reason: string) => void;
  index: number;
}) => {
  const C     = useColors();
  const chips = useMemo(() => getDefectChips(asset.asset_type), [asset.asset_type]);

  const isPassed = result.result === InspectionResult.Pass;
  const isFailed = result.result === InspectionResult.Fail;
  const isNT     = result.result === InspectionResult.NotTested;
  const isDone   = result.result !== null;

  const cardBg     = isPassed ? C.successLight + 'CC' : isFailed ? C.errorLight + 'CC' : C.surface;
  const cardBorder = isPassed ? C.success : isFailed ? C.error : isNT ? C.textTertiary : C.border;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)} style={s.cardOuter}>
      <View style={[s.assetCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {/* Left colour stripe */}
        <View style={[s.cardStripe, { backgroundColor: cardBorder }]} />

        <View style={s.cardBody}>
          {/* ── Header row ─────────────────────────────── */}
          <View style={s.cardHeader}>
            <View style={[s.assetIconWrap, {
              backgroundColor: isPassed ? C.success + '20' : isFailed ? C.error + '20' : C.backgroundTertiary,
            }]}>
              <MaterialCommunityIcons
                name={assetIcon(asset.asset_type)}
                size={20}
                color={isPassed ? C.success : isFailed ? C.error : C.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.assetType, { color: C.text }]} numberOfLines={1}>
                {asset.asset_type}
              </Text>
              <Text style={[s.assetLoc, { color: C.textSecondary }]} numberOfLines={1}>
                {asset.location_on_site || 'No location specified'}
              </Text>
              {asset.serial_number
                ? <Text style={[s.assetSerial, { color: C.textTertiary }]}>S/N: {asset.serial_number}</Text>
                : null}
            </View>
            {isDone && (
              <View style={[s.resultDot, {
                backgroundColor: isPassed ? C.success : isNT ? C.textTertiary : C.error,
              }]}>
                <MaterialCommunityIcons
                  name={isPassed ? 'check' : isNT ? 'minus' : 'close'}
                  size={14} color={C.textOnPrimary}
                />
              </View>
            )}
          </View>

          {/* ── Defect section — expands when failed ────── */}
          {isFailed && (
            <Animated.View entering={FadeIn.duration(220)} style={[s.defectSection, { backgroundColor: C.errorLight, borderColor: C.error }]}>
              <Text style={[s.defectTitle, { color: C.errorDark }]}>Defect Description *</Text>
              <View style={s.chipRow}>
                {chips.map(chip => {
                  const active = result.defectReason === chip;
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[s.chip, {
                        backgroundColor: active ? C.error : C.surface,
                        borderColor: active ? C.error : C.border,
                      }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onDefectChange(asset.id, chip);
                      }}
                    >
                      {active && <MaterialCommunityIcons name="check" size={10} color={C.textOnPrimary} />}
                      <Text style={[s.chipTxt, { color: active ? C.textOnPrimary : C.textSecondary }]}>{chip}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[s.defectInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                value={result.defectReason}
                onChangeText={v => onDefectChange(asset.id, v)}
                placeholder="Or describe the defect…"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
              />
            </Animated.View>
          )}

          {/* ── Pass / Fail / N/T buttons ────────────── */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.resultBtn,
                isPassed
                  ? { backgroundColor: C.success, borderColor: C.success }
                  : { backgroundColor: C.successLight, borderColor: C.success }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onResult(asset.id, InspectionResult.Pass);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check-circle" size={15} color={isPassed ? C.textOnPrimary : C.success} />
              <Text style={[s.btnTxt, { color: isPassed ? C.textOnPrimary : C.success }]}>Pass</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.resultBtn,
                isFailed
                  ? { backgroundColor: C.error, borderColor: C.error }
                  : { backgroundColor: C.errorLight, borderColor: C.error }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onResult(asset.id, InspectionResult.Fail);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close-circle" size={15} color={isFailed ? C.textOnPrimary : C.error} />
              <Text style={[s.btnTxt, { color: isFailed ? C.textOnPrimary : C.error }]}>Fail</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.resultBtn,
                isNT
                  ? { backgroundColor: C.textSecondary, borderColor: C.textSecondary }
                  : { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onResult(asset.id, InspectionResult.NotTested);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="minus-circle-outline" size={15} color={isNT ? C.textOnPrimary : C.textSecondary} />
              <Text style={[s.btnTxt, { color: isNT ? C.textOnPrimary : C.textSecondary }]}>N/T</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});
AssetInspectCard.displayName = 'AssetInspectCard';

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function SiteInspectScreen() {
  const C          = useColors();
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const { user }   = useAuth();

  const [property,      setProperty]      = useState<Property | null>(null);
  const [assets,        setAssets]        = useState<Asset[]>([]);
  const [results,       setResults]       = useState<Record<string, AssetResult>>({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [isSaving,      setIsSaving]      = useState(false);
  const [filter,        setFilter]        = useState('All');
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showComplete,  setShowComplete]  = useState(false);
  const listRef = useRef<FlatList>(null);

  // Hide tab bar while

  // ── Load property + assets ────────────────────────────────
  const load = useCallback(() => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const p = getRecord<Property>('properties', propertyId);
      setProperty(p);
      if (p) {
        const a = getAssetsForProperty<Asset>(propertyId);
        setAssets(a);
        const init: Record<string, AssetResult> = {};
        a.forEach(asset => { init[asset.id] = initResult(); });
        setResults(init);
      }
    } catch (e) {
      console.error('[SiteInspect] load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  // ── Decision #1: Back-press guard ───────────────────────
  // If any asset has been inspected, intercept Android back and the
  // navigation header back-button, and offer Save or Discard.
  const hasProgress = useMemo(
    () => Object.values(results).some(r => r.result !== null),
    [results]
  );

  const handleBackPress = useCallback(() => {
    if (!hasProgress) return false; // let navigation proceed normally
    Alert.alert(
      'Save Progress?',
      'You have inspected some assets. What would you like to do?',
      [
        {
          text: 'Keep Inspecting',
          style: 'cancel',
        },
        {
          text: 'Discard & Exit',
          style: 'destructive',
          onPress: () => router.back(),
        },
        {
          text: 'Save & Exit',
          onPress: () => {
            void saveInspection().then(() => router.back()).catch(() => router.back());
          },
        },
      ],
      { cancelable: false }
    );
    return true;
  }, [hasProgress, saveInspection]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);


  // ── Result handlers ──────────────────────────────────────
  const handleResult = useCallback((assetId: string, r: InspectionResult) => {
    setResults(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        result: r,
        defectReason: r !== InspectionResult.Fail ? '' : prev[assetId]?.defectReason ?? '',
      },
    }));
  }, []);

  const handleDefectChange = useCallback((assetId: string, reason: string) => {
    setResults(prev => ({ ...prev, [assetId]: { ...prev[assetId], defectReason: reason } }));
  }, []);

  // ── Add asset ────────────────────────────────────────────
  const handleAssetAdded = useCallback((newAssets: Asset[]) => {
    setAssets(prev => [...prev, ...newAssets]);
    setResults(prev => {
      const next = { ...prev };
      newAssets.forEach(a => { next[a.id] = initResult(); });
      return next;
    });
    Toast.show({
      type: 'success',
      text1: `${newAssets.length} Asset${newAssets.length > 1 ? 's' : ''} Added`,
      text2: 'Asset registered and ready to inspect.',
    });
  }, []);

  // ── Derived counts ───────────────────────────────────────
  const counts = useMemo(() => {
    const vals = Object.values(results);
    return {
      passed:    vals.filter(r => r.result === InspectionResult.Pass).length,
      failed:    vals.filter(r => r.result === InspectionResult.Fail).length,
      nt:        vals.filter(r => r.result === InspectionResult.NotTested).length,
      remaining: vals.filter(r => r.result === null).length,
      inspected: vals.filter(r => r.result !== null).length,
      total:     assets.length,
    };
  }, [results, assets]);

  const fillPct = counts.total > 0 ? (counts.inspected / counts.total) * 100 : 0;
  const allDone = counts.remaining === 0 && counts.total > 0;

  // ── Filtered list ────────────────────────────────────────
  const filtered = useMemo(() => {
    switch (filter) {
      case 'Passed':    return assets.filter(a => results[a.id]?.result === InspectionResult.Pass);
      case 'Failed':    return assets.filter(a => results[a.id]?.result === InspectionResult.Fail);
      case 'N/T':       return assets.filter(a => results[a.id]?.result === InspectionResult.NotTested);
      case 'Remaining': return assets.filter(a => !results[a.id] || results[a.id].result === null);
      default:          return assets;
    }
  }, [assets, results, filter]);

  // ── Complete & save ──────────────────────────────────────
  const handleComplete = () => {
    if (counts.inspected === 0) {
      Alert.alert('No Results', 'Please inspect at least one asset before completing.');
      return;
    }
    if (counts.remaining > 0) {
      Alert.alert(
        'Not All Inspected',
        `${counts.remaining} asset${counts.remaining !== 1 ? 's have' : ' has'} not been inspected.\n\nComplete anyway?`,
        [
          { text: 'Continue Inspecting', style: 'cancel' },
          { text: 'Complete', onPress: () => saveInspection() },
        ]
      );
    } else {
      saveInspection();
    }
  };

  const saveInspection = useCallback(async () => {
    if (!property || !user) return;
    setIsSaving(true);
    try {
      const now   = new Date().toISOString();
      const today = now.slice(0, 10);
      const jobId = generateUUID();

      // 1. Create completed job
      const jobPayload = {
        id: jobId, property_id: property.id, assigned_to: user.id,
        job_type: JobType.RoutineService, status: JobStatus.Completed,
        scheduled_date: today, scheduled_time: null, priority: Priority.Normal,
        notes: 'On-site inspection form submitted via SiteTrack mobile app.',
        created_at: now, updated_at: now,
      };
      upsertRecord('jobs', jobPayload as RecordData);
      addToSyncQueue('jobs', jobId, SyncOperation.Insert, jobPayload as RecordData);

      // 2. Save job_assets records
      // DECISION #2: assets the tech did not explicitly inspect are auto-marked
      // as not_tested. Never silently skip them — a missing record = missing compliance data.
      for (const asset of assets) {
        const r = results[asset.id];
        const resolvedResult = r?.result ?? InspectionResult.NotTested;
        const jaId = generateUUID();
        const jaPayload = {
          id: jaId, job_id: jobId, asset_id: asset.id,
          result: resolvedResult, checklist_data: null,
          is_compliant: resolvedResult === InspectionResult.Pass ? 1 : 0,
          defect_reason: resolvedResult === InspectionResult.Fail ? (r?.defectReason || null) : null,
          technician_notes: null, actioned_at: now,
        };
        upsertRecord('job_assets', jaPayload as RecordData);
        addToSyncQueue('job_assets', jaId, SyncOperation.Insert, jaPayload as RecordData);

        // 3. Auto-create defect if failed with reason
        if (resolvedResult === InspectionResult.Fail && r?.defectReason?.trim()) {
          const dId = generateUUID();
          const dPayload = {
            id: dId, job_id: jobId, asset_id: asset.id, property_id: property.id,
            description: r.defectReason.trim(), severity: DefectSeverity.Major,
            status: 'open', photos: '[]', created_at: now,
          };
          upsertRecord('defects', dPayload as RecordData);
          addToSyncQueue('defects', dId, SyncOperation.Insert, dPayload as RecordData);
        }
      }

      // 4. Update property compliance
      const compliance = counts.failed > 0 ? 'non_compliant' : 'compliant';
      upsertRecord('properties', { id: property.id, compliance_status: compliance, updated_at: now });
      addToSyncQueue('properties', property.id, SyncOperation.Update,
        { compliance_status: compliance, updated_at: now });

      Toast.show({
        type: 'success',
        text1: 'Inspection Saved',
        text2: 'Generating your report…',
      });
      router.replace(`/jobs/${jobId}/report` as never);
    } catch (err) {
      console.error('[SiteInspect] save error:', err);
      Toast.show({ type: 'error', text1: 'Save failed', text2: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [property, user, assets, results, counts]);

  // ── Render item ──────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: Asset; index: number }) => (
    <AssetInspectCard
      asset={item}
      result={results[item.id] ?? initResult()}
      onResult={handleResult}
      onDefectChange={handleDefectChange}
      index={index}
    />
  ), [results, handleResult, handleDefectChange]);

  const filterOptions = [
    { label: 'All',       count: assets.length },
    { label: 'Remaining', count: counts.remaining },
    { label: 'Passed',    count: counts.passed },
    { label: 'Failed',    count: counts.failed },
    { label: 'N/T',       count: counts.nt },
  ];

  // ── Loading skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="On-Site Form" showBack />
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
          <SkeletonBlock width="100%" height={130} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.border} />
        <Text style={[s.emptyTitle, { color: C.text }]}>Property Not Found</Text>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: C.primary }]} onPress={() => router.back()}>
          <Text style={{ color: C.textOnPrimary, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Progress badge in header
  const progressBadge = (
    <View style={[s.progressBadge, {
      backgroundColor: allDone ? C.success + '30' : C.backgroundTertiary,
      borderColor: allDone ? C.success : 'transparent',
      borderWidth: allDone ? 1 : 0,
    }]}>
      <Text style={[s.progressBadgeTxt, { color: allDone ? C.success : C.textOnPrimary }]}>
        {allDone ? 'All Done ' : ''}{counts.inspected}/{counts.total}
      </Text>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <ScreenHeader
        eyebrow="ON-SITE INSPECTION"
        title={property.name}
        subtitle={[property.address, property.suburb].filter(Boolean).join(', ') || 'No address'}
        showBack
        rightComponent={progressBadge}
      />

      {/* ── PROGRESS BAR ────────────────────────────────── */}
      <View style={[s.progressTrack, { backgroundColor: C.primary + '40' }]}>
        <View style={[s.progressFill, {
          backgroundColor: allDone ? C.success : C.accent,
          width: `${fillPct}%` as `${number}%`,
        }]} />
      </View>

      {/* ── STATS BAR ───────────────────────────────────── */}
      <View style={[s.statsBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        {[
          { label: 'Passed',    value: counts.passed,    color: C.success },
          { label: 'Failed',    value: counts.failed,    color: C.error },
          { label: 'N/T',       value: counts.nt,        color: C.textTertiary },
          { label: 'Remaining', value: counts.remaining, color: C.accent },
        ].map((stat, i, arr) => (
          <React.Fragment key={stat.label}>
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: C.textTertiary }]}>{stat.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={[s.statDivider, { backgroundColor: C.border }]} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── FILTER PILLS ────────────────────────────────── */}
      <View style={[s.filterRow, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <FilterPills
          options={filterOptions}
          activeIndex={filterOptions.findIndex(o => o.label === filter)}
          onSelect={i => setFilter(filterOptions[i].label)}
          variant="dark"
          style={{ flex: 1 }}
        />
      </View>

      {/* ── ASSET LIST / EMPTY STATE ─────────────────────── */}
      {assets.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="magnify" size={52} color={C.textTertiary} />
          <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            Tap below to add the first asset you find on-site.
          </Text>
          <TouchableOpacity
            style={[s.addFirstBtn, { backgroundColor: C.primary }]}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color={C.textOnPrimary} />
            <Text style={[s.addFirstBtnTxt, { color: C.textOnPrimary }]}>Add First Asset</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={6}
          />

          {/* ── FAB — Add Asset ──────────────────────────── */}
          <TouchableOpacity
            style={[s.fab, { backgroundColor: C.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddModal(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={22} color={C.textOnPrimary} />
            <Text style={[s.fabTxt, { color: C.textOnPrimary }]}>Add Asset</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
      {assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomTitle, { color: C.text }]}>
              {allDone
                ? 'All assets inspected'
                : `${counts.remaining} asset${counts.remaining !== 1 ? 's' : ''} remaining`}
            </Text>
            <Text style={[s.bottomSub, { color: C.textSecondary }]}>
              {counts.inspected} of {counts.total} inspected
            </Text>
          </View>
          <Button
            title={isSaving ? 'Saving…' : 'Complete'}
            disabled={counts.inspected === 0 || isSaving}
            isLoading={isSaving}
            onPress={handleComplete}
            style={{ minWidth: 130, borderRadius: 22, height: 46 }}
          />
        </View>
      )}

      {/* ── MODALS ──────────────────────────────────────── */}
      <AddAssetModal
        visible={showAddModal}
        propertyId={property.id}
        onClose={() => setShowAddModal(false)}
        onAssetAdded={handleAssetAdded}
      />

      {/* Completion modal */}
      <Modal visible={showComplete} transparent animationType="fade" onRequestClose={() => setShowComplete(false)}>
        <View style={[cm.overlay, { backgroundColor: C.overlay }]}>
          <Animated.View entering={ZoomIn.duration(350)} style={[cm.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <View style={[cm.circle, { backgroundColor: C.success }]}>
              <MaterialCommunityIcons name="check-bold" size={40} color={C.textOnPrimary} />
            </View>
            <Text style={[cm.title, { color: C.textOnPrimary }]}>Inspection Complete!</Text>
            <Text style={[cm.propName, { color: C.textSecondary }]}>{property.name}</Text>

            <View style={[cm.statsRow, { backgroundColor: C.backgroundTertiary }]}>
              {[
                { label: 'Passed', value: counts.passed },
                { label: 'Failed', value: counts.failed, alert: counts.failed > 0 },
                { label: 'Total',  value: counts.total },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <View style={cm.statItem}>
                    <Text style={[cm.statValue, s.alert ? { color: C.errorLight } : { color: C.textOnPrimary }]}>{s.value}</Text>
                    <Text style={[cm.statLabel, { color: C.textSecondary }]}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[cm.statDiv, { backgroundColor: C.border }]} />}
                </React.Fragment>
              ))}
            </View>

            {counts.failed > 0 && (
              <View style={[cm.alertRow, { backgroundColor: C.errorLight, borderColor: C.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={15} color={C.error} />
                <Text style={[cm.alertTxt, { color: C.errorDark }]}>
                  {counts.failed} defect{counts.failed !== 1 ? 's' : ''} logged — follow up with your office.
                </Text>
              </View>
            )}

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: C.success }]}
                onPress={() => { setShowComplete(false); router.back(); }}
              >
                <MaterialCommunityIcons name="arrow-left-circle" size={18} color={C.textOnPrimary} />
                <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Return to Property</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: C.backgroundTertiary }]}
                onPress={() => { setShowComplete(false); router.dismissAll(); }}
              >
                <Text style={[cm.btnTxt, { color: C.textOnPrimary }]}>Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:   { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },

  progressBadge:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 24 },
  progressBadgeTxt: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  progressTrack: { height: 6 },
  progressFill:  { height: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6 },

  statsBar:    { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statValue:   { fontSize: 18, fontWeight: '900' },
  statLabel:   { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, alignSelf: 'center' },

  filterRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },

  // Asset card
  cardOuter:    { marginHorizontal: 16, marginBottom: 14 },
  assetCard:    { flexDirection: 'row', borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  cardStripe:   { width: 6 },
  cardBody:     { flex: 1, padding: 18 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  assetIconWrap:{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  assetType:    { fontSize: 16, fontWeight: '900', marginBottom: 2, letterSpacing: -0.2 },
  assetLoc:     { fontSize: 13, marginTop: 2, fontWeight: '500' },
  assetSerial:  { fontSize: 12, fontFamily: 'monospace', marginTop: 4, opacity: 0.8, fontWeight: '600' },
  resultDot:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Defect
  defectSection: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginTop: 16 },
  defectTitle:   { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipTxt:       { fontSize: 13, fontWeight: '800' },
  defectInput:   { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '600' },

  // Buttons
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  resultBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5 },
  btnTxt:    { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  // FAB
  fab:    { position: 'absolute', right: 20, bottom: 104, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, elevation: 12, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
  fabTxt: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle:    { fontSize: 22, fontWeight: '900', marginTop: 12, letterSpacing: -0.5 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  addFirstBtn:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 24, marginTop: 24 },
  addFirstBtnTxt:{ fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  backBtn:       { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1, elevation: 24,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 16,
  },
  bottomTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  bottomSub:   { fontSize: 13, marginTop: 2, fontWeight: '600' },
});

// ─── Completion modal styles ──────────────────────────────────
const cm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'center', padding: 24 },
  card:     { borderRadius: 32, padding: 32, alignItems: 'center', gap: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
  circle:   { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  propName: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  statsRow: { flexDirection: 'row', width: '100%', borderRadius: 16, padding: 16 },
  statItem: { flex: 1, alignItems: 'center', gap: 6 },
  statDiv:  { width: 1 },
  statValue:{ fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:{ fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, width: '100%' },
  alertTxt: { fontSize: 13, flex: 1, lineHeight: 20, fontWeight: '600' },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 20, height: 56, width: '100%' },
  btnTxt:   { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
