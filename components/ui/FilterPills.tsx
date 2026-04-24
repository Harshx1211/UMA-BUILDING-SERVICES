// components/ui/FilterPills.tsx
// Segmented control style filter — clean, no broken shadow on ScrollView content
import React, { useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ViewStyle, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { useColors } from '@/hooks/useColors';

export interface FilterPillOption {
  label: string;
  count?: number;
}

export interface FilterPillsProps {
  options: FilterPillOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  style?: ViewStyle;
  /** 'light' = white active pill on dark/navy track (default, for headers)
   *  'dark'  = navy active pill on white track (for content areas) */
  variant?: 'light' | 'dark';
}

export function FilterPills({ options, activeIndex, onSelect, style, variant = 'light' }: FilterPillsProps) {
  const C = useColors();
  const isDark = variant === 'dark';

  return (
    <View style={[
      styles.track,
      isDark
        ? { backgroundColor: '#FFFFFF', borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }
        : { backgroundColor: 'rgba(255,255,255,0.12)' },
      style,
    ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        bounces={false}
      >
        {options.map((opt, i) => {
          const isActive = i === activeIndex;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.pill,
                isActive && [
                  styles.activePill,
                  { backgroundColor: isDark ? C.primary : '#FFFFFF' },
                ],
              ]}
              onPress={() => onSelect(i)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: isActive
                      ? (isDark ? '#FFFFFF' : C.primary)
                      : (isDark ? C.textSecondary : 'rgba(255,255,255,0.75)') },
                  isActive && styles.activePillText,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 25,
    padding: 3,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activePill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activePillText: {
    fontWeight: '700',
  },
});
