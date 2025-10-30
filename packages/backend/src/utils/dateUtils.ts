/**
 * 날짜 변환 유틸리티
 * 
 * 모든 날짜는 UTC로 저장되며, MySQL DATETIME 형식으로 변환됩니다.
 */

/**
 * ISO 8601 날짜 문자열을 MySQL DATETIME 형식(UTC)으로 변환
 * 
 * @param dateValue - ISO 8601 형식의 날짜 문자열 또는 Date 객체
 * @returns MySQL DATETIME 형식 문자열 (YYYY-MM-DD HH:MM:SS) 또는 null
 * 
 * @example
 * convertToMySQLDateTime("2025-09-15T15:00:00.000Z") // "2025-09-15 15:00:00"
 * convertToMySQLDateTime("2025-09-15T15:00:00+09:00") // "2025-09-15 06:00:00" (UTC로 변환)
 * convertToMySQLDateTime(new Date()) // "2025-09-23 05:30:00"
 * convertToMySQLDateTime(null) // null
 * convertToMySQLDateTime("invalid") // null
 */
export function convertToMySQLDateTime(dateValue: string | Date | null | undefined): string | null {
  if (!dateValue) return null;
  
  try {
    const date = new Date(dateValue);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date value: ${dateValue}`);
      return null;
    }
    
    // UTC 시간으로 MySQL DATETIME 형식 변환: YYYY-MM-DD HH:MM:SS
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error(`Error converting date: ${dateValue}`, error);
    return null;
  }
}

/**
 * 현재 시간을 MySQL DATETIME 형식(UTC)으로 반환
 * 
 * @returns 현재 UTC 시간의 MySQL DATETIME 형식 문자열
 * 
 * @example
 * getCurrentMySQLDateTime() // "2025-09-23 05:30:15"
 */
export function getCurrentMySQLDateTime(): string {
  return convertToMySQLDateTime(new Date())!;
}

/**
 * 객체의 날짜 필드들을 MySQL DATETIME 형식으로 변환
 * 
 * @param data - 변환할 데이터 객체
 * @param dateFields - 변환할 날짜 필드명 배열
 * @returns 날짜 필드가 변환된 새로운 객체
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

  dateFields.forEach(field => {
    if (converted[field] !== undefined) {
      converted[field] = convertToMySQLDateTime(converted[field] as any);
    }
  });

  return converted;
}

/**
 * 일반적인 엔티티 날짜 필드들
 */
export const COMMON_DATE_FIELDS = {
  AUDIT: ['createdAt', 'updatedAt'],
  AUDIT_WITH_DELETED: ['createdAt', 'updatedAt', 'deletedAt'],
  USER: ['createdAt', 'updatedAt', 'lastLoginAt', 'emailVerifiedAt'],
  GAME_WORLD: ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate'],
  MESSAGE: ['createdAt', 'updatedAt', 'deletedAt'],
  CHANNEL: ['createdAt', 'updatedAt'] as const,
} as const;

/**
 * MySQL에서 반환된 DATETIME을 ISO 8601 형식으로 변환 (프론트엔드용)
 *
 * @param mysqlDateTime - MySQL DATETIME 형식 문자열 또는 Date 객체
 * @returns ISO 8601 형식 문자열 또는 null
 *
 * @example
 * convertFromMySQLDateTime("2025-09-15 15:00:00") // "2025-09-15T15:00:00.000Z"
 * convertFromMySQLDateTime(new Date()) // "2025-09-15T15:00:00.000Z"
 * convertFromMySQLDateTime(null) // null
 */
export function convertFromMySQLDateTime(mysqlDateTime: string | Date | null | undefined): string | null {
  if (!mysqlDateTime) return null;

  try {
    // If already a Date object, convert directly
    if (mysqlDateTime instanceof Date) {
      if (isNaN(mysqlDateTime.getTime())) {
        console.warn(`Invalid Date object: ${mysqlDateTime}`);
        return null;
      }
      return mysqlDateTime.toISOString();
    }

    // MySQL DATETIME은 UTC로 저장되어 있으므로 'Z'를 추가하여 UTC임을 명시
    const isoString = mysqlDateTime.replace(' ', 'T') + '.000Z';
    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
      console.warn(`Invalid MySQL datetime value: ${mysqlDateTime}`);
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.error(`Error converting MySQL datetime: ${mysqlDateTime}`, error);
    return null;
  }
}

/**
 * 객체의 날짜 필드들을 MySQL DATETIME에서 ISO 8601 형식으로 변환 (프론트엔드 응답용)
 * 
 * @param data - 변환할 데이터 객체
 * @param dateFields - 변환할 날짜 필드명 배열
 * @returns 날짜 필드가 변환된 새로운 객체
 */
export function convertDateFieldsFromMySQL<T extends Record<string, any>>(
  data: T,
  dateFields: (keyof T)[]
): T {
  const converted = { ...data };
  
  dateFields.forEach(field => {
    if (converted[field] !== undefined) {
      converted[field] = convertFromMySQLDateTime(converted[field] as any) as any;
    }
  });
  
  return converted;
}

/**
 * 타임존 정보
 */
export const TIMEZONE = {
  UTC: 'UTC',
  SEOUL: 'Asia/Seoul',
  TOKYO: 'Asia/Tokyo',
  NEW_YORK: 'America/New_York',
  LONDON: 'Europe/London',
} as const;

/**
 * MySQL DATETIME 문자열을 지정된 타임존으로 변환
 *
 * @param mysqlDateTimeStr - MySQL DATETIME 형식 문자열 (YYYY-MM-DD HH:MM:SS)
 * @param timezone - 변환할 타임존 (기본값: Asia/Seoul)
 * @returns 타임존이 적용된 포맷된 날짜 문자열 (YYYY-MM-DD HH:MM:SS)
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
    // MySQL DATETIME은 UTC로 저장되므로 'Z'를 붙여서 UTC로 파싱
    const date = new Date(mysqlDateTimeStr + 'Z');

    if (isNaN(date.getTime())) {
      console.warn(`Invalid MySQL datetime: ${mysqlDateTimeStr}`);
      return null;
    }

    // 지정된 타임존으로 포맷
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    console.error(`Error converting MySQL datetime to timezone: ${mysqlDateTimeStr}`, error);
    return null;
  }
}

/**
 * 데이터베이스 설정 확인용 함수
 *
 * @returns 현재 시간 정보 객체
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
