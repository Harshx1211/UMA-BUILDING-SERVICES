// Main app tab navigator — white tab bar, navy active tint, 68px height
import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { startSync } from '@/lib/sync';
import Colors from '@/constants/Colors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => { startSync(); }, []);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.2,
        },
      }}
    >
      {/* ── The 4 real tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) =>
            <TabIcon name={focused ? 'view-dashboard' : 'view-dashboard-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size, focused }) =>
            <TabIcon name={focused ? 'briefcase-check' : 'briefcase-check-outline'} color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) =>
            <TabIcon name={focused ? 'account-circle' : 'account-circle-outline'} color={color} size={size} />,
        }}
      />

      {/* ── Hidden groups — prevents folders from becoming tabs ── */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="properties" options={{ href: null }} />
      <Tabs.Screen name="assets"     options={{ href: null }} />
    </Tabs>
  );
}
