/**
 * useColors — always returns the dark navy palette.
 *
 * SiteTrack is a field-service app designed for technicians working on-site.
 * The dark navy theme (#0F1E3C / #182745 / #2D4068 / #E8650A) is the primary
 * design language matching the Project Work prototype and the app.json setting
 * of userInterfaceStyle: "dark".
 *
 * We do NOT switch to the light theme based on system preferences —
 * the app is always dark to maintain consistent field-app aesthetics.
 *
 * Usage:  const C = useColors();  →  C.primary, C.surface, C.accent …
 */
import Colors from '@/constants/Colors';

export function useColors(): typeof Colors.dark {
  return Colors.dark;
}
