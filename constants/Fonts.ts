// App fonts (approved Stitch redesign, 16 Oct 2026 — stitch-designs/README.md):
// Hanken Grotesk for headings, Public Sans for everything else.
//
// React Native can't pick a weight inside one custom font family the way the
// web does (Android in particular ignores fontWeight for a custom family), so
// each weight is its own family name and `fontFor` maps a style's
// fontWeight/fontSize to the right one. Used by components/ui/AppText.tsx,
// which every screen's <Text> goes through.
import {
  PublicSans_400Regular, PublicSans_400Regular_Italic, PublicSans_500Medium,
  PublicSans_600SemiBold, PublicSans_700Bold, PublicSans_800ExtraBold,
} from '@expo-google-fonts/public-sans';
import { HankenGrotesk_600SemiBold, HankenGrotesk_700Bold, HankenGrotesk_800ExtraBold } from '@expo-google-fonts/hanken-grotesk';
import type { TextStyle } from 'react-native';

/** Passed to expo-font's useFonts in app/_layout.tsx. */
export const FONT_FILES = {
  PublicSans_400Regular, PublicSans_400Regular_Italic, PublicSans_500Medium,
  PublicSans_600SemiBold, PublicSans_700Bold, PublicSans_800ExtraBold,
  HankenGrotesk_600SemiBold, HankenGrotesk_700Bold, HankenGrotesk_800ExtraBold,
};

let ready = false;
/** Set once the font files have loaded. Until then (or if loading failed)
 * text keeps the system font instead of naming a family that isn't there. */
export function setFontsReady(value: boolean): void { ready = value; }
export function fontsReady(): boolean { return ready; }

type Weight = 400 | 500 | 600 | 700 | 800;

function weightOf(w: TextStyle['fontWeight']): Weight {
  if (w === 'bold') return 700;
  const n = typeof w === 'number' ? w : parseInt(String(w ?? '400'), 10);
  if (!Number.isFinite(n) || n <= 400) return 400;
  if (n <= 500) return 500;
  if (n <= 600) return 600;
  if (n <= 700) return 700;
  return 800;
}

const BODY: Record<Weight, string> = {
  400: 'PublicSans_400Regular', 500: 'PublicSans_500Medium', 600: 'PublicSans_600SemiBold',
  700: 'PublicSans_700Bold', 800: 'PublicSans_800ExtraBold',
};
const HEADING: Partial<Record<Weight, string>> = {
  600: 'HankenGrotesk_600SemiBold', 700: 'HankenGrotesk_700Bold', 800: 'HankenGrotesk_800ExtraBold',
};

/** Headings: 16 pt and up at semibold or more (card titles, screen titles, big numbers). */
const HEADING_MIN_SIZE = 16;

/**
 * The font for a (flattened) text style: { fontFamily, fontWeight: 'normal' }
 * so the platform doesn't apply a second, synthetic bold on top. Null when
 * the style names its own family (monospace, icon fonts) or fonts aren't
 * ready — the text then renders exactly as before.
 */
export function fontFor(style: TextStyle | undefined): Pick<TextStyle, 'fontFamily' | 'fontWeight'> | null {
  if (!ready || style?.fontFamily) return null;
  const w = weightOf(style?.fontWeight);
  if (style?.fontStyle === 'italic' && w <= 500) return { fontFamily: 'PublicSans_400Regular_Italic', fontWeight: 'normal' };
  const heading = (style?.fontSize ?? 14) >= HEADING_MIN_SIZE ? HEADING[w] : undefined;
  return { fontFamily: heading ?? BODY[w], fontWeight: 'normal' };
}
