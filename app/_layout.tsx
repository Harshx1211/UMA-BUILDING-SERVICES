// Root layout — providers, theme, toast. NO navigation logic here.
import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { initializeSchema } from '@/lib/database';
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

  // 1. Initialise local SQLite on first launch
  useEffect(() => {
    try { initializeSchema(); } catch (e) { console.error('[DB]', e); }
  }, []);

  // 2. Restore Supabase session (with 5-second timeout inside the store)
  useEffect(() => {
    restoreSession();
  }, []);

  const theme = colorScheme === 'dark' ? paperDarkTheme : paperLightTheme;

  // Show a blank loading screen while session is being restored.
  // The Slot renders NOTHING until isLoading is false, so there is
  // no risk of navigating before the navigator is mounted.
  if (isLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <PaperProvider theme={theme}>
          <View style={[styles.container, { backgroundColor: Colors.light.primary }]}>
            <ActivityIndicator color={Colors.light.accent} size="large" />
          </View>
          <StatusBar style="light" />
        </PaperProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <PaperProvider theme={theme}>
        <Slot />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Toast />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
