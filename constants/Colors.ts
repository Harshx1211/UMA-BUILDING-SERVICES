// SiteTrack colour palette — professional enterprise field-service app
// Design principle: navy authority + white clarity + orange precision

const Colors = {
  light: {
    // Brand
    primary: '#1B2D4F',       // Deep Navy — authority, trust
    primaryLight: '#253D6B',  // Lighter navy for hover/active states
    primaryDark: '#0F1D35',   // Darkest navy for pressed states
    accent: '#E8650A',        // Refined orange — precise, not garish
    accentLight: '#F07D28',   // Lighter orange
    accentDark: '#C4540A',    // Darker orange for text on light bg

    // Backgrounds — clean, not grey-soup
    background: '#F4F6FA',          // Slightly blue-tinted white, clean
    backgroundSecondary: '#EDF0F7', // Slightly deeper tier
    backgroundTertiary: '#E4E8F2',  // Inputs, chips
    surface: '#FFFFFF',             // Pure white for cards
    surfaceElevated: '#FAFBFE',     // Very slightly off-white, elevated surfaces
    cardBorder: 'rgba(27, 45, 79, 0.09)', // Visible navy-tinted border

    // Text — strong typographic hierarchy
    text: '#0D1526',            // Near-black with navy hue
    textSecondary: '#44546A',   // Slate — readable secondary
    textTertiary: '#8898AA',    // Muted — for labels, timestamps
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Borders
    border: '#DCE3EE',
    borderStrong: '#C4CEDF',

    // Status — clear, professional
    success: '#16A34A',
    successLight: '#DCFCE7',
    successDark: '#14532D',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    warningDark: '#92400E',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    errorDark: '#991B1B',
    info: '#2563EB',
    infoLight: '#DBEAFE',
    infoDark: '#1E3A8A',

    // Misc
    tint: '#1B2D4F',
    icon: '#44546A',
    tabIconDefault: '#8898AA',
    tabIconSelected: '#1B2D4F',
    shadow: 'rgba(13, 21, 38, 0.10)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Brand
    primary: '#4A6FA5',
    primaryLight: '#5C82BA',
    primaryDark: '#2A4070',
    accent: '#E8650A',
    accentLight: '#F07D28',
    accentDark: '#C4540A',

    // Backgrounds
    background: '#0A0E18',
    backgroundSecondary: '#10141F',
    backgroundTertiary: '#181D2B',
    surface: '#131825',
    surfaceElevated: '#1A2035',
    cardBorder: 'rgba(255,255,255,0.07)',

    // Text
    text: '#EEF2FA',
    textSecondary: '#8B99B5',
    textTertiary: '#5D6B85',
    textInverse: '#0A0E18',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Borders
    border: '#252D42',
    borderStrong: '#3A4560',

    // Status
    success: '#22C55E',
    successLight: '#052E16',
    successDark: '#16A34A',
    warning: '#F59E0B',
    warningLight: '#1C1407',
    warningDark: '#D97706',
    error: '#EF4444',
    errorLight: '#1F0A0A',
    errorDark: '#DC2626',
    info: '#3B82F6',
    infoLight: '#0A1628',
    infoDark: '#2563EB',

    // Misc
    tint: '#4A6FA5',
    icon: '#8B99B5',
    tabIconDefault: '#3A4560',
    tabIconSelected: '#4A6FA5',
    shadow: 'rgba(0, 0, 0, 0.6)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

export default Colors;
export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light;
