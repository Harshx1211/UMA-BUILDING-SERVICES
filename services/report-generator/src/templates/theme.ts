/**
 * Report design tokens and the one shared stylesheet every section uses.
 *
 * DESIGN (2026-10-11): rebuilt from the owner-approved Stitch mock-up — light
 * section headings on a navy rule instead of filled navy bars, asset cards
 * with a result-coloured edge, a one-row summary, before/after photos side by
 * side, a running header on pages 2+ (drawn in pdf/stampPageNumbers.ts).
 * Print constraints unchanged: one font family (Regular, Bold, Italic — bold
 * is ALWAYS 700, see below), flat colours, no shadows or gradients. Each of
 * those would either embed more data in every PDF or slow rendering.
 */
export const COLORS = {
  NAVY: '#1E293B',
  ORANGE: '#EA580C',

  GREEN_TEXT: '#16A34A',
  GREEN_TEXT_DARK: '#166534',
  GREEN_BG: '#F0FDF4',

  RED_TEXT: '#DC2626',
  RED_TEXT_DARK: '#991B1B',
  RED_BG: '#FEF2F2',
  RED_BORDER: '#FECACA',

  AMBER_TEXT: '#D97706',
  AMBER_TEXT_DARK: '#92400E',
  AMBER_BG: '#FFFBEB',

  SLATE: '#475569',
  MUTED: '#64748B',
  MUTED_LIGHT: '#CBD5E1',
  BORDER: '#E2E8F0',
  HEADER_BG: '#F1F5F9',
  SURFACE: '#F8FAFC',
  WHITE: '#FFFFFF',

  // AS 1851-2012 Clause 1.5.6's three classifications. `title` is the text
  // colour on the tinted card, `accent` the card's left edge / badge fill.
  SEVERITY: {
    critical: { title: '#991B1B', accent: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    non_critical: { title: '#9A3412', accent: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
    non_conformance: { title: '#92400E', accent: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  } as Record<string, { title: string; accent: string; bg: string; border: string }>,

  PILL: {
    pass: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
    fail: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
    not_tested: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  } as Record<string, { bg: string; text: string; border: string }>,

  // An asset card's left edge, by inspection result.
  RESULT_EDGE: {
    pass: '#16A34A',
    fail: '#DC2626',
    not_tested: '#64748B',
  } as Record<string, string>,
};

const C = COLORS;

export const BASE_STYLE = `
  /* Page MARGINS come only from the renderer (render/chromium.ts: 0.6in top
     for the running header, 0.75in bottom for the footer band). FIX: this
     also declared "margin: 0" once, and Chromium laid pages out with that
     zero margin while still drawing the footer in the renderer's margin —
     so a page full of short rows ran right under "Page X of Y". */
  @page { size: A4; }
  /* SIZE: bold is font-weight 700 only, everywhere. The report font has a
     single bold face, so other weights drew the same glyphs — but Chromium
     embedded a separate copy of that face for each weight asked for. */
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: ${C.NAVY};
    font-size: 10.5px;
    line-height: 1.35;
    margin: 0;
  }
  .page { padding: 28px 32px; }
  /* The asset log flows category after category, so it has side padding
     only — a full .page's top and bottom padding stacked into ~85px of
     blank space between consecutive categories. */
  .log { padding: 0 32px; }
  .pre { white-space: pre-line; }

  /* ── Titles and headings ─────────────────────────────────────────────── */
  .title-row {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding-bottom: 8px; border-bottom: 2px solid ${C.NAVY}; margin-bottom: 14px;
  }
  .title { font-size: 18px; font-weight: 700; color: ${C.NAVY}; }
  .logo-initials {
    width: 24px; height: 24px; border-radius: 2px; background: ${C.NAVY}; color: ${C.WHITE};
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
  }
  /* Section heading: text on a navy rule. Keeps the class name the page
     markers look for (generation/pipeline.ts FIRST_BAR) and never ends a
     page on its own. */
  .section-bar {
    position: relative;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    color: ${C.NAVY}; border-bottom: 2px solid ${C.NAVY}; padding-bottom: 4px; margin: 0 0 8px;
    break-after: avoid; page-break-after: avoid;
  }

  /* ── Panels, labelled fields, statements ─────────────────────────────── */
  .panel { border: 1px solid ${C.BORDER}; background: ${C.SURFACE}; }
  .fields { display: grid; gap: 12px; padding: 10px; }
  .label {
    display: block; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: ${C.MUTED}; margin-bottom: 2px;
  }
  .value { font-size: 10.5px; }
  .value.strong { font-weight: 700; }
  .sub { font-size: 9.5px; color: ${C.MUTED}; margin-top: 1px; }
  .statement { padding: 6px 10px; font-size: 10px; line-height: 1.45; }

  /* ── Tables ──────────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; }
  th {
    background: ${C.HEADER_BG}; color: ${C.NAVY}; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 5px 8px;
    border-top: 1px solid ${C.BORDER}; border-bottom: 1px solid ${C.BORDER};
  }
  td { padding: 5px 8px; font-size: 10px; border-bottom: 1px solid ${C.BORDER}; vertical-align: middle; }
  .num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* Repeated at the top of every page a table spans. */
  thead { display: table-header-group; }

  /* ── Pills ───────────────────────────────────────────────────────────── */
  .pill {
    display: inline-block; padding: 2px 7px; border-radius: 12px; border: 1px solid transparent;
    font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1;
    white-space: nowrap;
  }

  /* ── Cover ───────────────────────────────────────────────────────────── */
  .banner {
    display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 6px 10px;
    border: 1px solid; border-left-width: 4px; font-size: 10px;
  }
  .banner svg { flex-shrink: 0; margin-top: 1px; }
  .banner-label { font-size: 8.5px; font-weight: 700; letter-spacing: 0.5px; margin-right: 4px; }
  .summary { border: 1px solid ${C.BORDER}; }
  .status-line {
    display: flex; align-items: center; gap: 6px; padding: 6px 10px;
    font-size: 10px; font-weight: 700; border-bottom: 1px solid ${C.BORDER};
  }
  .tally { display: grid; grid-template-columns: repeat(7, 1fr); padding: 8px 4px; text-align: center; }
  .tally > div { padding: 0 4px; border-right: 1px solid ${C.BORDER}; }
  .tally > div:last-child { border-right: none; }
  .tally-n { font-size: 16px; font-weight: 700; line-height: 1.1; }
  .tally-l { font-size: 8.5px; font-weight: 700; color: ${C.MUTED}; text-transform: uppercase; margin-top: 2px; }

  /* ── Asset log ───────────────────────────────────────────────────────── */
  /* Category headings live INSIDE the table's <thead>, which Chromium repeats
     on every page the table spans — a category that runs onto another page
     is still labelled there, and its heading can't be stranded at the bottom
     of a page away from its first asset. */
  .cat-table { margin-top: 18px; }
  .cat-head th {
    position: relative; background: none; border: none; border-bottom: 2px solid ${C.NAVY};
    padding: 0 0 4px; font-size: 11px; letter-spacing: 0.8px; color: ${C.NAVY};
  }
  .asset-cell { padding: 8px 0 0; border: none; }
  .asset-card { border: 1px solid ${C.BORDER}; }
  .asset-head {
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    background: ${C.HEADER_BG}; padding: 6px 10px; border-left: 3px solid ${C.MUTED};
    border-bottom: 1px solid ${C.BORDER};
  }
  .asset-title { font-size: 11px; font-weight: 700; }
  .asset-body { padding: 8px 10px; }
  .asset-body > :first-child { margin-top: 0; }
  .asset-detail { font-size: 10px; }
  .remark { margin-top: 6px; font-size: 9.5px; font-style: italic; color: ${C.SLATE}; }
  .remark-label {
    font-style: normal; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: ${C.NAVY};
  }

  /* ── Photos ──────────────────────────────────────────────────────────── */
  .photos { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
  .photos a { display: block; }
  .thumb { display: block; width: 110px; height: 110px; object-fit: cover; border: 1px solid ${C.BORDER}; }
  .thumb-missing {
    width: 110px; height: 110px; display: flex; align-items: center; justify-content: center;
    text-align: center; background: ${C.HEADER_BG}; border: 1px dashed ${C.MUTED_LIGHT};
    color: ${C.MUTED}; font-size: 8.5px; line-height: 1.3;
  }
  /* Defect evidence (before/after) prints smaller so both stages sit side by
     side; every thumbnail still opens the full-resolution original. */
  .photos.sm { margin-top: 3px; }
  .photos.sm .thumb, .photos.sm .thumb-missing { width: 80px; height: 80px; }
  .more { font-size: 11px; font-weight: 700; color: ${C.MUTED}; padding: 0 4px; }
  .staged { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 6px; }

  /* ── Defect card ─────────────────────────────────────────────────────── */
  .defect { margin-top: 6px; padding: 8px; border: 1px solid; border-left-width: 4px; }
  .defect-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .defect-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .defect-time { font-size: 8.5px; color: ${C.MUTED}; white-space: nowrap; }
  .defect-desc { margin-top: 4px; font-size: 10px; white-space: pre-line; }
  .tags { display: flex; gap: 6px; margin-top: 6px; }

  /* ── Yearly Condition Report ─────────────────────────────────────────── */
  .esm { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; padding: 10px; }
  .esm-item { display: flex; align-items: flex-start; gap: 6px; font-size: 9.5px; }
  .tick-box {
    flex-shrink: 0; width: 12px; height: 12px; margin-top: 1px; border: 1px solid #94A3B8;
    background: ${C.WHITE}; display: flex; align-items: center; justify-content: center;
  }
  .tick-box.on { background: ${C.NAVY}; border-color: ${C.NAVY}; }
  .type-badge {
    display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center;
    border-radius: 2px; font-size: 9px; font-weight: 700; color: ${C.WHITE};
  }

  /* ── Sign-off ────────────────────────────────────────────────────────── */
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
  .sign-box { border: 1px solid ${C.BORDER}; padding: 10px; }
  .sig-area {
    height: 60px; display: flex; align-items: center; margin: 4px 0 6px;
    border-bottom: 1px solid ${C.MUTED_LIGHT};
  }
  .sig-area img { max-height: 52px; max-width: 100%; }

  /* ── Pagination ──────────────────────────────────────────────────────── */
  /* One asset, one defect card or one table row never splits across pages.
     Deliberately NOT applied to whole tables — a long table forced onto a
     fresh page would leave a worse blank gap than a row-level split. */
  tr, .defect { break-inside: avoid; page-break-inside: avoid; }
  /* Short blocks that must stay in one piece (detail rows, the checklist,
     the closing statements, the sign-off). */
  .keep { break-inside: avoid; page-break-inside: avoid; }
`;
