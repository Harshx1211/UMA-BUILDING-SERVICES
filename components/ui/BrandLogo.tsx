/**
 * BrandLogo — single source of truth for the SiteTrack logo mark.
 *
 * Used on every auth screen (splash, login, forgot-password) so the brand
 * mark is always consistent. Two sizes:
 *   "large"  — splash screen (96px circle)
 *   "medium" — login / forgot-password (72px circle)
 *
 * Mark: "ST" double-ring circle + wordmark below.
 * This intentionally matches the splash screen's existing ST-circle design
 * so both screens share the same identity.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '@/constants/Colors';
import { APP_NAME } from '@/constants/Config';

interface BrandLogoProps {
  /** 'large' = splash (96px outer ring), 'medium' = login (72px outer ring) */
  size?: 'large' | 'medium';
  /** Override the tagline text. Defaults to 'Field Service, Simplified' */
  tagline?: string;
  /** Pass false to hide the wordmark + tagline (mark-only mode) */
  showWordmark?: boolean;
  /** Text color for wordmark — defaults to T.textPrimary */
  textColor?: string;
}

export function BrandLogo({
  size = 'medium',
  tagline = 'Field Service, Simplified',
  showWordmark = true,
  textColor = T.textPrimary,
}: BrandLogoProps) {
  const isLarge = size === 'large';

  const outerSize  = isLarge ? 96 : 72;
  const innerSize  = isLarge ? 72 : 54;
  const letterSize = isLarge ? 28 : 21;
  const nameSize   = isLarge ? 32 : 26;

  return (
    <View style={styles.wrapper} accessibilityLabel={`${APP_NAME} logo`}>
      {/* Outer translucent ring */}
      <View
        style={[
          styles.outerRing,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            backgroundColor: T.iconBg(T.primary), // T.primary at ~15% opacity
          },
        ]}
      >
        {/* Inner solid circle */}
        <View
          style={[
            styles.innerCircle,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: T.primary,
              shadowColor: T.primary,
            },
          ]}
        >
          <Text style={[styles.letters, { fontSize: letterSize }]}>ST</Text>
        </View>
      </View>

      {showWordmark && (
        <View style={styles.wordmark}>
          <Text style={[styles.appName, { fontSize: nameSize, color: textColor }]}>
            {APP_NAME}
          </Text>
          {tagline ? (
            <Text style={[styles.tagline, { color: T.textMuted }]}>{tagline}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 0,
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  letters: {
    fontWeight: '800',
    color: T.textOnPrimary,
    letterSpacing: 2,
  },
  wordmark: {
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  appName: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
});
