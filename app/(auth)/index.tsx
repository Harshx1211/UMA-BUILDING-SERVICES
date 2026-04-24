// Splash screen — animated double-circle logo with ActivityIndicator loading
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { APP_NAME } from '@/constants/Config';

export default function SplashScreen() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const C = useColors();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(app)/');
      } else {
        router.replace('/(auth)/login');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated]);

  return (
    <View style={[styles.container, { backgroundColor: C.primary }]}>
      {/* ── Logo ─────────────────── */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        {/* Outer translucent ring */}
        <View style={styles.logoOuter}>
          {/* Inner solid circle */}
          <View style={[styles.logoInner, { backgroundColor: C.accent, shadowColor: C.accent }]}>
            <Text style={styles.logoLetters}>ST</Text>
          </View>
        </View>

        {/* App name */}
        <Text style={styles.appName}>{APP_NAME}</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Field Service, Simplified</Text>
      </Animated.View>

      {/* ── Loading indicator ─────── */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footer}>
        <ActivityIndicator size="small" color={C.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 0,
  },
  // Double-circle logo
  logoOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logoLetters: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 16,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
    marginTop: 8,
  },
  // Bottom loading area
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
