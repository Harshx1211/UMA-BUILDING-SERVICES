// components/ui/ScreenHeader.tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  showBack?: boolean;
  curved?: boolean;
  eyebrow?: string;
}

export function ScreenHeader({ title, subtitle, rightComponent, showBack = false, curved = true, eyebrow = 'SITETRACK' }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.header,
      { backgroundColor: C.primary, paddingTop: Math.max(insets.top, 14) + 10 },
      !curved && styles.headerNoCurve,
    ]}>
      {/* Decorative circles — same size as main nav screens */}
      <View style={[styles.decor1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={[styles.decor2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {rightComponent ? <View style={styles.right}>{rightComponent}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  headerNoCurve: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 16,
  },
  decor1: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    top: -100, right: -90,
  },
  decor2: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    bottom: -70, left: -50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
