import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { AREA_LABEL, type AssetArea } from '@/utils/assetHelpers';

/**
 * "Where is it?  Common Area | Unit (SOU)" — shown when adding or editing an
 * asset whose type is serviced under a separate routine inside units (the
 * type has a unit routine in the catalogue: pre-filled for fire doors, fire
 * detection devices and extinguishers; admins can set it on any type in the
 * admin portal's Catalogue). Renders nothing for any other type.
 */
export function AreaSwitch({
  typeDef,
  area,
  onChange,
}: {
  typeDef: { unitInspectionRoutine?: string | null } | null | undefined;
  area: AssetArea;
  onChange: (area: AssetArea) => void;
}) {
  const C = useColors();
  if (!typeDef?.unitInspectionRoutine) return null;

  const option = (value: AssetArea) => {
    const selected = area === value;
    return (
      <TouchableOpacity
        key={value}
        onPress={() => {
          if (selected) return;
          Haptics.selectionAsync();
          onChange(value);
        }}
        style={[s.segment, selected && { backgroundColor: C.primary }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        activeOpacity={0.8}
      >
        <Text style={[s.segmentTxt, { color: selected ? T.textOnPrimary : C.textSecondary }]}>{AREA_LABEL[value]}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: C.text }]}>Where is it?</Text>
      <View style={[s.track, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]} accessibilityRole="radiogroup">
        {option('common')}
        {option('unit')}
      </View>
      <Text style={[s.hint, { color: C.textTertiary }]}>
        Items inside a unit (SOU) are serviced and reported under their own routine.
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
