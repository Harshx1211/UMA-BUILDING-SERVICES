/**
 * DefectFieldsCard — severity + code + description editor for ONE defect.
 *
 * Used for every defect on an asset (the first one that comes with a Fail,
 * and any added afterward) so they all look and behave identically — this
 * replaces an earlier version where the first defect lived in this exact
 * inline shape while any additional ones opened a completely different,
 * heavier bottom-sheet wizard. Whatever isn't actively being edited renders
 * as a DefectCard summary instead (see asset/[assetId].tsx) — this
 * component is only ever on-screen for the one defect currently being
 * created or edited.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { useColors } from '@/hooks/useColors';
import { DefectSeverity } from '@/constants/Enums';
import { findDefectCode } from '@/constants/DefectCodes';
import type { DefectCode } from '@/constants/DefectCodes';
import DefectCodePicker from '@/components/defects/DefectCodePicker';
import { PhotoChooserSheet } from '@/components/camera/PhotoChooserSheet';
import { getValidLocalUri } from '@/utils/fileHelpers';
import { cardShadow } from '@/components/ui/Card';

type ColorsType = ReturnType<typeof useColors>;
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const SEVERITIES: { value: DefectSeverity; label: string; icon: MCIconName; desc: string }[] = [
  { value: DefectSeverity.NonConformance, label: 'Non-conformance', icon: 'alert-circle-outline', desc: "Doesn't affect system operation" },
  { value: DefectSeverity.NonCritical,    label: 'Non-critical',    icon: 'alert',                desc: 'Action within 30 days' },
  { value: DefectSeverity.Critical,       label: 'Critical',        icon: 'alert-octagon',        desc: 'Immediate action required' },
];

function severityColor(severity: DefectSeverity, C: ColorsType): string {
  switch (severity) {
    case DefectSeverity.NonConformance: return C.info;
    case DefectSeverity.NonCritical:    return C.warning;
    case DefectSeverity.Critical:       return C.error;
  }
}

// FIX: the card's own background/border used to be hard-coded red
// (C.errorLight/C.error) regardless of severity — reasonable back when
// this only ever appeared on an already-Failed asset, but this component
// now also renders for a Remark logged on a Pass/N-T asset (see
// asset/[assetId].tsx), where a solid red card would visually contradict
// the green Pass state right above it. Deriving the tint from the
// defect's OWN severity instead is both more correct (an actually-Critical
// Remark still reads as urgent) and consistent with severityColor's own
// existing mapping — Info/Warning/Error already exist as paired
// bg+border tokens for exactly these three severities.
function severityBg(severity: DefectSeverity, C: ColorsType): { bg: string; border: string } {
  switch (severity) {
    case DefectSeverity.NonConformance: return { bg: C.infoLight, border: C.info + '40' };
    case DefectSeverity.NonCritical:    return { bg: C.warningLight, border: C.warning + '40' };
    case DefectSeverity.Critical:       return { bg: C.errorLight, border: C.error + '40' };
  }
}

export interface DefectFieldsValue {
  severity: DefectSeverity;
  description: string;
  defectCode: string | null;
  quotePrice: number | null;
  resolvedOnSite: boolean;
}

export interface DefectPhotosDraft { before: string[]; after: string[]; }

interface Props {
  /** null/undefined = a brand-new, not-yet-saved defect. */
  initial?: { severity: DefectSeverity; description: string; defect_code: string | null; quote_price: number | null; resolved_on_site?: boolean } | null;
  onSave: (value: DefectFieldsValue, photos?: DefectPhotosDraft) => void;
  /** Only offered for an already-saved defect. */
  onDelete?: () => void;
  /** Only offered on the asset's primary defect — a fast path to Fail +
   * quote with a preset Critical severity. Doesn't receive photos directly
   * (its own signature has no second param, matching onSave's), but this
   * form's photos/resolved-on-site fields are shared with Save Defect —
   * the caller reads them back via onPhotosDraftChange/onDraftChange and
   * reconciles them against whatever defect this call touches. */
  onReplace?: (value: DefectFieldsValue) => void;
  /** Only offered while creating/editing — discards the draft, nothing saved. */
  onCancel?: () => void;
  /** Fires on every field change — lets the asset screen keep its
   * leave-without-saving safety net working for the primary defect. */
  onDraftChange?: (value: DefectFieldsValue) => void;
  /** Omit entirely for a card that should never capture photos. Passing
   * this — even {before:[],after:[]} for a brand-new defect — turns on the
   * Before/After photo area below (now used for every defect, primary or
   * additional — see asset/[assetId].tsx). */
  photos?: DefectPhotosDraft;
  /** Fires on every photo add/remove — same leave-without-saving purpose
   * as onDraftChange, for the photos half of the draft. */
  onPhotosDraftChange?: (photos: DefectPhotosDraft) => void;
  saving?: boolean;
  saveLabel?: string;
}

export function DefectFieldsCard({
  initial, onSave, onDelete, onReplace, onCancel, onDraftChange,
  photos, onPhotosDraftChange, saving, saveLabel = 'Save Defect',
}: Props) {
  const C = useColors();
  const [severity, setSeverity] = useState<DefectSeverity>(initial?.severity ?? DefectSeverity.NonConformance);
  const [codePickerVisible, setCodePickerVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(
    () => (initial?.defect_code ? findDefectCode(initial.defect_code) ?? null : null)
  );
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(initial?.quote_price ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState(false);
  const [resolvedOnSite, setResolvedOnSite] = useState(initial?.resolved_on_site ?? false);

  const photosEnabled = photos !== undefined;
  const [beforePhotos, setBeforePhotos] = useState<string[]>(photos?.before ?? []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(photos?.after ?? []);
  const [chooserTarget, setChooserTarget] = useState<'before' | 'after' | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  // Reports the live draft up on every change, without the parent needing to
  // own this state itself — used only by the primary defect's blur-flush.
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current?.({ severity, description, defectCode: selectedCode?.code ?? null, quotePrice: suggestedPrice, resolvedOnSite });
  }, [severity, description, selectedCode, suggestedPrice, resolvedOnSite]);

  const onPhotosDraftChangeRef = useRef(onPhotosDraftChange);
  onPhotosDraftChangeRef.current = onPhotosDraftChange;
  useEffect(() => {
    if (photosEnabled) onPhotosDraftChangeRef.current?.({ before: beforePhotos, after: afterPhotos });
  }, [photosEnabled, beforePhotos, afterPhotos]);

  // FIX: tracks whether the severity reflects an explicit choice — either
  // an existing defect's already-saved severity (a real prior decision, not
  // a placeholder) or one the technician has picked in this session.
  // handleCodeSelect below must never silently override either.
  const severityTouchedRef = useRef(!!initial);

  const handleSelectSeverity = (v: DefectSeverity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    severityTouchedRef.current = true;
    setSeverity(v);
  };

  const handleCodeSelect = (code: DefectCode | null) => {
    setCodePickerVisible(false);
    if (code === null) {
      setSelectedCode(null);
      setSuggestedPrice(null);
    } else {
      // FIX: previously always overwrote whatever the technician had
      // already typed. Only auto-fill when the current text is empty or
      // still exactly the PREVIOUS code's auto-filled description (i.e.
      // swapping codes before typing anything custom) — never clobber text
      // they actually wrote themselves, with no undo.
      if (!description.trim() || description === selectedCode?.description) {
        setDescription(code.description);
      }
      setSelectedCode(code);
      setSuggestedPrice(code.quote_price ?? null);
      setError(false);
      // FIX: previously always overwrote severity, even after the
      // technician had explicitly picked one — a real Critical
      // classification could be silently downgraded to Non-critical purely
      // because of code-selection order, with no toast/confirmation ever
      // telling them it changed. Only apply this suggestion before they've
      // made their own explicit choice.
      if (!severityTouchedRef.current && (code.category === 'Alarm' || (code.quote_price && code.quote_price >= 300))) {
        setSeverity(DefectSeverity.NonCritical);
      }
    }
  };

  const currentValue = (): DefectFieldsValue => ({
    severity, description: description.trim(), defectCode: selectedCode?.code ?? null, quotePrice: suggestedPrice, resolvedOnSite,
  });
  const currentPhotos = (): DefectPhotosDraft => ({ before: beforePhotos, after: afterPhotos });

  const validate = (): boolean => {
    if (!description.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      return false;
    }
    setError(false);
    return true;
  };

  // Same resize/compress recipe already used everywhere else a photo gets
  // captured in this app (AddDefectSheet.tsx, asset/[assetId].tsx's own
  // top-level Photos section) — kept identical rather than inventing a
  // fourth copy of it.
  const addPhotoTo = (target: 'before' | 'after') => (setPhotos: React.Dispatch<React.SetStateAction<string[]>>) => async (sourceUri: string) => {
    let resizedUri = sourceUri;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      resizedUri = manipResult.uri;
    } catch (e) {
      console.warn(`Failed to resize/compress ${target} photo, using original`, e);
    }
    const dest = `${FileSystem.documentDirectory}defect_${target}_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: resizedUri, to: dest });
      setPhotos((p) => [...p, dest]);
    } catch {
      setPhotos((p) => [...p, resizedUri]);
    }
  };

  const handleTakePhoto = async () => {
    const target = chooserTarget;
    setChooserTarget(null);
    if (!target) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    setIsAddingPhoto(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await addPhotoTo(target)(target === 'before' ? setBeforePhotos : setAfterPhotos)(result.assets[0].uri);
      }
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const handlePickPhoto = async () => {
    const target = chooserTarget;
    setChooserTarget(null);
    if (!target) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    setIsAddingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsMultipleSelection: true, selectionLimit: 5 });
      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const setter = target === 'before' ? setBeforePhotos : setAfterPhotos;
        for (const a of result.assets) await addPhotoTo(target)(setter)(a.uri);
      }
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const removePhoto = (target: 'before' | 'after', uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    (target === 'before' ? setBeforePhotos : setAfterPhotos)((p) => p.filter((x) => x !== uri));
  };

  const current = SEVERITIES.find((sv) => sv.value === severity) ?? SEVERITIES[0];
  const currentColor = severityColor(current.value, C);
  const cardTint = severityBg(current.value, C);

  return (
    <View style={[s.card, { backgroundColor: cardTint.bg, borderColor: cardTint.border }]}>
      <Text style={[s.label, { color: C.textTertiary }]}>Severity</Text>
      {/* FIX: was a tap-to-expand dropdown (3 full rows, icon+label+desc
          each) — an extra tap, and pushed the whole form down whenever
          open. Replaced with the same 3-way segmented control already used
          for Pass/Fail/N-T on the asset screen above this form — one tap,
          always visible, a third of the height. */}
      <View style={[s.sevTrack, { backgroundColor: C.backgroundTertiary, opacity: saving ? 0.5 : 1 }]}>
        {SEVERITIES.map((sev) => {
          const active = severity === sev.value;
          const color = severityColor(sev.value, C);
          return (
            <TouchableOpacity
              key={sev.value}
              style={[s.sevSeg, active && { backgroundColor: C.surface, ...cardShadow }]}
              onPress={() => handleSelectSeverity(sev.value)}
              activeOpacity={0.8}
              disabled={saving}
            >
              <MaterialCommunityIcons name={sev.icon} size={15} color={active ? color : C.textSecondary} />
              <Text style={[s.sevSegTxt, { color: active ? color : C.textSecondary }]}>{sev.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[s.sevDesc, { color: C.textSecondary }]}>{current.desc}</Text>

      {error && (
        <View style={[s.errorBanner, { backgroundColor: C.surface, borderColor: C.error }]}>
          <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
          <Text style={[s.errorTxt, { color: C.error }]}>Please describe the defect before saving.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.codeBtn, { backgroundColor: C.surface, borderColor: selectedCode ? C.primary : C.border }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCodePickerVisible(true); }}
        activeOpacity={0.8}
        disabled={saving}
      >
        <View style={[s.codeIcon, { backgroundColor: selectedCode ? C.primary + '18' : C.background }]}>
          <MaterialCommunityIcons
            name={selectedCode ? 'tag-check-outline' : 'tag-search-outline'}
            size={18}
            color={selectedCode ? C.primary : C.textSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.codeTitle, { color: selectedCode ? C.primary : C.text }]}>
            {selectedCode ? `Code: ${selectedCode.code.toUpperCase()}` : 'Select from Code Library'}
          </Text>
          <Text style={[s.codeSub, { color: C.textSecondary }]} numberOfLines={1}>
            {selectedCode ? selectedCode.description : 'Browse 100+ Uptick defect codes'}
          </Text>
        </View>
        {suggestedPrice !== null && (
          <View style={s.priceBadge}><Text style={s.priceBadgeTxt}>${suggestedPrice}</Text></View>
        )}
        {selectedCode ? (
          <TouchableOpacity onPress={() => { setSelectedCode(null); setSuggestedPrice(null); }} hitSlop={8} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={18} color={C.textTertiary} />
        )}
      </TouchableOpacity>

      <TextInput
        placeholder="Or type a custom description…"
        placeholderTextColor={C.textTertiary}
        value={description}
        onChangeText={(v) => {
          setDescription(v);
          if (v.trim()) setError(false);
          if (selectedCode && v !== selectedCode.description) { setSelectedCode(null); setSuggestedPrice(null); }
        }}
        multiline
        textAlignVertical="top"
        editable={!saving}
        style={[s.input, { backgroundColor: C.surface, borderColor: error ? C.error : C.border, color: C.text, marginTop: 10 }]}
      />

      {photosEnabled && (
        <>
          <PhotoStageSection
            label="Before Photos"
            hint="What you found"
            photos={beforePhotos}
            onAdd={() => setChooserTarget('before')}
            onRemove={(uri) => removePhoto('before', uri)}
            disabled={saving || isAddingPhoto}
            loading={isAddingPhoto}
            C={C}
          />
          <PhotoStageSection
            label="After Photos"
            hint="Already fixed? Add photos of the resolved issue."
            photos={afterPhotos}
            onAdd={() => setChooserTarget('after')}
            onRemove={(uri) => removePhoto('after', uri)}
            disabled={saving || isAddingPhoto}
            loading={isAddingPhoto}
            C={C}
          />

          <TouchableOpacity
            style={s.resolvedRow}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setResolvedOnSite((v) => !v); }}
            activeOpacity={0.75}
            disabled={saving}
          >
            <View style={[s.checkbox, { borderColor: resolvedOnSite ? C.success : C.border, backgroundColor: resolvedOnSite ? C.success : C.surface }]}>
              {resolvedOnSite && <MaterialCommunityIcons name="check" size={14} color={C.textOnPrimary} />}
            </View>
            <Text style={[s.resolvedTxt, { color: C.text }]}>Mark as resolved on site (no quote needed)</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={s.actionsRow}>
        {onDelete && (
          <TouchableOpacity style={[s.iconBtn, { borderColor: C.border }]} onPress={onDelete} activeOpacity={0.8} disabled={saving} hitSlop={8}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.textSecondary} />
          </TouchableOpacity>
        )}
        {onCancel && (
          <TouchableOpacity style={[s.cancelBtn, { borderColor: C.border }]} onPress={onCancel} activeOpacity={0.8} disabled={saving}>
            <Text style={[s.cancelTxt, { color: C.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        {onReplace && (
          // FIX: was a wide icon+text pill, which — on the one screen where
          // it actually appears (editing an already-saved primary defect,
          // alongside Cancel AND Save Changes) — squeezed three buttons into
          // one row, crowding the two flex-1 primary actions on either side
          // of it. Matches the Delete icon button's compact treatment
          // instead, so Cancel/Save Changes keep comfortable room.
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: C.warning + '18', borderColor: C.warning }]}
            onPress={() => { if (validate()) onReplace(currentValue()); }}
            activeOpacity={0.8}
            disabled={saving}
            accessibilityLabel="Replace asset"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="tools" size={18} color={C.warning} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: currentColor }]}
          onPress={() => { if (validate()) onSave(currentValue(), photosEnabled ? currentPhotos() : undefined); }}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color={C.textOnPrimary} /> : (
            <>
              <MaterialCommunityIcons name="content-save-outline" size={16} color={C.textOnPrimary} />
              <Text style={[s.saveTxt, { color: C.textOnPrimary }]}>{saveLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <DefectCodePicker visible={codePickerVisible} onSelect={handleCodeSelect} onClose={() => setCodePickerVisible(false)} />
      {photosEnabled && (
        <PhotoChooserSheet
          visible={chooserTarget !== null}
          onClose={() => setChooserTarget(null)}
          onTakePhoto={handleTakePhoto}
          onPickGallery={handlePickPhoto}
        />
      )}
    </View>
  );
}

// ─── One Before/After photo section — a labelled grid + dashed add-tile,
// sized to match asset/[assetId].tsx's own top-level Photos section exactly
// (same 72×72 thumbs, same add-tile). Two of these stack, always both
// visible — no toggle/tab hiding one behind the other, so a reviewer can
// see the whole before-and-after story on a defect at a glance. ──────────
function PhotoStageSection({ label, hint, photos, onAdd, onRemove, disabled, loading, C }: {
  label: string; hint: string; photos: string[];
  onAdd: () => void; onRemove: (uri: string) => void;
  disabled?: boolean; loading?: boolean; C: ColorsType;
}) {
  return (
    <View style={s.photoSectionBlock}>
      <Text style={[s.label, { color: C.textTertiary }]}>{label}{photos.length > 0 ? ` · ${photos.length}` : ''}</Text>
      <Text style={[s.photoHint, { color: C.textTertiary }]}>{hint}</Text>
      <View style={s.photoGrid}>
        {photos.map((uri) => (
          <TouchableOpacity key={uri} onLongPress={() => onRemove(uri)} activeOpacity={0.85} style={s.thumbWrap}>
            <Image source={{ uri: getValidLocalUri(uri) }} style={s.thumb} contentFit="cover" />
            <TouchableOpacity style={[s.thumbDel, { backgroundColor: C.text }]} onPress={() => onRemove(uri)} hitSlop={6}>
              <MaterialCommunityIcons name="close" size={12} color={C.textOnPrimary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.photoAddTile, { backgroundColor: C.surface, borderColor: C.border }]}
          onPress={onAdd}
          activeOpacity={0.8}
          disabled={disabled}
        >
          {loading
            ? <ActivityIndicator size="small" color={C.textSecondary} />
            : <MaterialCommunityIcons name="camera-plus-outline" size={20} color={C.textSecondary} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },

  // Severity — a 3-way segmented control (matches the Pass/Fail/N-T track
  // on the asset screen exactly: same track/segment radii and padding).
  sevTrack: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  sevSeg: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 2, gap: 3 },
  sevSegTxt: { fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  sevDesc: { fontSize: 11.5, marginTop: 6, marginBottom: 14 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  errorTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  codeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 13, fontWeight: '700' },
  codeSub: { fontSize: 11, marginTop: 2 },
  priceBadge: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priceBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#16A34A' },

  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500', minHeight: 80, textAlignVertical: 'top' },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  iconBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 13.5, fontWeight: '700' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14 },
  saveTxt: { fontSize: 14, fontWeight: '700' },

  // Two stacked photo sections (Before, then After — always both visible,
  // no toggle) — grid sizing (72×72, 12 radius, dashed add-tile) matches
  // asset/[assetId].tsx's own top-level Photos section exactly
  // (s.photoRow/photoThumbWrap/photoAddTile there), so this reads as the
  // same established pattern, not a new one.
  photoSectionBlock: { marginTop: 14 },
  photoHint: { fontSize: 11, marginTop: 1, marginBottom: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoAddTile: { width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  thumbWrap: { width: 72, height: 72, borderRadius: 12, position: 'relative' },
  thumb: { width: '100%', height: '100%', borderRadius: 12 },
  thumbDel: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  resolvedTxt: { fontSize: 13, fontWeight: '600', flex: 1 },
});
