/**
 * Date conversion Utility
 *
 * All dates are saved in UTC and converted to MySQL DATETIME format.
 */

import { createLogger } from '../config/logger';

const logger = createLogger('dateUtils');

/**
 * Convert ISO 8601 date string to MySQL DATETIME format (UTC)
 *
 * @param dateValue - ISO 8601 format date string or Date object
 * @returns MySQL DATETIME format string (YYYY-MM-DD HH:MM:SS) or null
 *
 * @example
 * convertToMySQLDateTime("2025-09-15T15:00:00.000Z") // "2025-09-15 15:00:00"
 * convertToMySQLDateTime("2025-09-15T15:00:00+09:00") // "2025-09-15 06:00:00" (converted to UTC)
 * convertToMySQLDateTime(new Date()) // "2025-09-23 05:30:00"
 * convertToMySQLDateTime(null) // null
 * convertToMySQLDateTime("invalid") // null
 */
export function convertToMySQLDateTime(
  dateValue: string | Date | null | undefined
): string | null {
  if (!dateValue) return null;

  try {
    const date = new Date(dateValue);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      logger.warn(`Invalid date value: ${dateValue}`);
      return null;
    }

    // Convert to MySQL DATETIME format in UTC: YYYY-MM-DD HH:MM:SS
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    logger.error(`Error converting date: ${dateValue}`, error);
    return null;
  }
}

/**
 * Return the current time in MySQL DATETIME format (UTC)
 *
 * @returns MySQL DATETIME format string of the current UTC time
 *
 * @example
 * getCurrentMySQLDateTime() // "2025-09-23 05:30:15"
 */
export function getCurrentMySQLDateTime(): string {
  return convertToMySQLDateTime(new Date())!;
}

/**
 * Convert date fields of an object to MySQL DATETIME format
 *
 * @param data - Data object to convert
 * @param dateFields - Array of date field names to convert
 * @returns New object with converted date fields
 *
 * @example
 * const userData = {
 *   name: "John",
 *   createdAt: "2025-09-15T15:00:00.000Z",
 *   updatedAt: "2025-09-15T16:00:00.000Z",
 *   email: "john@example.com"
 * };
 *
 * const converted = convertDateFieldsForMySQL(userData, ['createdAt', 'updatedAt']);
 * // {
 * //   name: "John",
 * //   createdAt: "2025-09-15 15:00:00",
 * //   updatedAt: "2025-09-15 16:00:00",
 * //   email: "john@example.com"
 * // }
 */
export function convertDateFieldsForMySQL(
  data: Record<string, any>,
  dateFields: string[]
): Record<string, any> {
  const converted = { ...data };

  dateFields.forEach((field) => {
    if (converted[field] !== undefined) {
      converted[field] = convertToMySQLDateTime(converted[field] as any);
    }
  });

  return converted;
}

/**
 * Common entity date fields
 */
export const COMMON_DATE_FIELDS = {
  AUDIT: ['createdAt', 'updatedAt'],
  AUDIT_WITH_DELETED: ['createdAt', 'updatedAt', 'deletedAt'],
  USER: ['createdAt', 'updatedAt', 'lastLoginAt', 'emailVerifiedAt'],
  GAME_WORLD: [
    'createdAt',
    'updatedAt',
    'maintenanceStartDate',
    'maintenanceEndDate',
  ],
  MESSAGE: ['createdAt', 'updatedAt', 'deletedAt'],
  CHANNEL: ['createdAt', 'updatedAt'] as const,
} as const;

/**
 * Convert MySQL DATETIME to ISO 8601 format (for frontend)
 *
 * @param mysqlDateTime - MySQL DATETIME format string or Date object
 * @returns ISO 8601 format string or null
 *
 * @example
 * convertFromMySQLDateTime("2025-09-15 15:00:00") // "2025-09-15T15:00:00.000Z"
 * convertFromMySQLDateTime(new Date()) // "2025-09-15T15:00:00.000Z"
 * convertFromMySQLDateTime(null) // null
 */
export function convertFromMySQLDateTime(
  mysqlDateTime: string | Date | null | undefined
): string | null {
  if (!mysqlDateTime) return null;

  try {
    // If already a Date object, mysql2 returns it interpreted as local time
    // but the value in DB is actually UTC, so we need to extract the local time components
    // and treat them as UTC
    if (mysqlDateTime instanceof Date) {
      if (isNaN(mysqlDateTime.getTime())) {
        logger.warn(`Invalid Date object: ${mysqlDateTime}`);
        return null;
      }
      // mysql2 interprets the UTC value from DB as local time
      // So we need to get the local components and create a UTC date from them
      const year = mysqlDateTime.getFullYear();
      const month = String(mysqlDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(mysqlDateTime.getDate()).padStart(2, '0');
      const hours = String(mysqlDateTime.getHours()).padStart(2, '0');
      const minutes = String(mysqlDateTime.getMinutes()).padStart(2, '0');
      const seconds = String(mysqlDateTime.getSeconds()).padStart(2, '0');

      // Create ISO string treating local components as UTC
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
    }

    // If already an ISO 8601 string (from knex postProcessResponse), return as-is
    if (
      typeof mysqlDateTime === 'string' &&
      mysqlDateTime.includes('T') &&
      mysqlDateTime.endsWith('Z')
    ) {
      return mysqlDateTime;
    }

    // MySQL DATETIME is saved in UTC, so append 'Z' to indicate UTC
    const isoString = mysqlDateTime.replace(' ', 'T') + '.000Z';
    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
      logger.warn(`Invalid MySQL datetime value: ${mysqlDateTime}`);
      return null;
    }

    return date.toISOString();
  } catch (error) {
    logger.error(`Error converting MySQL datetime: ${mysqlDateTime}`, error);
    return null;
  }
}

/**
 * Convert date fields from MySQL DATETIME to ISO 8601 format (for frontend response)
 *
 * @param data - Data object to convert
 * @param dateFields - Array of date field names to convert
 * @returns New object with converted date fields
 */
export function convertDateFieldsFromMySQL<T extends Record<string, any>>(
  data: T,
  dateFields: (keyof T)[]
): T {
  const converted = { ...data };

  dateFields.forEach((field) => {
    if (converted[field] !== undefined) {
      converted[field] = convertFromMySQLDateTime(
        converted[field] as any
      ) as any;
    }
  });

  return converted;
}

/**
 * Timezone info
 */
export const TIMEZONE = {
  UTC: 'UTC',
  SEOUL: 'Asia/Seoul',
  TOKYO: 'Asia/Tokyo',
  NEW_YORK: 'America/New_York',
  LONDON: 'Europe/London',
} as const;

/**
 * Convert MySQL DATETIME string to the specified timezone
 *
 * @param mysqlDateTimeStr - MySQL DATETIME format string (YYYY-MM-DD HH:MM:SS)
 * @param timezone - Timezone to convert to (Default values: Asia/Seoul)
 * @returns Formatted date string with timezone applied (YYYY-MM-DD HH:MM:SS)
 *
 * @example
 * convertMySQLDateTimeToTimezone("2025-10-30 08:30:00", "Asia/Seoul") // "2025-10-30 17:30:00"
 * convertMySQLDateTimeToTimezone("2025-10-30 08:30:00", "UTC") // "2025-10-30 08:30:00"
 */
export function convertMySQLDateTimeToTimezone(
  mysqlDateTimeStr: string | null | undefined,
  timezone: string = 'Asia/Seoul'
): string | null {
  if (!mysqlDateTimeStr) return null;

  try {
    // MySQL DATETIME is saved in UTC, so append 'Z' to parse as UTC
    const date = new Date(mysqlDateTimeStr + 'Z');

    if (isNaN(date.getTime())) {
      logger.warn(`Invalid MySQL datetime: ${mysqlDateTimeStr}`);
      return null;
    }

    // Format with specified timezone
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const second = parts.find((p) => p.type === 'second')?.value;

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    logger.error(
      `Error converting MySQL datetime to timezone: ${mysqlDateTimeStr}`,
      error
    );
    return null;
  }
}

/**
 * Database settings verification function
 *
 * @returns Current time info object
 */
export function getTimeInfo() {
  const now = new Date();
  return {
    localTime: now.toISOString(),
    mysqlFormat: convertToMySQLDateTime(now),
    timestamp: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
