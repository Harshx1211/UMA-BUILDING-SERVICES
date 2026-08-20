// Splash screen — uses shared BrandLogo, routes to app or login after session check
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { BrandLogo } from '@/components/ui/BrandLogo';

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
    <View style={[styles.container, { backgroundColor: T.primary }]}>
      {/* ── Logo ─────────────────── */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <BrandLogo size="large" textColor={T.textPrimary} />
      </Animated.View>

      {/* ── Loading indicator ─────── */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footer}>
        <ActivityIndicator size="small" color={T.textPrimary} />
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
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: T.textPrimary,
    opacity: 0.45,
  },
});
