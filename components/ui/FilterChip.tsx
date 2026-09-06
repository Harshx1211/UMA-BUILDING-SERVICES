/**
 * FilterChip — the multi-select "toggle pill" used by every filter modal in
 * the app (originally private to InspectionFilterModal, extracted so a
 * second filter modal — e.g. for the Jobs list — can reuse the exact same
 * component and semantics instead of duplicating it).
 */
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function FilterChip({
  label, displayLabel, active, onPress,
}: {
  label: string;
  displayLabel?: string;
  active: boolean;
  onPress: () => void;
}) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        { backgroundColor: active ? C.primary : C.background, borderColor: active ? C.primary : C.border },
      ]}
    >
      {active && <MaterialCommunityIcons name="check" size={13} color="#fff" style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, { color: active ? '#fff' : C.textSecondary }]} numberOfLines={1}>{displayLabel ?? label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Multi-select: options[0] is always the "All" catch-all label (the caller
 * builds it as [ALL, ...values]) — tapping it clears the selection; tapping
 * any other value toggles it in/out of the array.
 */
export function chipsForMulti(
  options: string[],
  value: string[],
  onChange: (v: string[]) => void,
  formatLabel?: (v: string) => string,
): React.ReactNode[] {
  return options.map((o, i) => {
    const isAllOption = i === 0;
    const active = isAllOption ? value.length === 0 : value.includes(o);
    const toggle = () => {
      if (isAllOption) { onChange([]); return; }
      onChange(value.includes(o) ? value.filter(v => v !== o) : [...value, o]);
    };
    return <FilterChip key={o} label={o} displayLabel={formatLabel?.(o)} active={active} onPress={toggle} />;
  });
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});
