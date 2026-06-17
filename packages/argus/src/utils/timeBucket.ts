// ─── Shared Period Maps ──────────────────────────────────────────────────────
// Centralised so every route file can reference the same constants instead of
// duplicating inline `periodMap` literals.

/** Maps a UI period string (e.g. '14d') to seconds. */
export const PERIOD_TO_SECONDS: Record<string, number> = {
  '5min': 300,
  '10min': 600,
  '15min': 900,
  '30min': 1800,
  '1h': 3600,
  '3h': 10800,
  '6h': 21600,
  '12h': 43200,
  '24h': 86400,
  '2d': 172800,
  '7d': 604800,
  '14d': 1209600,
  '30d': 2592000,
  '90d': 7776000,
};

/** Maps a UI period string to a ClickHouse SQL INTERVAL literal. */
export const PERIOD_TO_SQL_INTERVAL: Record<string, string> = {
  '1h': '1 HOUR',
  '6h': '6 HOUR',
  '24h': '24 HOUR',
  '7d': '7 DAY',
  '14d': '14 DAY',
  '30d': '30 DAY',
  '90d': '90 DAY',
};

/**
 * Build ClickHouse time-range WHERE conditions + query params from
 * period / start / end inputs.
 *
 * Returns { conditions, params } that can be spread into existing
 * condition arrays and param objects.
 */
export function buildTimeRangeConditions(
  period: string = '14d',
  start?: string,
  end?: string
): {
  conditions: string[];
  params: Record<string, any>;
} {
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (start && end) {
    conditions.push('timestamp >= toDateTime({startTs:UInt32})');
    conditions.push('timestamp <= toDateTime({endTs:UInt32})');
    params.startTs = Math.floor(new Date(start).getTime() / 1000);
    params.endTs = Math.floor(new Date(end).getTime() / 1000);
  } else {
    const interval = PERIOD_TO_SQL_INTERVAL[period] || '14 DAY';
    conditions.push(`timestamp >= now() - INTERVAL ${interval}`);
  }

  return { conditions, params };
}

/**
 * Simple WHERE clause builder — returns a raw SQL string.
 * Use when you just need a string to concatenate into a query.
 * For parameterized queries, use `buildTimeRangeConditions` instead.
 */
export function buildTimeFilter(
  period?: string,
  start?: string,
  end?: string,
  defaultPeriod: string = '24h'
): string {
  if (start && end) {
    return `timestamp >= parseDateTimeBestEffort('${start}') AND timestamp <= parseDateTimeBestEffort('${end}')`;
  }
  const interval = PERIOD_TO_SQL_INTERVAL[period || defaultPeriod] || '24 HOUR';
  return `timestamp >= now() - INTERVAL ${interval}`;
}

// ─── Bucketing Config ────────────────────────────────────────────────────────

export interface BucketingConfig {
  interval: string;
  selectExpr: string;
  fillExpr: string;
  queryParams: { fillStart: number; fillEnd: number };
}

export function getBucketingConfig(
  period?: string,
  start?: string,
  end?: string,
  timestampColumn: string = 'timestamp'
): BucketingConfig {
  let startDt: Date;
  let endDt: Date;

  if (start && end) {
    startDt = new Date(start);
    endDt = new Date(end);
  } else {
    const deltaSecs = PERIOD_TO_SECONDS[period || '24h'] || 86400;
    endDt = new Date();
    startDt = new Date(endDt.getTime() - deltaSecs * 1000);
  }

  // Fallback to avoid invalid dates
  if (isNaN(startDt.getTime())) startDt = new Date(Date.now() - 86400 * 1000);
  if (isNaN(endDt.getTime())) endDt = new Date();

  const deltaSeconds = Math.max(
    1,
    (endDt.getTime() - startDt.getTime()) / 1000
  );

  // Choose interval to keep ~40-80 data points for smooth charts
  let interval = '1 DAY';
  if (deltaSeconds <= 600)
    interval = '10 SECOND'; // ≤10min → ~60 pts
  else if (deltaSeconds <= 1800)
    interval = '30 SECOND'; // ≤30min → ~60 pts
  else if (deltaSeconds <= 3600)
    interval = '1 MINUTE'; // ≤1h    → 60 pts
  else if (deltaSeconds <= 6 * 3600)
    interval = '5 MINUTE'; // ≤6h    → 72 pts
  else if (deltaSeconds <= 12 * 3600)
    interval = '15 MINUTE'; // ≤12h   → 48 pts
  else if (deltaSeconds <= 24 * 3600)
    interval = '30 MINUTE'; // ≤24h   → 48 pts
  else if (deltaSeconds <= 2 * 86400)
    interval = '1 HOUR'; // ≤2d    → 48 pts
  else if (deltaSeconds <= 7 * 86400)
    interval = '4 HOUR'; // ≤7d    → 42 pts
  else if (deltaSeconds <= 14 * 86400)
    interval = '8 HOUR'; // ≤14d   → 42 pts
  else if (deltaSeconds <= 30 * 86400) interval = '1 DAY'; // ≤30d   → 30 pts
  // >30d → 1 DAY (90d = 90 pts, acceptable)

  const selectExpr = `toStartOfInterval(${timestampColumn}, INTERVAL ${interval})`;
  const fillExpr = `WITH FILL FROM toStartOfInterval(toDateTime({fillStart:UInt32}), INTERVAL ${interval}) TO toDateTime({fillEnd:UInt32}) STEP INTERVAL ${interval}`;

  return {
    interval,
    selectExpr,
    fillExpr,
    queryParams: {
      fillStart: Math.floor(startDt.getTime() / 1000),
      fillEnd: Math.floor(endDt.getTime() / 1000),
    },
  };
}
