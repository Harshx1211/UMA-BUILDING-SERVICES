// UMA BUILDING SERVICES — design token palette
//
// Color philosophy:
//   Dark  → Rich navy blues from the field app prototype  (#0F1E3C base)
//   Light → Clean white/slate for admin/web surfaces
//
// The accent (#E8650A) and status greens/reds are identical in both modes
// so PASS/FAIL/status badges look consistent regardless of color scheme.

const Colors = {
  light: {
    // Brand
    primary:        '#1B2D4F',       // Deep Navy
    primaryLight:   '#253D6B',       // Lighter navy for hover/active
    primaryDark:    '#0F1D35',       // Darkest navy for pressed
    accent:         '#E8650A',       // UMA orange — precise, not garish
    accentLight:    '#F07D28',       // Lighter orange
    accentDark:     '#C4540A',       // Darker orange for text on light bg

    // Backgrounds
    background:           '#F4F6FA', // Slightly blue-tinted white
    backgroundSecondary:  '#EDF0F7',
    backgroundTertiary:   '#E4E8F2', // Inputs, chips
    surface:              '#FFFFFF', // Pure white cards
    surfaceElevated:      '#FAFBFE',
    cardBorder:           'rgba(27, 45, 79, 0.09)',

    // Text
    text:           '#0D1526',       // Near-black with navy hue
    textSecondary:  '#44546A',       // Slate — readable secondary
    textTertiary:   '#8898AA',       // Muted — labels, timestamps
    textInverse:    '#FFFFFF',
    textOnPrimary:  '#FFFFFF',
    textOnAccent:   '#FFFFFF',

    // Borders
    border:         '#DCE3EE',
    borderStrong:   '#C4CEDF',

    // Status
    success:        '#16A34A',
    successLight:   '#DCFCE7',
    successDark:    '#14532D',
    warning:        '#D97706',
    warningLight:   '#FEF3C7',
    warningDark:    '#92400E',
    error:          '#DC2626',
    errorLight:     '#FEE2E2',
    errorDark:      '#991B1B',
    info:           '#2563EB',
    infoLight:      '#DBEAFE',
    infoDark:       '#1E3A8A',

    // Misc
    tint:           '#1B2D4F',
    icon:           '#44546A',
    tabIconDefault: '#8898AA',
    tabIconSelected:'#1B2D4F',
    shadow:         'rgba(13, 21, 38, 0.10)',
    overlay:        'rgba(0, 0, 0, 0.5)',
  },

  dark: {
    // ── Palette sourced from the Project Work prototype (Config.ts) ──────
    // primary = '#0F1E3C' navy, surface = '#182745', border = '#2D4068'
    // These richer navy blues look more "field app" than plain near-black.

    // Brand
    primary:        '#0F1E3C',       // Deep navy — matches prototype
    primaryLight:   '#243759',       // Light navy card backgrounds
    primaryDark:    '#0A1628',       // Darkest navy for pressed states
    accent:         '#E8650A',       // UMA orange — identical to light mode
    accentLight:    '#FF7A20',       // Prototype's accentSoft
    accentDark:     '#C4540A',

    // Backgrounds
    background:           '#0F1E3C', // Deep navy — prototype primary
    backgroundSecondary:  '#1A2E52', // Prototype primaryMid
    backgroundTertiary:   '#243759', // Prototype primaryLight
    surface:              '#182745', // Prototype surface — card backgrounds
    surfaceElevated:      '#1F3057', // Slightly elevated cards
    cardBorder:           'rgba(255,255,255,0.06)',

    // Text
    text:           '#FFFFFF',       // Prototype textLight
    textSecondary:  '#CBD5E1',       // Prototype textBody
    textTertiary:   '#94A3B8',       // Prototype textMuted
    textInverse:    '#0F1E3C',
    textOnPrimary:  '#FFFFFF',
    textOnAccent:   '#FFFFFF',

    // Borders
    border:         '#2D4068',       // Prototype border — subtle
    borderStrong:   '#3A5280',

    // Status — match prototype exactly for PASS/FAIL/status badges
    success:        '#16A34A',
    successLight:   'rgba(22,163,74,0.15)',
    successDark:    '#14532D',
    warning:        '#D97706',
    warningLight:   'rgba(217,119,6,0.15)',
    warningDark:    '#92400E',
    error:          '#DC2626',
    errorLight:     'rgba(220,38,38,0.15)',
    errorDark:      '#991B1B',
    info:           '#2563EB',
    infoLight:      'rgba(37,99,235,0.15)',
    infoDark:       '#1E3A8A',

    // Misc
    tint:           '#E8650A',
    icon:           '#94A3B8',
    tabIconDefault: '#2D4068',
    tabIconSelected:'#E8650A',
    shadow:         'rgba(0, 0, 0, 0.6)',
    overlay:        'rgba(0,0,0,0.55)',  // Prototype overlay
  },
};

export default Colors;
export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light;
