/**
 * BrandLogo — single source of truth for the SiteTrack logo mark.
 *
 * Used on the start-up screen, the loading screen, sign in and the app-lock
 * screen, so the mark is always the same. Approved redesign (Stitch,
 * 16 Oct 2026 — stitch-designs/README.md): a flame on a soft orange tile,
 * "SiteTrack" and "UMA Building Services" underneath. Two sizes:
 *   "large"  — start-up / loading / app lock (64 px tile)
 *   "medium" — sign in (48 px tile)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/AppText';
import { T } from '@/constants/Colors';
import { APP_NAME } from '@/constants/Config';

interface BrandLogoProps {
  /** 'large' = start-up and lock screens, 'medium' = sign in */
  size?: 'large' | 'medium';
  /** Line under the name. Defaults to the company name. */
  tagline?: string;
  /** Pass false to show the mark only (no name or tagline) */
  showWordmark?: boolean;
  /** Colour for the name — defaults to navy */
  textColor?: string;
}

/** Soft orange behind the flame (approved spec #FFEBDD). */
const TILE = T.primary + '1F';

export function BrandLogo({
  size = 'medium',
  tagline = 'UMA Building Services',
  showWordmark = true,
  textColor = T.textPrimary,
}: BrandLogoProps) {
  const isLarge = size === 'large';
  const tile = isLarge ? 64 : 48;

  return (
    <View style={styles.wrapper} accessibilityLabel={`${APP_NAME} logo`}>
      <View style={[styles.tile, { width: tile, height: tile, borderRadius: isLarge ? 20 : 16, backgroundColor: TILE }]}>
        <MaterialCommunityIcons name="fire" size={isLarge ? 36 : 28} color={T.primary} />
      </View>

      {showWordmark && (
        <View style={styles.wordmark}>
          <Text style={[styles.appName, { fontSize: isLarge ? 24 : 22, color: textColor }]}>{APP_NAME}</Text>
          {tagline ? <Text style={[styles.tagline, { color: T.textSecondary }]}>{tagline}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  wordmark: { alignItems: 'center', marginTop: 12, gap: 2 },
  appName: { fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  tagline: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
});
