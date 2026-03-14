/**
 * Date/time format utility - output based on user settings (timezone, datetimeFormat)
 */
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import i18next from 'i18next';

// Enable plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const DEFAULT_TZ = 'Asia/Seoul';
const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Unified format for UI display (Used자 Settings과 별개)
const UI_DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const getStoredTimezone = (): string => {
  try {
    return localStorage.getItem('settings.timezone') || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
};

export const getStoredDateTimeFormat = (): string => {
  try {
    return localStorage.getItem('settings.datetimeFormat') || DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
};

export const setStoredTimezone = (tz: string) => {
  try {
    localStorage.setItem('settings.timezone', tz);
  } catch {}
};
export const setStoredDateTimeFormat = (fmt: string) => {
  try {
    localStorage.setItem('settings.datetimeFormat', fmt);
  } catch {}
};

// 내부: 다양한 문자열을 dayjs로 변환 (UTC -> Used자 timezone)
function toDayjs(date: string | Date): Dayjs | null {
  if (!date) return null;

  const timezone = getStoredTimezone();

  try {
    // Parse as UTC and convert to user's timezone
    const parsed = dayjs.utc(date);
    if (!parsed.isValid()) return null;
    return parsed.tz(timezone);
  } catch {
    return null;
  }
}

/**
 * Format date only (YYYY-MM-DD)
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = toDayjs(date);
    return d ? d.format('YYYY-MM-DD') : '-';
  } catch {
    return '-';
  }
};

/**
 * Format date/time - using user settings format
 */
export const formatDateTime = (
  date: string | Date | null | undefined
): string => {
  if (!date) return '-';
  try {
    const d = toDayjs(date);
    return d ? d.format(getStoredDateTimeFormat()) : '-';
  } catch {
    return '-';
  }
};

/**
 * Detailed format - using user settings format as-is
 */
export const formatDateTimeDetailed = (
  date: string | Date | null | undefined
): string => {
  return formatDateTime(date);
};

/**
 * Unified format for UI display (YYYY-MM-DD HH:mm:ss 고정)
 * 테이블, 리스트 등에서 일관된 시간 표시를 위해 Used
 */
export const formatDateTimeUI = (
  date: string | Date | null | undefined
): string => {
  if (!date) return '-';
  try {
    const d = toDayjs(date);
    return d ? d.format(UI_DISPLAY_FORMAT) : '-';
  } catch {
    return '-';
  }
};

/**
 * Output with custom format (using configured timezone)
 */
export const formatWith = (
  date: string | Date | null | undefined,
  format: string
): string => {
  if (!date) return '-';
  const d = toDayjs(date);
  return d ? d.format(format) : '-';
};

/**
 * Format time interval in human-readable form
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

/**
 * Format server uptime as HH:MM:SS (input in seconds)
 */
export const formatUptime = (uptimeSeconds: number): string => {
  const totalSeconds = Math.floor(uptimeSeconds);

  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 24시간 미만인 경우 HH:MM:SS 형태
  if (days === 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 24시간 이상인 경우 Dd HH:MM:SS 형태
  return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format time only (HH:mm:ss)
 */
export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = toDayjs(date);
    return d ? d.format('HH:mm:ss') : '-';
  } catch {
    return '-';
  }
};

/**
 * Relative time format options
 */
interface FormatRelativeTimeOptions {
  /** 초단위 표시 여부 (기본: false, true이면 "5초 전" 형태로 표시) */
  showSeconds?: boolean;
  /** 기준 시간 (기본: 현재 시간) */
  baseTime?: string | Date | number;
}

/**
 * Relative time format (예: "2 minutes ago", "Just now")
 * @param date 날짜/시간 값
 * @param options 옵션 (showSeconds: 초단위 표시 여부)
 * @param language 언어 코드 (옵션, i18n의 현재 언어)
 */
export const formatRelativeTime = (
  date: string | Date | null | undefined,
  options?: FormatRelativeTimeOptions,
  language?: string
): string => {
  if (!date) return '-';

  try {
    // Determine language and set dayjs locale
    const lang = getDateLocale(language);

    const d = toDayjs(date);
    if (!d) return '-';

    // If showSeconds option is enabled, calculate seconds for recent times
    const now = options?.baseTime ? dayjs(options.baseTime) : dayjs();

    // Handle future dates (prevent "in ... seconds" or "방금 후")
    if (d.isAfter(now)) {
      if (lang === 'ko') return '방금 전';
      if (lang === 'zh-cn' || lang === 'zh') return '刚刚';
      return 'Just now';
    }

    const diffSeconds = now.diff(d, 'second');

    // Within 5 minutes: show "just now"
    if (diffSeconds >= 0 && diffSeconds < 300) {
      if (lang === 'ko') return '방금 전';
      if (lang === 'zh-cn' || lang === 'zh') return '刚刚';
      return 'Just now';
    }

    if (options?.showSeconds) {
      // Less than 60 seconds: show exact seconds (only reached if threshold above is changed)
      if (diffSeconds >= 0 && diffSeconds < 60) {
        if (lang === 'ko') return `${diffSeconds}초 전`;
        if (lang === 'zh-cn' || lang === 'zh') return `${diffSeconds}秒前`;
        return `${diffSeconds} seconds ago`;
      }
    }

    return d.from(now);
  } catch (error) {
    return '-';
  }
};

/**
 * 날짜 비교 Utility
 */
export const isToday = (date: string | Date | null | undefined): boolean => {
  if (!date) return false;
  try {
    const d = toDayjs(date);
    if (!d) return false;
    const today = dayjs().tz(getStoredTimezone());
    return d.format('YYYY-MM-DD') === today.format('YYYY-MM-DD');
  } catch {
    return false;
  }
};

export const isYesterday = (
  date: string | Date | null | undefined
): boolean => {
  if (!date) return false;
  try {
    const d = toDayjs(date);
    if (!d) return false;
    const yesterday = dayjs().tz(getStoredTimezone()).subtract(1, 'day');
    return d.format('YYYY-MM-DD') === yesterday.format('YYYY-MM-DD');
  } catch {
    return false;
  }
};

/**
 * Get dayjs locale based on current language
 * This function is used by DateTimePicker components
 */
export const getDateLocale = (currentLang?: string): string => {
  // If no language is provided, try to get it from i18n
  const lang = currentLang || i18next.language || 'ko';

  switch (lang) {
    case 'en':
      dayjs.locale('en');
      return 'en';
    case 'zh':
      dayjs.locale('zh-cn');
      return 'zh-cn';
    default:
      dayjs.locale('ko');
      return 'ko';
  }
};

/**
 * Parse UTC date string to Dayjs object in user's timezone
 * Use this for DateTimePicker value prop
 *
 * @param utcDateString - UTC date string (ISO 8601 format)
 * @returns Dayjs object in user's timezone, or null if invalid
 *
 * @example
 * // Database has: "2025-10-20T03:00:00.000Z" (UTC)
 * // User timezone: Asia/Seoul (UTC+9)
 * // Returns: Dayjs object representing "2025-10-20 12:00:00" in Seoul timezone
 * const date = parseUTCForPicker("2025-10-20T03:00:00.000Z");
 * <DateTimePicker value={date} />
 */
export const parseUTCForPicker = (
  utcDateString: string | null | undefined
): Dayjs | null => {
  if (!utcDateString) return null;

  try {
    const timezone = getStoredTimezone();
    // Parse as UTC and convert to user's timezone
    const parsed = dayjs.utc(utcDateString).tz(timezone);
    return parsed.isValid() ? parsed : null;
  } catch {
    return null;
  }
};
