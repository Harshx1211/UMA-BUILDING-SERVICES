// Design tokens ported from the old supabase/functions/generate-report/pdfColors.ts
// (kept as the same hex values for continuity with the mobile app's palette —
// see constants/Colors.ts in the main app repo) — but this time actually wired
// into the templates that use it, instead of being dead, unimported code.
export const COLORS = {
  NAVY: '#1C3048',
  ORANGE: '#E97316',

  GREEN_TEXT: '#16A34A',
  GREEN_TEXT_DARK: '#14532D',
  GREEN_BG: 'rgba(22,163,74,0.15)',
  GREEN_BORDER: '#6EE7B7',

  RED_TEXT: '#DC2626',
  RED_TEXT_DARK: '#991B1B',
  RED_BG: 'rgba(220,38,38,0.15)',
  RED_BORDER: '#FCA5A5',

  AMBER_TEXT: '#D97706',
  AMBER_BG: '#FEFCE8',
  AMBER_BORDER: '#FCD34D',

  SLATE: '#475569',
  MUTED: '#94A3B8',
  MUTED_LIGHT: '#CBD5E1',
  BORDER: '#E2E8F0',
  BORDER_LIGHT: '#F1F5F9',
  SURFACE: '#FAFBFD',
  WHITE: '#FFFFFF',
  BLACK: '#1E293B',

  SEVERITY: {
    critical: { text: '#DC2626', bg: '#FFFAFA', border: '#FCA5A5' },
    non_critical: { text: '#D97706', bg: '#FFFCF5', border: '#FCD34D' },
    non_conformance: { text: '#CA8A04', bg: '#FEFCE8', border: '#FCD34D' },
  } as Record<string, { text: string; bg: string; border: string }>,

  PILL: {
    pass: { bg: 'rgba(22,163,74,0.15)', text: '#16A34A', border: '#6EE7B7' },
    fail: { bg: 'rgba(220,38,38,0.15)', text: '#DC2626', border: '#FCA5A5' },
    not_tested: { bg: '#F1F5F9', text: '#94A3B8', border: '#CBD5E1' },
  } as Record<string, { bg: string; text: string; border: string }>,

  PHOTO_UNAVAIL_BG: '#F1F5F9',
  PHOTO_UNAVAIL_BORDER: '#CBD5E1',
  PHOTO_UNAVAIL_TEXT: '#94A3B8',
};

// TEMP EXPERIMENT (see conversation) — plain-table styling matching a
// competitor reference report, to MEASURE the real byte-size difference
// decoration costs (colored card backgrounds/borders, pill badges, section
// bars) vs plain text tables. Reverted right after measuring; not a
// permanent style change.
export const BASE_STYLE = `
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: ${COLORS.BLACK};
    font-size: 10.5px;
    line-height: 1.4;
    margin: 0;
  }
  .page { padding: 28px 32px; }
  .section-bar {
    color: ${COLORS.BLACK}; font-weight: 700; font-size: 11px;
    text-transform: uppercase; padding: 6px 0; border-bottom: 1px solid ${COLORS.BLACK};
  }
  .card {
    border: none;
  }
  .pill {
    display: inline; font-size: 10px; font-weight: 800;
  }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; font-weight: 700; color: ${COLORS.BLACK}; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid ${COLORS.BLACK}; }
  td { padding: 6px 8px; border-top: 1px solid ${COLORS.MUTED_LIGHT}; vertical-align: top; }
  .thumb { width: 110px; height: 110px; object-fit: cover; }
  .thumb-missing {
    width: 110px; height: 110px; display: flex; align-items: center;
    justify-content: center; color: ${COLORS.MUTED};
    font-size: 10px; text-align: center; line-height: 1.3;
  }
  .defect-card { display: block; margin-top: 6px; }
  .defect-bar { display: none; }
  .defect-body { padding: 0; }

  tr, .defect-card { break-inside: avoid; page-break-inside: avoid; }
`;
