/**
 * useColors — always returns the Daylight Standard palette.
 *
 * SiteTrack is a field-service app designed for technicians working on-site,
 * often reading pass/fail results outdoors in direct sun. The bright,
 * high-contrast light theme matching the Project Work prototype and the
 * app.json setting of userInterfaceStyle: "light" is the single design
 * language across the whole app.
 *
 * We do NOT switch themes based on system preferences — the app always
 * looks the same to keep a consistent field-app experience.
 *
 * Usage:  const C = useColors();  →  C.primary, C.surface, C.accent …
 */
import Colors from '@/constants/Colors';

export function useColors(): typeof Colors.theme {
  return Colors.theme;
}
