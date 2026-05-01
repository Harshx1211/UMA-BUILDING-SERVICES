// Main app tab navigator — premium tab bar with active top indicator
import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs, Redirect, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { startSync } from '@/lib/sync';
import { useColors } from '@/hooks/useColors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useJobsStore } from '@/store/jobsStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useCatalogueStore } from '@/store/catalogueStore';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface TabIconProps {
  name: IconName;
  name_active: IconName;
  color: string;
  size: number;
  focused: boolean;
  label: string;
  activeColor: string;
}

function TabIcon({ name, name_active, color, size, focused, label, activeColor }: TabIconProps) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      {focused && (
        <View style={[styles.activeBar, { backgroundColor: activeColor }]} />
      )}
      <MaterialCommunityIcons
        name={focused ? name_active : name}
        size={size}
        color={color}
      />
    </View>
  );
}

export default function AppLayout() {
  const C = useColors();
  const { isAuthenticated, user } = useAuthStore();
  const { subscribeToSync: jobsSubscribe, unsubscribeFromSync: jobsUnsub } = useJobsStore();
  const { subscribeToSync: dashSubscribe, unsubscribeFromSync: dashUnsub } = useDashboardStore();

  const segments = useSegments();
  
  // Only show the tab bar on the three main screens. All detail routes hide it.
  const segs = segments as string[];
  const isMainTab = 
    (segs.length === 1 && segs[0] === '(app)') ||
    (segs.length === 2 && ['index', 'jobs', 'profile'].includes(segs[1])) ||
    (segs.length === 3 && ['index', 'jobs', 'profile'].includes(segs[1]) && segs[2] === 'index');
    
  const hideTabBar = !isMainTab;

  // Always mount the network listener at the root so it fires on ALL tabs
  useNetworkStatus();

  // Start background sync interval on mount (runs immediately + every 60s)
  // NOTE: startSync() is intentionally called AFTER the stores subscribe
  // to sync-complete events (below), so the first sync always triggers a UI reload.

  // When user logs in / session restores:
  //  1. Subscribe stores to auto-reload on every future sync
  //  2. Eagerly load from SQLite cache so the UI isn't blank
  //  3. Start the sync loop (runs immediately + every 60s)
  //     The loop is started AFTER subscribing so the first sync-complete fires correctly
  const { loadJobs } = useJobsStore();
  const { loadDashboard } = useDashboardStore();
  const { load: loadCatalogue } = useCatalogueStore();

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to future sync completions first
    jobsSubscribe(user.id);
    dashSubscribe(user.id);

    // Load whatever is already in the local SQLite cache immediately
    loadJobs(user.id);
    loadDashboard(user.id);
    loadCatalogue();

    // Now start the background sync loop — fires runSync() immediately,
    // then repeats every 60s. The store listeners above are already
    // registered, so the first sync-complete event will reload the UI.
    // Pass user.id directly so sync never has to call getCurrentUser()
    // (which can fail if Supabase auth hasn't hydrated from AsyncStorage yet).
    startSync(user.id);

    return () => {
      jobsUnsub();
      dashUnsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#0D1526',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
          height: Platform.OS === 'ios' ? 82 : 72,
          paddingBottom: Platform.OS === 'ios' ? 22 : 12,
          paddingTop: 2,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      {/* ── The 3 real tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="view-dashboard-outline"
              name_active="view-dashboard"
              color={color}
              size={size}
              focused={focused}
              label="Home"
              activeColor={C.accent}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="briefcase-check-outline"
              name_active="briefcase-check"
              color={color}
              size={size}
              focused={focused}
              label="Schedule"
              activeColor={C.accent}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="account-circle-outline"
              name_active="account-circle"
              color={color}
              size={size}
              focused={focused}
              label="Profile"
              activeColor={C.accent}
            />
          ),
        }}
      />

      {/* ── Hidden routes (no tab bar entry) ── */}
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
      <Tabs.Screen name="properties" options={{ href: null }} />
      <Tabs.Screen name="assets" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="defects/index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
    borderRadius: 10,
    position: 'relative',
    paddingTop: 4,
  },
  tabIconWrapActive: {
    // top bar indicator handles the active state
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2.5,
    borderRadius: 2,
  },
});
