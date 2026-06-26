/**
 * Argus Design Tokens
 *
 * Centralised colour palette and style primitives for all Argus analytics
 * pages.  Instead of hard-coding hex colours throughout components, import
 * the tokens from here so that every page speaks the same visual language.
 *
 * Design goals (GameAnalytics-inspired):
 *   – Monochrome base with minimal accent colours
 *   – Data series distinguished by a controlled 6-colour palette
 *   – Semantic colours for meaning (positive / negative / warning / info)
 *   – No gradient backgrounds, no card hover shadows, no emoji
 */

import { alpha, type Theme } from '@mui/material/styles';

// ─── Data series palette (charts & legend only) ──────────────────────────────
// Max 6 — if you need more, the chart should probably group "Other".

export const ARGUS_SERIES = [
  '#5B8FF9',  // blue
  '#5AD8A6',  // teal
  '#F6BD16',  // amber
  '#E86452',  // salmon
  '#6DC8EC',  // sky
  '#945FB9',  // purple
] as const;

// ─── Semantic colours ────────────────────────────────────────────────────────

export const ARGUS_SEMANTIC = {
  /** Increase / good */
  positive: '#30BF78',
  /** Decrease / bad */
  negative: '#E8684A',
  /** Attention required */
  warning: '#FAAD14',
  /** Neutral / informational */
  info: '#5B8FF9',
  /** Neutral change (≈ 0) */
  neutral: '#8C8C8C',
} as const;

// ─── Surface helpers ─────────────────────────────────────────────────────────

export function argusSurface(isDark: boolean) {
  return isDark ? '#141414' : '#FFFFFF';
}

export function argusSurfaceElevated(isDark: boolean) {
  return isDark ? '#1F1F1F' : '#FAFAFA';
}

export function argusBorder(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
}

export function argusBorderStrong(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
}

export function argusTextMuted(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
}

export function argusHoverBg(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
}

// ─── Typography tokens ───────────────────────────────────────────────────────

/** Section header style — replaces inline sectionHeaderSx objects. */
export const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',    // 11px
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'text.secondary',
  lineHeight: 1.4,
} as const;

/** KPI metric value */
export const METRIC_VALUE_SX = {
  fontSize: '1.5rem',       // 24px
  fontWeight: 800,
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
} as const;

/** KPI metric label */
export const METRIC_LABEL_SX = {
  fontSize: '0.6875rem',    // 11px
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
} as const;

// ─── Legacy colour map (for incremental migration) ───────────────────────────
//
// When migrating existing files, replace hard-coded hex values with these
// references so that a later palette change touches only this file.
//
// Usage:  import { LEGACY } from './argusThemeTokens';
//         color: LEGACY.green       →    color: ARGUS_SEMANTIC.positive
//         color: '#4caf50'          →    color: ARGUS_SEMANTIC.positive

export const LEGACY = {
  green:  '#4caf50',   // → ARGUS_SEMANTIC.positive
  red:    '#f44336',   // → ARGUS_SEMANTIC.negative
  orange: '#ff9800',   // → ARGUS_SEMANTIC.warning
  blue:   '#2196f3',   // → ARGUS_SEMANTIC.info
  purple: '#9c27b0',   // → ARGUS_SERIES[5]
} as const;

// ─── Chart-level helpers ─────────────────────────────────────────────────────

/**
 * Returns a series colour by index.  Wraps around if `idx >= ARGUS_SERIES.length`.
 */
export function seriesColor(idx: number): string {
  return ARGUS_SERIES[idx % ARGUS_SERIES.length];
}

/**
 * Resolve a "change direction" to a semantic colour.
 *
 * @param value  The change value.
 * @param invert If true, negative is good (e.g. error counts going down).
 */
export function changeColor(value: number, invert = false): string {
  if (Math.abs(value) < 0.1) return ARGUS_SEMANTIC.neutral;
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  return isGood ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.negative;
}
