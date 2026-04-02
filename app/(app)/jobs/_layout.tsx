// Stack layout for all jobs-related screens — prevents sub-routes from appearing as tabs
import { Stack } from 'expo-router';

export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
