/**
 * SiteTrack — Single Design Token Source of Truth
 *
 * SiteTrack is a dark-only field service app. There is no light mode.
 * useColors() always returns this palette.
 *
 * Rule: Every color in the app must trace back to one of these tokens.
 * No hardcoded hex values outside this file — ever.
 */

// ─── Raw Palette (do not use these directly in components) ────────────────────
const palette = {
  navy900: '#0A1525',
  navy800: '#0F1E3C',
  navy700: '#162338',
  navy600: '#1B2D4F',
  navy500: '#243759',
  navy400: '#2D4068',
  navy300: '#3D5280',

  orange500: '#E8650A',
  orange400: '#F07020',

  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',

  white:     '#FFFFFF',

  green600:  '#16A34A',
  green900:  '#14532D',
  greenBg:   'rgba(22,163,74,0.15)',

  amber600:  '#D97706',
  amber900:  '#92400E',
  amberBg:   'rgba(217,119,6,0.15)',

  red600:    '#DC2626',
  red900:    '#991B1B',
  redBg:     'rgba(220,38,38,0.15)',

  blue600:   '#2563EB',
  blueBg:    'rgba(37,99,235,0.12)',
};

// ─── Semantic Tokens (use ONLY these in all components/screens) ───────────────
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  /** App root background — deep navy */
  background:        palette.navy800,
  /** Card / container surface — slightly elevated above background */
  surface:           palette.navy700,
  /** Elevated modals / bottom sheets */
  surfaceElevated:   palette.navy500,
  /** Input fields, chips, pill backgrounds */
  surfaceInput:      palette.navy500,

  // ── Borders ──────────────────────────────────────────────────────────────
  /** Default subtle border for cards, inputs */
  border:            palette.navy400,
  /** Slightly stronger border for focused inputs */
  borderStrong:      palette.navy300,

  // ── Text (3 tiers only — use nothing else) ───────────────────────────────
  /** Primary text — highest contrast, headings and values */
  textPrimary:       palette.white,
  /** Secondary text — body copy, descriptions */
  textSecondary:     palette.slate300,
  /** Muted text — labels, timestamps, eyebrows, placeholders */
  textMuted:         palette.slate400,

  // ── Brand / Primary Action ────────────────────────────────────────────────
  /**
   * Orange — RESERVED for:
   * - Primary CTA buttons only ("Start Job", "Save", "Complete")
   * - The single active-state indicator (tab bar, focused input highlight)
   * Do NOT use for icons, decoration, or stat numbers.
   */
  primary:           palette.orange500,
  primaryPressed:    palette.orange400,

  // ── Status Colors (strictly semantic — one purpose each) ─────────────────
  /** Green — completed / passed / positive states only */
  success:           palette.green600,
  successBg:         palette.greenBg,
  successDark:       palette.green900,

  /** Amber — pending / attention / warning states only */
  warning:           palette.amber600,
  warningBg:         palette.amberBg,
  warningDark:       palette.amber900,

  /**
   * Red — hazards / failed inspections / destructive actions only
   * (formerly "error" — renamed for semantic clarity)
   */
  danger:            palette.red600,
  dangerBg:          palette.redBg,
  dangerDark:        palette.red900,

  /**
   * Blue — navigation links and info-only banners only.
   * Do NOT use for badges, icon backgrounds, or decoration.
   */
  info:              palette.blue600,
  infoBg:            palette.blueBg,

  // ── Spacing Scale (export for shared usage) ───────────────────────────────
  space4:   4,
  space8:   8,
  space12:  12,
  space16:  16,
  space24:  24,
  space32:  32,

  // ── Radius Scale ─────────────────────────────────────────────────────────
  /** Cards, info blocks, list containers */
  radiusCard:    16,
  /** Buttons, text inputs */
  radiusButton:  10,
  /** Chips, status pills — fully rounded */
  radiusPill:    999,

  // ── Icon Tint Rule ────────────────────────────────────────────────────────
  /**
   * Icon circle background = iconColor at 15% opacity.
   * Applied uniformly everywhere an icon sits in a circle bg.
   * Usage: { backgroundColor: T.iconBg(T.textMuted) }
   */
  iconBg: (color: string) => color + '26', // 26 hex = 15% opacity
} as const;

// Keep Colors.dark as an alias so useColors() keeps working without changes
const Colors = {
  dark: {
    primary:             T.primary,
    primaryLight:        T.primaryPressed,
    primaryDark:         palette.navy600,
    accent:              T.primary,           // alias — screens using C.accent get orange
    accentLight:         T.primaryPressed,
    accentDark:          T.primary,

    background:          T.background,
    backgroundSecondary: palette.navy700,
    backgroundTertiary:  T.surfaceInput,
    surface:             T.surface,
    surfaceElevated:     T.surfaceElevated,
    cardBorder:          T.border,

    text:                T.textPrimary,
    textSecondary:       T.textSecondary,
    textTertiary:        T.textMuted,
    textInverse:         palette.navy800,
    textOnPrimary:       palette.white,
    textOnAccent:        palette.white,

    border:              T.border,
    borderStrong:        T.borderStrong,

    success:             T.success,
    successLight:        T.successBg,
    successDark:         T.successDark,
    warning:             T.warning,
    warningLight:        T.warningBg,
    warningDark:         T.warningDark,
    error:               T.danger,
    errorLight:          T.dangerBg,
    errorDark:           T.dangerDark,
    info:                T.info,
    infoLight:           T.infoBg,
    infoDark:            '#1E3A8A',

    tint:                T.primary,
    icon:                T.textSecondary,
    tabIconDefault:      T.border,
    tabIconSelected:     T.primary,
    shadow:              'rgba(0, 0, 0, 0.6)',
    overlay:             'rgba(0, 0, 0, 0.6)',
  },
};

export default Colors;
