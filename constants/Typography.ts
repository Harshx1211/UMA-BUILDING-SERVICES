/**
 * Typography Scale — single source of truth.
 *
 * Rules:
 *  - eyebrow is the ONLY place all-caps text appears in the app.
 *  - Section titles are sentence-case, not screaming caps.
 *  - Nothing outside this file should hardcode fontSize/fontWeight.
 *
 * NOTE: Color is intentionally NOT embedded in these styles.
 * Apply color separately via { color: T.textPrimary } etc.
 * This keeps typography portable and avoids circular import issues.
 */
import type { TextStyle } from 'react-native';

export const Typography = {
  /** Screen-level heading — "Pandav Farm", "Inspection Form" */
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  } as TextStyle,

  /** Bold text inside a card — property name, defect description */
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  } as TextStyle,

  /** Section group labels — "Today's Jobs", "Quick Actions" — sentence case */
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  } as TextStyle,

  /** Standard readable body copy */
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  } as TextStyle,

  /** Small label placed above an input field */
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  } as TextStyle,

  /**
   * Eyebrow — micro-label.
   * THE ONLY PLACE all-caps appears in the app.
   * Usage: "JOB #5F422FDB", "Site Hazard" demoted here in small print.
   */
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Muted supporting text under a title */
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  } as TextStyle,

  /** Numbers inside KPI/stat tiles */
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
} as const;
