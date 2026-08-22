// supabase/functions/generate-report/pdfColors.ts
// Shared design tokens — MUST match lib/Colors.ts exactly for visual parity
// Any change here requires updating both Edge Function and mobile implementations

export const COLORS = {
  // Primary brand
  NAVY: '#1C3048',           // Section bars, headers, footer bar
  NAVY_LIGHT: '#1B2D4F',     // Card backgrounds (mobile: navy600)
  NAVY_DARK: '#0F1E3C',      // Page backgrounds (mobile: navy800)
  ORANGE: '#E97316',         // Primary accent, CTAs, page numbers
  ORANGE_DARK: '#E8650A',    // Mobile orange500 - slightly darker

  // Semantic - Success (PASS)
  GREEN_TEXT: '#16A34A',     // Mobile: green600
  GREEN_TEXT_DARK: '#14532D', // Mobile: green900
  GREEN_BG: 'rgba(22,163,74,0.15)', // Mobile: greenBg
  GREEN_BORDER: '#6EE7B7',   // Mobile: green300

  // Semantic - Danger (FAIL)
  RED_TEXT: '#DC2626',       // Mobile: red600
  RED_TEXT_DARK: '#991B1B',  // Mobile: red900
  RED_BG: 'rgba(220,38,38,0.15)',   // Mobile: redBg
  RED_BORDER: '#FCA5A5',     // Mobile: red300

  // Semantic - Warning (Defect Major/Minor)
  AMBER_TEXT: '#D97706',     // Mobile: amber600
  AMBER_TEXT_DARK: '#92400E', // Mobile: amber900
  AMBER_BG: '#FEFCE8',       // Light amber background
  AMBER_BORDER: '#FCD34D',

  // Semantic - Info (Critical defect)
  BLUE_TEXT: '#2563EB',
  BLUE_BG: '#DBEAFE',
  BLUE_BORDER: '#93C5FD',

  // Neutral
  SLATE: '#475569',          // Mobile: slate600 - dark text
  MUTED: '#94A3B8',          // Mobile: slate400 - muted text, N/T pill
  MUTED_LIGHT: '#CBD5E1',    // Mobile: slate300 - borders
  BORDER: '#E2E8F0',         // Mobile: slate200 - primary border
  BORDER_LIGHT: '#F1F5F9',   // Mobile: slate100 - subtle borders/dividers
  SURFACE: '#FAFBFD',        // Mobile: surface - card backgrounds
  SURFACE_HOVER: '#F1F5F9',  // Mobile: surfaceHover
  WHITE: '#FFFFFF',
  BLACK: '#1E293B',          // Mobile: textPrimary

  // Defect severity specific (used in defect boxes)
  SEVERITY_CRITICAL: '#DC2626', // RED_TEXT
  SEVERITY_MAJOR: '#D97706',    // AMBER_TEXT
  SEVERITY_MINOR: '#CA8A04',    // Darker amber
  SEVERITY_RECOMMENDATION: '#0EA5E9',
  SEVERITY_INFORMATIONAL: '#6366F1',

  // Defect box backgrounds by severity
  DEFECT_CRIT_BG: '#FFFAFA',
  DEFECT_MAJ_BG: '#FFFCF5',
  DEFECT_MIN_BG: '#FEFCE8',

  // Quote section
  QUOTE_SUBTOTAL_BG: '#F7F9FC',
  QUOTE_GRAND_BG: '#F7F9FC',

  // Signature
  SIG_PAD_BG: '#F0F4F8',
  SIG_BORDER: '#CBD5E1',

  // Photo unavailable
  PHOTO_UNAVAIL_BG_1: '#F1F5F9',
  PHOTO_UNAVAIL_BG_2: '#E7ECF2',
  PHOTO_UNAVAIL_BORDER: '#CBD5E1',
  PHOTO_UNAVAIL_TEXT: '#94A3B8',

  // Status badge colors
  STATUS_REPAIRED: '#059669',
  STATUS_QUOTED: '#D97706',
  STATUS_OPEN: '#DC2626',

  // Prepared by strip
  PREP_BG: '#FFF7ED',
  PREP_BORDER: '#E97316',

  // Compliance block
  COMPLIANT_BG: '#D1FAE5',
  COMPLIANT_BORDER: '#6EE7B7',
  COMPLIANT_TEXT: '#065F46',
  NON_COMPLIANT_BG: '#FEE2E2',
  NON_COMPLIANT_BORDER: '#FCA5A5',
  NON_COMPLIANT_TEXT: '#991B1B',
} as const;

// Helper to get defect severity colors
export function getSeverityColors(severity: string): { text: string; bg: string; border: string } {
  switch (severity) {
    case 'critical':
      return { text: COLORS.SEVERITY_CRITICAL, bg: COLORS.DEFECT_CRIT_BG, border: COLORS.RED_BORDER };
    case 'major':
      return { text: COLORS.SEVERITY_MAJOR, bg: COLORS.DEFECT_MAJ_BG, border: COLORS.AMBER_BORDER };
    case 'minor':
      return { text: COLORS.SEVERITY_MINOR, bg: COLORS.DEFECT_MIN_BG, border: COLORS.AMBER_BORDER };
    default:
      return { text: COLORS.SEVERITY_MAJOR, bg: COLORS.DEFECT_MAJ_BG, border: COLORS.AMBER_BORDER };
  }
}

// Pill colors matching mobile exactly
export const PILL_COLORS = {
  pass: { bg: COLORS.GREEN_BG, text: COLORS.GREEN_TEXT, border: COLORS.GREEN_BORDER },
  fail: { bg: COLORS.RED_BG, text: COLORS.RED_TEXT, border: COLORS.RED_BORDER },
  not_tested: { bg: COLORS.BORDER_LIGHT, text: COLORS.MUTED, border: COLORS.MUTED_LIGHT },
} as const;