// Stack layout for property detail screens — prevents /properties/[id] from appearing as a tab
import { Stack } from 'expo-router';

export default function PropertiesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
