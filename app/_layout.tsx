// Root layout — providers, theme, toast. NO navigation logic here.
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Slot, ErrorBoundaryProps } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { initializeSchema, cleanOldSyncQueueItems, clearFailedSyncItems } from '@/lib/database';
import { configureNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import Colors from '@/constants/Colors';

const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.primary,
    secondary: Colors.light.accent,
    background: Colors.light.background,
    surface: Colors.light.surface,
    error: Colors.light.error,
    onPrimary: Colors.light.textOnPrimary,
    onBackground: Colors.light.text,
    onSurface: Colors.light.text,
  },
};

const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.dark.primary,
    secondary: Colors.dark.accent,
    background: Colors.dark.background,
    surface: Colors.dark.surface,
    error: Colors.dark.error,
    onPrimary: Colors.dark.textOnPrimary,
    onBackground: Colors.dark.text,
    onSurface: Colors.dark.text,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, restoreSession } = useAuthStore();

  // 1. Initialise local SQLite then restore session — MUST be sequential.
  //    On a fresh install, restoreSession() can trigger loadJobs() → SQLite queries
  //    before the schema tables exist if both effects run in parallel (CRIT-3 race condition).
  useEffect(() => {
    (async () => {
      try {
        initializeSchema();
        cleanOldSyncQueueItems();
        clearFailedSyncItems('job_assets');
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

  const theme = colorScheme === 'dark' ? paperDarkTheme : paperLightTheme;

  // Show a blank loading screen while session is being restored.
  // The Slot renders NOTHING until isLoading is false, so there is
  // no risk of navigating before the navigator is mounted.
  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={[styles.container, { backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator color={theme.colors.secondary} size="large" />
            </View>
            <StatusBar style="light" />
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
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Toast />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 }}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#0E2141', marginTop: 16, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: '#4B5A6E', marginTop: 8, textAlign: 'center', marginBottom: 24 }}>An unexpected error occurred while loading this module.</Text>
      <TouchableOpacity 
        onPress={retry}
        style={{ backgroundColor: '#0E2141', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
