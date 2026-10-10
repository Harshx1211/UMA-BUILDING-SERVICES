import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useResponsive } from '@/hooks/useResponsive';
import { getRecord, getAssetsForProperty } from '@/lib/database';
import { AssetStatus } from '@/constants/Enums';
import type { Property, Asset } from '@/types';
import { ScreenHeader, EmptyState } from '@/components/ui';
import AddAssetModal from '@/components/inspections/AddAssetModal';
import { onSyncComplete, offSyncComplete } from '@/lib/sync';

type ColorsType = ReturnType<typeof useColors>;

function assetIconName(type: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const t = type.toLowerCase();
  if (t.includes('extinguisher'))              return 'fire-extinguisher';
  if (t.includes('sprinkler'))                 return 'water';
  if (t.includes('door') || t.includes('exit'))return 'door';
  if (t.includes('emergency') || t.includes('light')) return 'led-strip';
  if (t.includes('fire'))                      return 'fire';
  if (t.includes('hose'))                      return 'pipe';
  if (t.includes('alarm'))                     return 'bell-ring';
  return 'shield-check-outline';
}

function assetStatusColor(status: string, C: ColorsType) {
  return status === AssetStatus.Active ? C.success : C.textTertiary;
}

export default function PropertyAssetsScreen() {
  const C = useColors();
  const noMotion = useReducedMotion();
  const { contentMaxWidth } = useResponsive();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  // FIX: a genuine load failure used to render identically to "this
  // property doesn't exist" — see properties/[id].tsx's identical fix.
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      const p = getRecord<Property>('properties', id);
      setProperty(p);
      if (p) {
        setAssets(getAssetsForProperty<Asset>(id));
      }
    } catch (err) {
      console.error('[PropertyAssets] load error:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // FIX: the focus-effect above only refreshes on returning to this screen
  // — another tech/admin adding or editing an asset here while the screen
  // was already open (and staying open) never showed up. Now also reloads
  // on the same signal the "my data" live channel and the 10-minute
  // fallback sync both fire (see subscribeToMyDataLive in lib/sync.ts).
  useEffect(() => {
    onSyncComplete(load);
    return () => offSyncComplete(load);
  }, [load]);

  // FIX: two plain `.filter().length` passes over `assets` in the render
  // body — recomputed on every render regardless of whether assets actually
  // changed. Must sit above the early returns below — Hooks can't run
  // conditionally.
  const today = new Date().toISOString().slice(0, 10);
  const { activeAssetsCount, overdueAssetsCount } = useMemo(() => ({
    activeAssetsCount: assets.filter(a => a.status === AssetStatus.Active).length,
    overdueAssetsCount: assets.filter(a => a.next_service_date && a.next_service_date < today).length,
  }), [assets, today]);

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Error" showBack={true} />
        <EmptyState
          icon="cloud-alert-outline"
          title="Couldn't load the asset register"
          subtitle="Something went wrong loading this record. Check your connection and try again."
          actionLabel="Retry"
          onAction={load}
        />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Not Found" showBack={true} />
        <EmptyState
          icon="office-building-marker-outline"
          title="Property not found"
          subtitle="We couldn't locate the property record."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const activeAssets  = activeAssetsCount;
  const overdueAssets = overdueAssetsCount;

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="ASSET REGISTER"
        title={property.name}
        subtitle={`${activeAssets} Active Asset${activeAssets !== 1 ? 's' : ''}${overdueAssets > 0 ? ` · ${overdueAssets} Overdue` : ''}`}
        showBack={true}
        rightComponent={
          <TouchableOpacity
            style={[s.headerAddBtn, { backgroundColor: T.iconBg(C.primary) }]}
            onPress={() => setShowAddAsset(true)}
          >
            <MaterialCommunityIcons name="plus" size={18} color={C.primary} />
          </TouchableOpacity>
        }
      />

      {assets.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="magnify" size={52} color={C.textTertiary} />
          <Text style={[s.emptyTitle, { color: C.text }]}>No Assets Registered</Text>
          <Text style={[s.emptySub, { color: C.textSecondary }]}>
            It looks like there are no fire safety assets on record for this site.
          </Text>
          <TouchableOpacity
            style={[s.addFirstBtn, { backgroundColor: C.primary }]}
            onPress={() => setShowAddAsset(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color={C.textOnPrimary} />
            <Text style={[s.addFirstBtnTxt, { color: C.textOnPrimary }]}>Add First Asset</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // FIX: a large commercial property in this domain (fire safety
        // compliance) can easily have 100-300+ assets — extinguishers, exit
        // lights, hose reels, etc. throughout a building — and this used to
        // render every one of them into a single ScrollView via .map(), all
        // mounted immediately with no windowing. FlatList windows off-screen
        // rows; the card's border/radius/background move onto the wrapping
        // View so the visual "one bordered list" look is unchanged.
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }}>
          <Animated.View
            entering={noMotion ? undefined : FadeInDown.delay(100).duration(400)}
            style={[s.card, { backgroundColor: C.surface, borderColor: C.border, flex: 1, marginBottom: 40 }]}
          >
            <FlatList
              data={assets}
              keyExtractor={(asset) => asset.id}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              renderItem={({ item: asset, index: i }) => {
                const isOverdue = asset.next_service_date && asset.next_service_date < today;
                const statusColor = assetStatusColor(asset.status, C);
                const isInactive = asset.status !== AssetStatus.Active;
                return (
                  <TouchableOpacity
                    style={[
                      s.assetRow,
                      i < assets.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                    ]}
                    onPress={() => router.push(`/assets/${asset.id}` as never)}
                    activeOpacity={0.7}
                    // FIX: Active/Inactive was conveyed ONLY by a 6x6 colored
                    // dot — no text/icon backup for a colorblind technician,
                    // and nothing in the accessibility tree conveyed it at
                    // all (no accessibilityLabel on the row).
                    accessibilityLabel={`${asset.asset_type}${asset.location_on_site ? ', ' + asset.location_on_site : ''}, ${isInactive ? 'inactive' : 'active'}${isOverdue ? ', overdue for service' : ''}`}
                  >
                    {/* Icon */}
                    <View style={[s.assetIconWrap, { backgroundColor: isOverdue ? C.errorLight : T.iconBg(C.primary) }]}>
                      <MaterialCommunityIcons
                        name={assetIconName(asset.asset_type)}
                        size={22}
                        color={isOverdue ? C.error : C.primary}
                      />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.assetType, { color: C.text }]}>{asset.asset_type}</Text>
                      {asset.location_on_site
                        ? <Text style={[s.assetLocation, { color: C.textSecondary }]}>{asset.location_on_site}</Text>
                        : null
                      }
                      {asset.serial_number
                        ? <Text style={[s.assetSerial, { color: C.textTertiary }]}>S/N: {asset.serial_number}</Text>
                        : null
                      }

                      {/* Date chips */}
                      <View style={s.dateChipsRow}>
                        {asset.last_service_date && (
                          <View style={[s.dateChip, { backgroundColor: C.backgroundTertiary }]}>
                            <MaterialCommunityIcons name="history" size={10} color={C.textTertiary} />
                            <Text style={[s.dateChipTxt, { color: C.textTertiary }]}>
                              Last: {asset.last_service_date}
                            </Text>
                          </View>
                        )}
                        {asset.next_service_date && (
                          <View style={[s.dateChip, isOverdue
                            ? { backgroundColor: C.errorLight }
                            : { backgroundColor: C.successLight }
                          ]}>
                            <MaterialCommunityIcons
                              name={isOverdue ? 'alert-circle' : 'calendar-check'}
                              size={10}
                              color={isOverdue ? C.error : C.success}
                            />
                            <Text style={[s.dateChipTxt, { color: isOverdue ? C.error : C.success }]}>
                              {isOverdue ? 'Overdue: ' : 'Due: '}{asset.next_service_date}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Status indicator */}
                    <View style={s.assetRight}>
                      {isInactive && (
                        <Text style={[s.inactiveLabel, { color: C.textTertiary }]}>Inactive</Text>
                      )}
                      <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                      <MaterialCommunityIcons name="chevron-right" size={18} color={C.border} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </View>
      )}

      {/* ── ADD ASSET MODAL ── */}
      {property && (
        <AddAssetModal
          visible={showAddAsset}
          propertyId={property.id}
          onClose={() => setShowAddAsset(false)}
          onAssetAdded={(newAssets) => {
            setAssets(prev => [...prev, ...newAssets]);
            setShowAddAsset(false);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  headerAddBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', padding: 0 },

  // Asset rows
  assetRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  assetIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  assetType:     { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  assetLocation: { fontSize: 12, marginTop: 1 },
  assetSerial:   { fontSize: 11, fontFamily: 'monospace', marginTop: 1 },
  dateChipsRow:  { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  dateChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  dateChipTxt:   { fontSize: 10, fontWeight: '600' },
  assetRight:    { alignItems: 'center', gap: 2 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  inactiveLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginTop: 8 },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  addFirstBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 16 },
  addFirstBtnTxt:{ fontSize: 15, fontWeight: '800' },
});
