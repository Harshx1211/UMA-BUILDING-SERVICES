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
  Alert, Modal, TextInput, Platform,
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
  getRecord, getAssetsForProperty, insertRecord, addToSyncQueue, updateRecord,
} from '@/lib/database';
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
                  size={14} color="#FFF"
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
                      {active && <MaterialCommunityIcons name="check" size={10} color="#FFF" />}
                      <Text style={[s.chipTxt, { color: active ? '#FFF' : C.textSecondary }]}>{chip}</Text>
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
              <MaterialCommunityIcons name="check-circle" size={15} color={isPassed ? '#FFF' : C.success} />
              <Text style={[s.btnTxt, { color: isPassed ? '#FFF' : C.success }]}>Pass</Text>
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
              <MaterialCommunityIcons name="close-circle" size={15} color={isFailed ? '#FFF' : C.error} />
              <Text style={[s.btnTxt, { color: isFailed ? '#FFF' : C.error }]}>Fail</Text>
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
              <MaterialCommunityIcons name="minus-circle-outline" size={15} color={isNT ? '#FFF' : C.textSecondary} />
              <Text style={[s.btnTxt, { color: isNT ? '#FFF' : C.textSecondary }]}>N/T</Text>
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

  const saveInspection = async () => {
    if (!property || !user) return;
    setIsSaving(true);
    try {
      const now   = new Date().toISOString();
      const today = now.slice(0, 10);
      const jobId = generateUUID();  // BUG 28 FIX

      // 1. Create completed job
      const jobPayload = {
        id: jobId, property_id: property.id, assigned_to: user.id,
        job_type: JobType.RoutineService, status: JobStatus.Completed,
        scheduled_date: today, scheduled_time: null, priority: Priority.Normal,
        notes: 'On-site inspection form submitted via SiteTrack mobile app.',
        created_at: now, updated_at: now,
      };
      insertRecord('jobs', jobPayload as any);
      addToSyncQueue('jobs', jobId, SyncOperation.Insert, jobPayload as any);

      // 2. Save job_assets records
      for (const asset of assets) {
        const r = results[asset.id];
        if (!r || r.result === null) continue;
        const jaId = generateUUID();  // BUG 28 FIX
        const jaPayload = {
          id: jaId, job_id: jobId, asset_id: asset.id,
          result: r.result, checklist_data: null,
          is_compliant: r.result === InspectionResult.Pass ? 1 : 0,
          defect_reason: r.defectReason || null,
          technician_notes: null, actioned_at: now,
        };
        insertRecord('job_assets', jaPayload as any);
        addToSyncQueue('job_assets', jaId, SyncOperation.Insert, jaPayload as any);

        // 3. Auto-create defect if failed with reason
        if (r.result === InspectionResult.Fail && r.defectReason.trim()) {
          const dId = generateUUID();  // BUG 28 FIX
          const dPayload = {
            id: dId, job_id: jobId, asset_id: asset.id, property_id: property.id,
            description: r.defectReason.trim(), severity: DefectSeverity.Major,
            status: 'open', photos: '[]', created_at: now,
          };
          insertRecord('defects', dPayload as any);
          addToSyncQueue('defects', dId, SyncOperation.Insert, dPayload as any);
        }
      }

      // 4. Update property compliance
      const compliance = counts.failed > 0 ? 'non_compliant' : 'compliant';
      updateRecord('properties', property.id, { compliance_status: compliance, updated_at: now });
      addToSyncQueue('properties', property.id, SyncOperation.Update,
        { compliance_status: compliance, updated_at: now });

      // BUG 6 FIX: navigate to the report screen for this newly created job
      // This connects the site-inspect flow to the full report pipeline
      setIsSaving(false);
      Toast.show({
        type: 'success',
        text1: 'Inspection Saved ✔',
        text2: 'Generating your report…',
      });
      router.replace(`/jobs/${jobId}/report` as never);
    } catch (err) {
      console.error('[SiteInspect] save error:', err);
      setIsSaving(false);
      Toast.show({ type: 'error', text1: 'Save failed', text2: 'Please try again.' });
    }
  };

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
        <ScreenHeader curved={false} title="On-Site Form" showBack />
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
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Progress badge in header
  const progressBadge = (
    <View style={[s.progressBadge, {
      backgroundColor: allDone ? C.success + '30' : 'rgba(255,255,255,0.18)',
      borderColor: allDone ? C.success : 'transparent',
      borderWidth: allDone ? 1 : 0,
    }]}>
      <Text style={[s.progressBadgeTxt, { color: allDone ? C.success : '#FFF' }]}>
        {allDone ? '✓ ' : ''}{counts.inspected}/{counts.total}
      </Text>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>

      {/* ── HEADER ──────────────────────────────────────── */}
      <ScreenHeader
        curved={false}
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
          <Text style={{ fontSize: 52 }}>🔍</Text>
          <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            Tap below to add the first asset you find on-site.
          </Text>
          <TouchableOpacity
            style={[s.addFirstBtn, { backgroundColor: C.primary }]}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color="#FFF" />
            <Text style={s.addFirstBtnTxt}>Add First Asset</Text>
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
            style={[s.fab, { backgroundColor: C.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddModal(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFF" />
            <Text style={s.fabTxt}>Add Asset</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
      {assets.length > 0 && (
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.bottomTitle, { color: C.text }]}>
              {allDone
                ? '✅ All assets inspected'
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
        <View style={cm.overlay}>
          <Animated.View entering={ZoomIn.duration(350)} style={[cm.card, { backgroundColor: C.primary }]}>
            <View style={[cm.circle, { backgroundColor: C.success }]}>
              <MaterialCommunityIcons name="check-bold" size={40} color="#FFF" />
            </View>
            <Text style={cm.title}>Inspection Complete!</Text>
            <Text style={cm.propName}>{property.name}</Text>

            <View style={[cm.statsRow, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              {[
                { label: 'Passed', value: counts.passed },
                { label: 'Failed', value: counts.failed, alert: counts.failed > 0 },
                { label: 'Total',  value: counts.total },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <View style={cm.statItem}>
                    <Text style={[cm.statValue, s.alert ? { color: '#FCA5A5' } : {}]}>{s.value}</Text>
                    <Text style={cm.statLabel}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={cm.statDiv} />}
                </React.Fragment>
              ))}
            </View>

            {counts.failed > 0 && (
              <View style={cm.alertRow}>
                <MaterialCommunityIcons name="alert-circle" size={15} color="#FCA5A5" />
                <Text style={cm.alertTxt}>
                  {counts.failed} defect{counts.failed !== 1 ? 's' : ''} logged — follow up with your office.
                </Text>
              </View>
            )}

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: C.success }]}
                onPress={() => { setShowComplete(false); router.back(); }}
              >
                <MaterialCommunityIcons name="arrow-left-circle" size={18} color="#FFF" />
                <Text style={cm.btnTxt}>Return to Property</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cm.btn, { backgroundColor: 'rgba(255,255,255,0.14)' }]}
                onPress={() => { setShowComplete(false); router.dismissAll(); }}
              >
                <Text style={cm.btnTxt}>Go to Dashboard</Text>
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

  progressBadge:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progressBadgeTxt: { fontWeight: '800', fontSize: 13 },

  progressTrack: { height: 5 },
  progressFill:  { height: 5, borderTopRightRadius: 5, borderBottomRightRadius: 5 },

  statsBar:    { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 16, fontWeight: '800' },
  statLabel:   { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  statDivider: { width: 1, height: 28, alignSelf: 'center' },

  filterRow: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1 },

  // Asset card
  cardOuter:    { marginHorizontal: 14, marginBottom: 10 },
  assetCard:    { flexDirection: 'row', borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  cardStripe:   { width: 5 },
  cardBody:     { flex: 1, padding: 14 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  assetIconWrap:{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assetType:    { fontSize: 15, fontWeight: '800', marginBottom: 1 },
  assetLoc:     { fontSize: 12, marginTop: 1 },
  assetSerial:  { fontSize: 11, fontFamily: 'monospace', marginTop: 2, opacity: 0.7 },
  resultDot:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Defect
  defectSection: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  defectTitle:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginBottom: 10, textTransform: 'uppercase' },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipTxt:       { fontSize: 12, fontWeight: '600' },
  defectInput:   { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },

  // Buttons
  btnRow:    { flexDirection: 'row', gap: 8, marginTop: 12 },
  resultBtn: { flex: 1, height: 44, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5 },
  btnTxt:    { fontSize: 13, fontWeight: '700' },

  // FAB
  fab:    { position: 'absolute', right: 18, bottom: 96, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  fabTxt: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginTop: 8 },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  addFirstBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 16 },
  addFirstBtnTxt:{ color: '#FFF', fontSize: 15, fontWeight: '800' },
  backBtn:       { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    borderTopWidth: 1, elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  bottomTitle: { fontSize: 14, fontWeight: '700' },
  bottomSub:   { fontSize: 12, marginTop: 1 },
});

// ─── Completion modal styles ──────────────────────────────────
const cm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  card:     { borderRadius: 28, padding: 28, alignItems: 'center', gap: 14 },
  circle:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  propName: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  statsRow: { flexDirection: 'row', width: '100%', borderRadius: 14, padding: 14 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  statValue:{ fontSize: 22, fontWeight: '800', color: '#FFF' },
  statLabel:{ fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: '#FCA5A5', width: '100%' },
  alertTxt: { fontSize: 12, color: '#FCA5A5', flex: 1, lineHeight: 18 },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 50, width: '100%' },
  btnTxt:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
