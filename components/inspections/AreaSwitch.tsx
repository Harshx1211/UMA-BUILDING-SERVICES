import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { areaPairOf, areaOf } from '@/utils/assetHelpers';

/**
 * "Common Area | Unit (SOU)" choice for asset types that are serviced under
 * a different AS 1851 routine depending on where they are — today only fire
 * doors ("12 - Passive Fire ... - Common" vs "... - SOU"). The two are
 * separate catalogue types underneath, but the add/edit pickers show ONE
 * "Fire Door" tile and this switch instead of two near-identical tiles.
 *
 * Renders nothing for any other type, or if the company's catalogue lacks
 * either half of the pair.
 */
export function AreaSwitch({
  value,
  availableTypes,
  onChange,
}: {
  value: string;
  availableTypes: ReadonlyArray<{ value: string }>;
  onChange: (typeValue: string) => void;
}) {
  const C = useColors();
  const pair = areaPairOf(value);
  if (!pair) return null;
  const has = (v: string) => availableTypes.some((t) => t.value === v);
  if (!has(pair.common) || !has(pair.unit)) return null;

  const current = areaOf(value);
  const option = (area: 'common' | 'unit', label: string) => {
    const selected = current === area;
    return (
      <TouchableOpacity
        key={area}
        onPress={() => {
          if (selected) return;
          Haptics.selectionAsync();
          onChange(pair[area]);
        }}
        style={[s.segment, selected && { backgroundColor: C.primary }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        activeOpacity={0.8}
      >
        <Text style={[s.segmentTxt, { color: selected ? T.textOnPrimary : C.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: C.text }]}>Where is it?</Text>
      <View style={[s.track, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} accessibilityRole="radiogroup">
        {option('common', 'Common Area')}
        {option('unit', 'Unit (SOU)')}
      </View>
      <Text style={[s.hint, { color: C.textTertiary }]}>
        Common-area doors and doors inside a unit are serviced under separate AS 1851 routines.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 2 },
  track: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentTxt: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 11.5, marginTop: 6, marginLeft: 2, lineHeight: 16 },
});
