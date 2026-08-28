// Root layout — providers, theme, toast. NO navigation logic here.
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text, AppState, AppStateStatus, Platform, Animated } from 'react-native';
import { Slot, ErrorBoundaryProps } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';

import { useAuthStore } from '@/store/authStore';
import { initializeSchema, cleanOldSyncQueueItems, resetStaleFailedSyncItems } from '@/lib/database';
import { configureNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import Colors, { T } from '@/constants/Colors';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';

SplashScreen.preventAutoHideAsync();


// SiteTrack has one light theme — used regardless of system preference.
const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:      Colors.theme.primary,
    secondary:    Colors.theme.accent,
    background:   Colors.theme.background,
    surface:      Colors.theme.surface,
    error:        Colors.theme.error,
    onPrimary:    Colors.theme.textOnPrimary,
    onBackground: Colors.theme.text,
    onSurface:    Colors.theme.text,
  },
};


export default function RootLayout() {
  const { isLoading, restoreSession } = useAuthStore();

  // ── Screenshot / Screen-capture prevention ─────────────────────────────────
  // Android: FLAG_SECURE is set natively in MainActivity.kt (blocks at OS level)
  // iOS + JS layer: expo-screen-capture blocks screen recording
  // iOS app-switcher: AppState blur overlay hides content when app backgrounds
  const [isObscured, setIsObscured] = useState(false);
  const obscureOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Re-enabled screen capture prevention for production build.
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // On iOS, show a solid overlay when the app goes to background so the OS
    // cannot capture a screenshot of sensitive content in the app switcher.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'inactive' || nextState === 'background') {
        setIsObscured(true);
        Animated.timing(obscureOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      } else {
        Animated.timing(obscureOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
          setIsObscured(false)
        );
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [obscureOpacity]);
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Initialise local SQLite then restore session — MUST be sequential.
  //    On a fresh install, restoreSession() can trigger loadJobs() → SQLite queries
  //    before the schema tables exist if both effects run in parallel (CRIT-3 race condition).
  useEffect(() => {
    (async () => {
      try {
        initializeSchema();
        cleanOldSyncQueueItems();
        // Give any permanently-failed sync items a fresh retry budget on startup.
        // Better than clearing them — data that failed due to a transient issue
        // (RLS policy lag, momentary offline) gets another chance to reach the server.
        resetStaleFailedSyncItems();
      } catch (e) {
        console.error('[DB] Schema init error:', e);
      }
      // Session restore MUST come after schema is ready
      await restoreSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Configure notification handler + request permission
  useEffect(() => {
    configureNotificationHandler();
    requestNotificationPermission();
  }, []);

  // Hide splash once loading is complete. MUST be above the conditional early-return
  // so React Hooks are always called in the same order (rules-of-hooks).
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Single theme — field service app.
  const theme = paperTheme;

  // Show a blank loading screen while session is being restored.
  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
            <StatusBar style="dark" />
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <Slot />
          <StatusBar style="dark" />
          <Toast />
          <ConfirmDialogHost />
          {/* iOS app-switcher screenshot shield */}
          {isObscured && (
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.screenshotShield,
                { opacity: obscureOpacity },
              ]}
              pointerEvents="none"
            />
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.surface, padding: 24 }}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={T.danger} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: T.textPrimary, marginTop: 16, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: T.textSecondary, marginTop: 8, textAlign: 'center', marginBottom: 24 }}>An unexpected error occurred while loading this module.</Text>
      <TouchableOpacity 
        onPress={retry}
        style={{ backgroundColor: T.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: T.textOnPrimary, fontWeight: '700' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenshotShield: {
    backgroundColor: T.background,
    zIndex: 9999,
  },
});
