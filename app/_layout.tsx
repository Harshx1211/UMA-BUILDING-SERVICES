// Root layout — providers, theme, toast. NO navigation logic here.
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text, AppState, AppStateStatus, Platform, Animated } from 'react-native';
import { Slot, ErrorBoundaryProps } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { FONT_FILES, setFontsReady } from '@/constants/Fonts';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/ui/AppToast';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { AppLockScreen } from '@/components/AppLockScreen';

import { useAuthStore } from '@/store/authStore';
import { initializeSchema, cleanOldSyncQueueItems, resetStaleFailedSyncItems } from '@/lib/database';
import { configureNotificationHandler } from '@/lib/notifications';
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

// A remembered session re-locks after this long in the background (see
// authStore's "Remembered session + device lock" notes). Short trips out —
// the camera, the document scanner, the photo picker, a quick call — stay
// well under it.
const LOCK_AFTER_MS = 5 * 60 * 1000;


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

// Same theme with Paper's own components (buttons, chips, inputs) in Public Sans.
const paperThemeWithFonts = {
  ...paperTheme,
  fonts: configureFonts({ config: { fontFamily: 'PublicSans_400Regular' } }),
};

export default function RootLayout() {
  const { isLoading, restoreSession, isAuthenticated, isLocked } = useAuthStore();

  // App fonts (constants/Fonts.ts). The splash screen stays up until they've
  // loaded; if they fail, the app carries on in the system font.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const fontsSettled = fontsLoaded || !!fontError;
  if (fontsSettled) setFontsReady(fontsLoaded);

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

  // Re-lock after LOCK_AFTER_MS away. Only a real 'background' counts as
  // leaving: iOS also reports 'inactive' while the Face ID prompt itself is
  // on screen, which would otherwise make the lock re-trigger itself.
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundedAt = Date.now();
      } else if (next === 'active' && backgroundedAt != null) {
        const away = Date.now() - backgroundedAt;
        backgroundedAt = null;
        if (away >= LOCK_AFTER_MS) void useAuthStore.getState().lockIfRemembered();
      }
    });
    return () => sub.remove();
  }, []);

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

  // 3. Configure notification handler. The permission prompt itself is
  // asked once the technician is signed in (app/(app)/_layout.tsx) — asking
  // on the sign-in screen, before they're even in, is the pattern app stores
  // and users both treat as pushy.
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // Hide splash once loading is complete. MUST be above the conditional early-return
  // so React Hooks are always called in the same order (rules-of-hooks).
  useEffect(() => {
    if (!isLoading && fontsSettled) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, fontsSettled]);

  // Single theme — field service app.
  const theme = fontsLoaded ? paperThemeWithFonts : paperTheme;

  // FIX: the native splash screen shows the SiteTrack brand mark
  // (app.json's splash-icon.png); the instant JS took over, this branch
  // replaced it with a bare spinner on a plain background — no mark at
  // all — until restoreSession() resolved and the login screen (which
  // re-introduces the same BrandLogo) mounted. The mark flickered out and
  // back in across one continuous "app is opening" moment. Keeping it
  // visible through the auth-check phase reads as one smooth transition
  // instead of splash -> blank -> login.
  if (!fontsSettled) return null; // splash screen still showing

  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
              <BrandLogo size="large" />
              <ActivityIndicator color={theme.colors.primary} size="small" style={{ marginTop: 32 }} />
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
          <Toast config={toastConfig} />
          <ConfirmDialogHost />
          {/* Last, so it covers every screen, toast and dialog above. */}
          {isAuthenticated && isLocked && <AppLockScreen />}
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
        <Text style={{ color: T.textOnPrimary, fontWeight: '700' }}>Try again</Text>
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
