// SiteTrack colour palette — light and dark variants for all UI tokens

const Colors = {
  light: {
    // Brand
    primary: '#1B2D4F',       // Navy Blue — main brand colour
    primaryLight: '#2A4070',  // Lighter navy for hover/active states
    primaryDark: '#0D1B2E',   // Darker navy for pressed states
    accent: '#F97316',        // Orange — call-to-action, highlights
    accentLight: '#FB923C',   // Lighter orange
    accentDark: '#EA6C00',    // Darker orange

    // Backgrounds
    background: '#F4F6F9',
    backgroundSecondary: '#F4F6F9',
    backgroundTertiary: '#E9EDF3',
    surface: '#FFFFFF',
    surfaceElevated: '#F8FAFC',

    // Text
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Borders
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',

    // Status
    success: '#22C55E',
    successLight: '#DCFCE7',
    successDark: '#15803D',
    warning: '#EAB308',
    warningLight: '#FEF9C3',
    warningDark: '#A16207',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    errorDark: '#B91C1C',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    infoDark: '#1D4ED8',

    // Misc
    tint: '#1B2D4F',
    icon: '#475569',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#1B2D4F',
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Brand
    primary: '#3B5EA6',       // Lighter navy — readable on dark backgrounds
    primaryLight: '#4E72BC',
    primaryDark: '#2A4070',
    accent: '#F97316',
    accentLight: '#FB923C',
    accentDark: '#EA6C00',

    // Backgrounds
    background: '#0D1117',
    backgroundSecondary: '#161B22',
    backgroundTertiary: '#21262D',
    surface: '#161B22',
    surfaceElevated: '#21262D',

    // Text
    text: '#F0F6FC',
    textSecondary: '#8B949E',
    textTertiary: '#6E7681',
    textInverse: '#0D1117',
    textOnPrimary: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Borders
    border: '#30363D',
    borderStrong: '#484F58',

    // Status
    success: '#3FB950',
    successLight: '#0D2818',
    successDark: '#238636',
    warning: '#D29922',
    warningLight: '#272115',
    warningDark: '#9E6A03',
    error: '#F85149',
    errorLight: '#2D1117',
    errorDark: '#DA3633',
    info: '#58A6FF',
    infoLight: '#0D2345',
    infoDark: '#1F6FEB',

    // Misc
    tint: '#3B5EA6',
    icon: '#8B949E',
    tabIconDefault: '#6E7681',
    tabIconSelected: '#3B5EA6',
    shadow: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

export default Colors;
export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light;
