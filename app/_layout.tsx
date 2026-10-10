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
import { BrandLogo } from '@/components/ui/BrandLogo';

import { useAuthStore } from '@/store/authStore';
import { initializeSchema, cleanOldSyncQueueItems, resetStaleFailedSyncItems } from '@/lib/database';
import { configureNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import Colors, { T } from '@/constants/Colors';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';

SplashScreen.preventAutoHideAsync();
// FIX (cold-start feels unprofessional): hideAsync() used to just cut the
// native splash away in a single frame the instant auth restore finished —
// whatever was already rendered underneath (a skeleton, a half-mounted tab
// bar) popped into view abruptly instead of the two states handing off
// smoothly. expo-splash-screen's own fade option cross-fades the splash's
// background/logo out over the app's real content instead of an instant cut.
SplashScreen.setOptions({ duration: 400, fade: true });


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
  // FIX: this comment previously claimed FLAG_SECURE was hand-set natively
  // in MainActivity.kt — it isn't; there's no such code there. FLAG_SECURE
  // is set by expo-screen-capture's OWN native module (ScreenCaptureModule.kt)
  // as a side effect of the preventScreenCaptureAsync() call below — the one
  // call below is the entire mechanism, on both platforms:
  // Android: preventScreenCaptureAsync() sets FLAG_SECURE on the window (blocks
  //          screenshots and recent-apps thumbnail at the OS level)
  // iOS:     preventScreenCaptureAsync() blocks screen recording/broadcast
  //          (iOS has no OS-level way to block a plain screenshot — see the
  //          separate AppState overlay below for app-switcher content)
  // iOS app-switcher: AppState blur overlay hides content when app backgrounds
  const [isObscured, setIsObscured] = useState(false);
  const obscureOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // TEMPORARILY DISABLED so screenshots can be taken to report bugs/UI
    // issues during QA. MUST be re-enabled (uncomment the line below,
    // remove allowScreenCaptureAsync()) before any production/release build.
    // ScreenCapture.preventScreenCaptureAsync();
    ScreenCapture.allowScreenCaptureAsync();
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

  // FIX: the native splash screen shows the SiteTrack brand mark
  // (app.json's splash-icon.png); the instant JS took over, this branch
  // replaced it with a bare spinner on a plain background — no mark at
  // all — until restoreSession() resolved and the login screen (which
  // re-introduces the same BrandLogo) mounted. The mark flickered out and
  // back in across one continuous "app is opening" moment. Keeping it
  // visible through the auth-check phase reads as one smooth transition
  // instead of splash -> blank -> login.
  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
              <BrandLogo size="large" showWordmark={false} />
              <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 32 }} />
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
