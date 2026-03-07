/**
 * Context utility functions for building query parameters
 * and normalizing context values.
 */

import { GatrixContext } from './types';

/** System fields that cannot be removed via updateContext(null/undefined) */
export const SYSTEM_CONTEXT_FIELDS: ReadonlySet<string> = new Set(['appName', 'environment']);

/**
 * Truncate an ISO 8601 time string to minute precision.
 * Prevents frequent cache invalidation from sub-minute changes.
 * e.g. "2025-01-15T10:30:45.123Z" → "2025-01-15T10:30:00.000Z"
 */
export function truncateToMinute(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  date.setSeconds(0, 0);
  return date.toISOString();
}

/**
 * Build context query parameters onto a URL for GET eval requests.
 * Applies currentTime truncation automatically.
 */
export function buildContextQueryParams(url: URL, context: GatrixContext): void {
  const topLevelFields: (keyof GatrixContext)[] = [
    'appName',
    'environment',
    'userId',
    'sessionId',
    'remoteAddress',
    'currentTime',
  ];

  for (const key of topLevelFields) {
    const value = context[key];
    if (value === undefined || value === null) continue;
    if (key === 'currentTime') {
      url.searchParams.set(key, truncateToMinute(String(value)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  if (context.properties && typeof context.properties === 'object') {
    for (const [propKey, propValue] of Object.entries(context.properties)) {
      if (propValue !== undefined && propValue !== null) {
        url.searchParams.set(`properties[${propKey}]`, String(propValue));
      }
    }
  }
}
