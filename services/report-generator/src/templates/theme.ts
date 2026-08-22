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
    major: { text: '#D97706', bg: '#FFFCF5', border: '#FCD34D' },
    minor: { text: '#CA8A04', bg: '#FEFCE8', border: '#FCD34D' },
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

/** Shared <style> block — every template (cover/asset-log-chunk/repairs/signoff)
 * includes this so a single Gotenberg-merged PDF looks visually consistent. */
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
    background: ${COLORS.NAVY}; color: #fff; font-weight: 800; font-size: 11px;
    letter-spacing: 1px; text-transform: uppercase; padding: 8px 14px;
    border-radius: 4px 4px 0 0;
  }
  .card {
    border: 1px solid ${COLORS.BORDER}; border-radius: 0 0 6px 6px;
    border-top: none; overflow: hidden;
  }
  .pill {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
  }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; font-weight: 700; color: ${COLORS.SLATE}; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 10px; background: ${COLORS.BORDER_LIGHT}; }
  td { padding: 8px 10px; border-top: 1px solid ${COLORS.BORDER}; vertical-align: top; }
  /* 44px thumbnails were confirmed too small to make out in a real printed
     report — bumped to a size where a defect is actually recognizable. */
  .thumb { width: 110px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid ${COLORS.BORDER}; }
  .thumb-missing {
    width: 110px; height: 110px; border-radius: 6px; display: flex; align-items: center;
    justify-content: center; background: ${COLORS.PHOTO_UNAVAIL_BG};
    border: 1px dashed ${COLORS.PHOTO_UNAVAIL_BORDER}; color: ${COLORS.PHOTO_UNAVAIL_TEXT};
    font-size: 10px; text-align: center; line-height: 1.3;
  }
  .defect-card { display: flex; margin-top: 8px; border-radius: 8px; overflow: hidden; }
  .defect-bar { width: 4px; flex-shrink: 0; }
  .defect-body { flex: 1; padding: 10px 12px; }

  /* Print pagination: keep one table row or one defect card intact rather
     than splitting it across a page boundary. Deliberately NOT applied to
     .card generally — the big multi-row asset-log tables also use that
     class, and forcing a whole long table to avoid breaking would push it
     onto a fresh page instead, producing worse blank-space gaps than the
     row-level split it's meant to prevent. */
  tr, .defect-card { break-inside: avoid; page-break-inside: avoid; }
`;
