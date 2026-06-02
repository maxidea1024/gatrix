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
