/**
 * Schedule parsing utilities for Cron Monitors.
 *
 * Mirrors Sentry's `sentry.monitors.schedule` module:
 *   - Crontab schedules via `cron-parser`
 *   - Interval schedules via simple arithmetic
 *   - Timezone-aware next/prev schedule computation
 *
 * @see https://github.com/getsentry/sentry/blob/master/src/sentry/monitors/schedule.py
 */
import { CronExpressionParser } from 'cron-parser';

// ── Types ──

export type ScheduleType = 'crontab' | 'interval';

export type IntervalUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface CrontabSchedule {
  type: 'crontab';
  value: string; // e.g. "*/5 * * * *"
}

export interface IntervalSchedule {
  type: 'interval';
  value: number; // e.g. 2
  unit: IntervalUnit;
}

export type ScheduleConfig = CrontabSchedule | IntervalSchedule;

// ── Interval unit → milliseconds multiplier ──

const INTERVAL_MS: Record<IntervalUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30 days approximation
};

/**
 * Compute the next expected check-in time from a reference timestamp.
 *
 * Examples:
 *   getNextSchedule(new Date('2026-01-01T05:30:00Z'), { type: 'crontab', value: '0 * * * *' })
 *   → 2026-01-01T06:00:00Z
 *
 *   getNextSchedule(new Date('2026-01-01T05:35:00Z'), { type: 'interval', value: 2, unit: 'hour' })
 *   → 2026-01-01T07:35:00Z
 */
export function getNextSchedule(
  referenceTs: Date,
  schedule: ScheduleConfig,
  timezone?: string
): Date {
  if (schedule.type === 'crontab') {
    const options: any = {
      currentDate: referenceTs,
    };
    if (timezone) {
      options.tz = timezone;
    }
    const interval = CronExpressionParser.parse(schedule.value, options);
    const next = interval.next().toDate();
    // Clamp to the minute (Sentry does `.replace(second=0, microsecond=0)`)
    next.setSeconds(0, 0);
    return next;
  }

  if (schedule.type === 'interval') {
    const ms = schedule.value * INTERVAL_MS[schedule.unit];
    const next = new Date(referenceTs.getTime() + ms);
    next.setSeconds(0, 0);
    return next;
  }

  throw new Error(`Unknown schedule type: ${(schedule as any).type}`);
}

/**
 * Compute the previous expected check-in time before a reference timestamp.
 * Used for determining expected_time on a check-in that just arrived.
 */
export function getPrevSchedule(
  startTs: Date,
  referenceTs: Date,
  schedule: ScheduleConfig,
  timezone?: string
): Date {
  if (schedule.type === 'crontab') {
    const options: any = {
      currentDate: referenceTs,
      endDate: referenceTs,
    };
    if (timezone) {
      options.tz = timezone;
    }
    const interval = CronExpressionParser.parse(schedule.value, options);
    const prev = interval.prev().toDate();
    prev.setSeconds(0, 0);
    return prev;
  }

  if (schedule.type === 'interval') {
    const ms = schedule.value * INTERVAL_MS[schedule.unit];
    // Walk forward from startTs in interval steps until we pass referenceTs
    let current = startTs.getTime();
    let prev = current;
    while (current < referenceTs.getTime()) {
      prev = current;
      current += ms;
    }
    const result = new Date(prev);
    result.setSeconds(0, 0);
    return result;
  }

  throw new Error(`Unknown schedule type: ${(schedule as any).type}`);
}

/**
 * Build a ScheduleConfig from database columns.
 */
export function buildScheduleConfig(
  scheduleType: string,
  scheduleValue: string,
  scheduleUnit?: string | null
): ScheduleConfig {
  if (scheduleType === 'crontab') {
    return { type: 'crontab', value: scheduleValue };
  }
  if (scheduleType === 'interval') {
    return {
      type: 'interval',
      value: parseInt(scheduleValue, 10),
      unit: (scheduleUnit || 'minute') as IntervalUnit,
    };
  }
  throw new Error(`Unknown schedule_type: ${scheduleType}`);
}

/**
 * Compute the checkin margin in milliseconds.
 * Mirrors Sentry's `get_checkin_margin()`.
 * Default margin is 5 minutes if not specified.
 */
export function getCheckinMarginMs(marginMinutes?: number | null): number {
  const margin = marginMinutes ?? 5;
  // Sentry caps the margin at a reasonable maximum
  return Math.min(Math.max(margin, 1), 1440) * 60_000;
}
