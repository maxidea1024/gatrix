/**
 * Multi-breakdown value utilities.
 *
 * When multiple breakdown properties are selected, the backend concatenates
 * values with `|||` (e.g. `"Steam|||production|||1.13.2"`).
 *
 * These helpers split the composite value and pair each part with its
 * corresponding property name for display purposes.
 */

/** Separator used by the backend `concat()` expression. */
export const BREAKDOWN_SEPARATOR = '|||';

/**
 * Split a composite breakdown value into individual parts.
 * Returns the original string wrapped in an array if no separator is found.
 */
export function splitBreakdownValue(value: string): string[] {
  if (!value) return [''];
  return value.split(BREAKDOWN_SEPARATOR);
}

/**
 * Build a human-readable label from a composite breakdown value.
 * e.g. `formatBreakdownLabel("Steam|||production", ["platform","environment"])`
 *       → `"platform: Steam · environment: production"`
 *
 * If only a single property, just returns the value itself.
 */
export function formatBreakdownLabel(
  compositeValue: string,
  propertyNames?: string[]
): string {
  const parts = splitBreakdownValue(compositeValue);
  if (parts.length <= 1 && (!propertyNames || propertyNames.length <= 1)) {
    return compositeValue;
  }
  if (!propertyNames || propertyNames.length === 0) {
    return parts.join(' · ');
  }
  return parts
    .map((val, i) => {
      const prop = propertyNames[i] || `prop${i + 1}`;
      return `${prop}: ${val || '(empty)'}`;
    })
    .join(' · ');
}

/**
 * Given a composite breakdown value and property names,
 * return an array of `{ property, value }` pairs for rendering
 * as individual columns.
 */
export function parseBreakdownColumns(
  compositeValue: string,
  propertyNames: string[]
): { property: string; value: string }[] {
  const parts = splitBreakdownValue(compositeValue);
  return propertyNames.map((prop, i) => ({
    property: prop,
    value: parts[i] || '(empty)',
  }));
}
