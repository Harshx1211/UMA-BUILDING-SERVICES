/**
 * SiteTrack — Single Design Token Source of Truth
 *
 * SiteTrack uses one light theme — "Daylight Standard": bright, high-contrast,
 * built for technicians reading pass/fail results outdoors in direct sun.
 * There is no dark mode. useColors() always returns this palette.
 *
 * Rule: Every color in the app must trace back to one of these tokens.
 * No hardcoded hex values outside this file — ever.
 */

// ─── Raw Palette (do not use these directly in components) ────────────────────
// Values follow the approved Stitch redesign (stitch-designs/README.md, 16 Oct 2026).
const palette = {
  // Brand navy ("ink") — matches brand/README.md exactly. Now used for text
  // and icons rather than backgrounds.
  navy800: '#111D3F',
  navy500: '#47526B',

  // Flame Orange (brand accent / primary CTA) — matches brand/README.md exactly.
  orange500: '#D4561A',
  orange400: '#E86A28',
  orangeDark: '#B8460F',

  slate400: '#8A94A6',
  slate300: '#CBD5E1',
  slate200: '#E4E8EE',
  slate100: '#F1F5F9',

  white: '#FFFFFF',
  black: '#000000',
  /** Page background — a hair off pure white so cards have something to sit on */
  paper: '#F2F4F7',

  green600: '#15803D',
  green700: '#166534',
  greenBg:  '#E8F6EC',

  amber600: '#B45309',
  amber700: '#92400E',
  amberBg:  '#FEF3C7',

  red600: '#DC2626',
  red700: '#B91C1C',
  redBg:  '#FEE2E2',

  blue600: '#1E3A8A',
  blueBg:  '#EEF1F7',
  blueDark: '#1E3A8A',
};

// ─── Semantic Tokens (use ONLY these in all components/screens) ───────────────
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  /** App root background — near-white page */
  background:        palette.paper,
  /** Card / container surface — pure white, pops off the page background */
  surface:           palette.white,
  /** Elevated modals / bottom sheets */
  surfaceElevated:   palette.white,
  /** Input fields, chips, pill backgrounds — a recessed neutral fill */
  surfaceInput:      palette.slate100,

  // ── Borders ──────────────────────────────────────────────────────────────
  /** Default subtle border for cards, inputs */
  border:            palette.slate200,
  /** Slightly stronger border for focused inputs */
  borderStrong:      palette.slate300,

  // ── Text (3 tiers only — use nothing else) ───────────────────────────────
  /** Primary text — brand navy ink, headings and values */
  textPrimary:       palette.navy800,
  /** Secondary text — body copy, descriptions */
  textSecondary:     palette.navy500,
  /** Muted text — labels, timestamps, eyebrows, placeholders */
  textMuted:         palette.slate400,

  // ── Brand / Primary Action ────────────────────────────────────────────────
  /**
   * Flame Orange — RESERVED for:
   * - Primary CTA buttons only ("Start Job", "Save", "Complete")
   * - The single active-state indicator (tab bar, focused input highlight)
   * Do NOT use for icons, decoration, or stat numbers.
   */
  primary:           palette.orange500,
  primaryPressed:    palette.orange400,
  /** Fixed white — text/icons placed on a solid primary/success/danger fill. Never theme-dependent. */
  textOnPrimary:     palette.white,

  /** Absolute black — camera viewfinder backgrounds, iOS shadowColor. Not a themed surface tone. */
  black:             palette.black,
  /**
   * Full-screen photo/document VIEWER background — a lightbox or scan
   * preview's own backdrop, not a "dim the page behind a sheet" scrim
   * (that's T.overlay/C.overlay, a different, lighter role). Near-opaque:
   * there's nothing to see "behind" a full-screen media viewer.
   */
  viewerBackground:  palette.black + 'EB', // 92% opacity
  /**
   * Floating semi-transparent control button sitting on top of live
   * camera/photo content (a delete/close/shutter button over an image) —
   * needs to stay visible against any photo content, so it's a
   * deliberately different (lighter) opacity than the viewer background.
   */
  controlButtonBg:   palette.black + '99', // 60% opacity
  /** Card/element drop shadow tint — navy-tinted, not pure black. */
  shadow:            'rgba(17, 29, 63, 0.14)',
  /** "Dim the page behind a modal/sheet" scrim — lets content underneath
   * still read through. Different role than viewerBackground above. */
  overlay:           'rgba(17, 29, 63, 0.45)',

  // ── Status Colors (strictly semantic — one purpose each) ─────────────────
  /** Green — completed / passed / positive states only */
  success:           palette.green600,
  successBg:         palette.greenBg,
  successDark:       palette.green700,

  /** Amber — pending / attention / warning states only */
  warning:           palette.amber600,
  warningBg:         palette.amberBg,
  warningDark:       palette.amber700,

  /**
   * Red — hazards / failed inspections / destructive actions only
   * (formerly "error" — renamed for semantic clarity)
   */
  danger:            palette.red600,
  dangerBg:          palette.redBg,
  dangerDark:        palette.red700,

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
  radiusCard:    14,
  /** Buttons, text inputs */
  radiusButton:  12,
  /** Chips, status pills — fully rounded */
  radiusPill:    999,

  // ── Icon Tint Rule ────────────────────────────────────────────────────────
  /**
   * Icon circle background = iconColor at 15% opacity.
   * Applied uniformly everywhere an icon sits in a circle bg.
   * Usage: { backgroundColor: T.iconBg(T.textMuted) }
   */
  iconBg: (color: string) => color + '26', // 26 hex = 15% opacity

  // ── Other Tint Rules ─────────────────────────────────────────────────────
  // FIX: these 3 roles were each being hand-rolled with a different literal
  // hex alpha suffix in nearly every screen that needed them — 17 distinct
  // values found across the app for what were, in every case, one of these
  // 3 conceptual roles. Consolidated to one deliberate value per role.
  /**
   * Selected/active card or chip background — a very light wash so the
   * card's own content (icon, text) still reads clearly on top of it.
   * Usage: { backgroundColor: T.selectedBg(C.primary) }
   */
  selectedBg: (color: string) => color + '10', // ~6% opacity
  /**
   * Badge/pill/chip/banner fill — a color-coded label's background (a
   * status badge, a priced-item pill, an info banner). Stronger than
   * selectedBg since these are meant to be read as a distinct colored
   * label, not a subtle wash.
   * Usage: { backgroundColor: T.tintBg(C.success) }
   */
  tintBg: (color: string) => color + '20', // ~12.5% opacity
  /** The matching border for tintBg — same color, stronger. */
  tintBorder: (color: string) => color + '40', // 25% opacity
} as const;

// Colors.theme is the one active palette — useColors() reads from here.
const Colors = {
  theme: {
    primary:             T.primary,
    primaryLight:        T.primaryPressed,
    primaryDark:         palette.orangeDark,
    accent:              T.primary,           // alias — screens using C.accent get orange
    accentLight:         T.primaryPressed,
    accentDark:          palette.orangeDark,

    background:          T.background,
    backgroundSecondary: T.surfaceInput,
    backgroundTertiary:  T.surfaceInput,
    surface:             T.surface,
    surfaceElevated:     T.surfaceElevated,
    cardBorder:          T.border,

    text:                T.textPrimary,
    textSecondary:       T.textSecondary,
    textTertiary:        T.textMuted,
    textInverse:         palette.white,       // text on a dark-filled element (e.g. a navy chip)
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
    infoDark:            palette.blueDark,

    tint:                T.primary,
    icon:                T.textSecondary,
    // NOTE: intentionally NOT aliased to T.border — a hairline border color
    // is nearly invisible used as an icon tint against a light background.
    tabIconDefault:      T.textMuted,
    tabIconSelected:     T.primary,
    shadow:              T.shadow,
    overlay:             T.overlay,
    viewerBackground:    T.viewerBackground,
    controlButtonBg:     T.controlButtonBg,
  },
};

export default Colors;
