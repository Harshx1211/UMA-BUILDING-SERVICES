// Stack layout for asset detail screens — prevents /assets/[id] from appearing as a tab
import { Stack } from 'expo-router';

export default function AssetsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
