/**
 * Number formatting utilities for compact display with tooltip support.
 */

/**
 * Format a number into a compact human-readable string.
 * - < 1,000: returns the number as-is (e.g. "42")
 * - >= 1,000: returns abbreviated form (e.g. "1.2K", "3.5M", "1.1B")
 *
 * @param value - The number to format
 * @returns Compact string representation
 */
export function formatCompactNumber(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) {
    const v = value / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  if (value < 1_000_000_000) {
    const v = value / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  const v = value / 1_000_000_000;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
}

/**
 * Format a number with thousand separators (commas).
 *
 * @param value - The number to format
 * @returns Comma-separated string (e.g. "1,234,567")
 */
export function formatWithCommas(value: number): string {
  return value.toLocaleString();
}

/**
 * Check if a number needs compact formatting (i.e. >= 1000).
 * Use this to conditionally render a Tooltip.
 *
 * @param value - The number to check
 * @returns true if the number should show a tooltip with full value
 */
export function needsCompactTooltip(value: number): boolean {
  return value >= 1_000;
}
