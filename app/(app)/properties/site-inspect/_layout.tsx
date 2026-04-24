// Transparent layout — lets the parent properties Stack handle navigation
// Having a nested Stack here causes router.push to fail silently.
import { Slot } from 'expo-router';

export default function SiteInspectLayout() {
  return <Slot />;
}
