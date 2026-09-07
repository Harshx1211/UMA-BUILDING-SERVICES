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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { DefectSeverity } from '@/constants/Enums';
import { findDefectCode } from '@/constants/DefectCodes';
import type { DefectCode } from '@/constants/DefectCodes';
import DefectCodePicker from '@/components/defects/DefectCodePicker';

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

export interface DefectFieldsValue {
  severity: DefectSeverity;
  description: string;
  defectCode: string | null;
  quotePrice: number | null;
}

interface Props {
  /** null/undefined = a brand-new, not-yet-saved defect. */
  initial?: { severity: DefectSeverity; description: string; defect_code: string | null; quote_price: number | null } | null;
  onSave: (value: DefectFieldsValue) => void;
  /** Only offered for an already-saved defect. */
  onDelete?: () => void;
  /** Only offered on the asset's primary defect. */
  onReplace?: (value: DefectFieldsValue) => void;
  /** Only offered while creating/editing — discards the draft, nothing saved. */
  onCancel?: () => void;
  /** Fires on every field change — lets the asset screen keep its
   * leave-without-saving safety net working for the primary defect. */
  onDraftChange?: (value: DefectFieldsValue) => void;
  saving?: boolean;
  saveLabel?: string;
}

export function DefectFieldsCard({
  initial, onSave, onDelete, onReplace, onCancel, onDraftChange, saving, saveLabel = 'Save Defect',
}: Props) {
  const C = useColors();
  const [severity, setSeverity] = useState<DefectSeverity>(initial?.severity ?? DefectSeverity.NonConformance);
  const [severityExpanded, setSeverityExpanded] = useState(false);
  const [codePickerVisible, setCodePickerVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(
    () => (initial?.defect_code ? findDefectCode(initial.defect_code) ?? null : null)
  );
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(initial?.quote_price ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState(false);

  // Reports the live draft up on every change, without the parent needing to
  // own this state itself — used only by the primary defect's blur-flush.
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current?.({ severity, description, defectCode: selectedCode?.code ?? null, quotePrice: suggestedPrice });
  }, [severity, description, selectedCode, suggestedPrice]);

  // FIX: tracks whether the severity reflects an explicit choice — either
  // an existing defect's already-saved severity (a real prior decision, not
  // a placeholder) or one the technician has picked in this session.
  // handleCodeSelect below must never silently override either.
  const severityTouchedRef = useRef(!!initial);

  const handleSelectSeverity = (v: DefectSeverity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    severityTouchedRef.current = true;
    setSeverity(v);
    setSeverityExpanded(false);
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
    severity, description: description.trim(), defectCode: selectedCode?.code ?? null, quotePrice: suggestedPrice,
  });

  const validate = (): boolean => {
    if (!description.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      return false;
    }
    setError(false);
    return true;
  };

  const current = SEVERITIES.find((sv) => sv.value === severity) ?? SEVERITIES[0];
  const currentColor = severityColor(current.value, C);

  return (
    <View style={[s.card, { backgroundColor: C.errorLight, borderColor: C.error + '40' }]}>
      <Text style={[s.label, { color: C.textTertiary }]}>Severity</Text>
      <TouchableOpacity
        style={[s.dropdown, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSeverityExpanded((v) => !v); }}
        activeOpacity={0.75}
        disabled={saving}
      >
        <View style={[s.dropdownIconWrap, { backgroundColor: currentColor + '18' }]}>
          <MaterialCommunityIcons name={current.icon} size={18} color={currentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.dropdownLabel, { color: C.text }]}>{current.label}</Text>
          <Text style={[s.dropdownDesc, { color: C.textTertiary }]}>{current.desc}</Text>
        </View>
        <MaterialCommunityIcons name={severityExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={C.textTertiary} />
      </TouchableOpacity>

      {severityExpanded && (
        <View style={[s.options, { backgroundColor: C.surface, borderColor: C.border }]}>
          {SEVERITIES.map((sev, i) => {
            const active = severity === sev.value;
            const color = severityColor(sev.value, C);
            return (
              <TouchableOpacity
                key={sev.value}
                style={[s.optionRow, i > 0 && { borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                onPress={() => handleSelectSeverity(sev.value)}
                activeOpacity={0.7}
              >
                <View style={[s.dropdownIconWrap, { backgroundColor: color + '18' }]}>
                  <MaterialCommunityIcons name={sev.icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.dropdownLabel, { color: C.text }]}>{sev.label}</Text>
                  <Text style={[s.dropdownDesc, { color: C.textTertiary }]}>{sev.desc}</Text>
                </View>
                {active && <MaterialCommunityIcons name="check" size={20} color={color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
          <TouchableOpacity
            style={[s.replaceBtn, { backgroundColor: C.warning + '18', borderColor: C.warning }]}
            onPress={() => { if (validate()) onReplace(currentValue()); }}
            activeOpacity={0.8}
            disabled={saving}
          >
            <MaterialCommunityIcons name="tools" size={16} color={C.warning} />
            <Text style={[s.replaceTxt, { color: C.warning }]}>Replace</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: C.error }]}
          onPress={() => { if (validate()) onSave(currentValue()); }}
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
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },

  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  dropdownIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dropdownLabel: { fontSize: 14, fontWeight: '700' },
  dropdownDesc: { fontSize: 12, marginTop: 1 },
  options: { borderRadius: 12, borderWidth: 1, marginTop: -6, marginBottom: 14, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },

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
  replaceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  replaceTxt: { fontSize: 13.5, fontWeight: '700' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14 },
  saveTxt: { fontSize: 14, fontWeight: '700' },
});
