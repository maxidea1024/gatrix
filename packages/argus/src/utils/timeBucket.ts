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
    const periodMap: Record<string, number> = {
      '1h': 3600,
      '6h': 21600,
      '12h': 43200,
      '24h': 86400,
      '7d': 604800,
      '14d': 1209600,
      '30d': 2592000,
      '90d': 7776000,
    };
    const deltaSecs = periodMap[period || '24h'] || 86400;
    endDt = new Date();
    startDt = new Date(endDt.getTime() - deltaSecs * 1000);
  }

  // Fallback to avoid invalid dates
  if (isNaN(startDt.getTime())) startDt = new Date(Date.now() - 86400 * 1000);
  if (isNaN(endDt.getTime())) endDt = new Date();

  const deltaSeconds = Math.max(1, (endDt.getTime() - startDt.getTime()) / 1000);
  
  let interval = '1 DAY';
  if (deltaSeconds <= 3600) interval = '1 MINUTE';
  else if (deltaSeconds <= 6 * 3600) interval = '5 MINUTE';
  else if (deltaSeconds <= 12 * 3600) interval = '15 MINUTE';
  else if (deltaSeconds <= 24 * 3600) interval = '30 MINUTE';
  else if (deltaSeconds <= 7 * 86400) interval = '4 HOUR';
  else if (deltaSeconds <= 14 * 86400) interval = '8 HOUR';
  else if (deltaSeconds <= 30 * 86400) interval = '1 DAY';

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

/**
 * @deprecated Use getBucketingConfig instead.
 */
export function getDynamicBucketFn(period: string, start?: string, end?: string): string {
  if (period === 'custom' && start && end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffHours = (e - s) / 3600000;
    if (diffHours <= 12) return 'toStartOfFiveMinutes';
    if (diffHours <= 72) return 'toStartOfHour';
    return 'toStartOfDay';
  }
  
  if (['1h', '6h', '12h'].includes(period)) {
    return 'toStartOfFiveMinutes';
  }
  if (['24h', '7d', '14d'].includes(period)) {
    return 'toStartOfHour';
  }
  return 'toStartOfDay';
}
