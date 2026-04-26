// components/ui/FilterPills.tsx
// Clean segmented control — professional tab-style filter
import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ViewStyle } from 'react-native';
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
        ? {
            backgroundColor: C.backgroundSecondary,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.border,
          }
        : { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10 },
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
                  {
                    backgroundColor: isDark ? C.surface : '#FFFFFF',
                    borderColor: isDark ? C.border : 'transparent',
                    borderWidth: isDark ? 1 : 0,
                    shadowColor: '#0D1526',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ],
              ]}
              onPress={() => onSelect(i)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color: isActive
                      ? (isDark ? C.primary : C.primary)
                      : (isDark ? C.textSecondary : 'rgba(255,255,255,0.75)'),
                  },
                  isActive && styles.activePillText,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {/* Active underline accent */}
              {isActive && isDark && (
                <View style={[styles.activeUnderline, { backgroundColor: C.accent }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  activePill: {
    borderRadius: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activePillText: {
    fontWeight: '700',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 4,
    left: '30%',
    right: '30%',
    height: 2,
    borderRadius: 1,
  },
});
