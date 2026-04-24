/**
 * useColors — returns the correct colour palette based on system colour scheme.
 *
 * Returns `typeof Colors.light` (the concrete type) because both the light and
 * dark themes share an identical set of keys. This means every colour token —
 * including cardBorder, successDark, accentDark, etc. — is fully typed with no
 * `as any` casts needed anywhere in the codebase.
 *
 * Usage:  const C = useColors();   →  C.primary, C.cardBorder, C.successDark …
 */
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';

export function useColors(): typeof Colors.light {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
