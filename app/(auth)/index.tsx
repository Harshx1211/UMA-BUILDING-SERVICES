// Splash screen — uses shared BrandLogo, routes to app or login after session check
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { T } from '@/constants/Colors';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function SplashScreen() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const noMotion = useReducedMotion();

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
    <View style={[styles.container, { backgroundColor: T.background }]}>
      {/* ── Logo ─────────────────── */}
      <Animated.View entering={noMotion ? undefined : FadeIn.duration(600)} style={styles.content}>
        <BrandLogo size="large" textColor={T.textPrimary} />
      </Animated.View>

      {/* ── Loading indicator ─────── */}
      <Animated.View entering={noMotion ? undefined : FadeInDown.delay(400).duration(400)} style={styles.footer}>
        {/* Logo plus a quiet spinner — no "Loading..." caption, like most apps' start screens. */}
        <ActivityIndicator size="small" color={T.primary} accessibilityLabel="Loading" />
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
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 10,
  },
});
