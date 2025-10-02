/**
 * 날짜/시간 포맷 유틸 - 사용자 설정(timezone, datetimeFormat)에 따라 출력
 */
import moment from 'moment-timezone';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';

const DEFAULT_TZ = 'Asia/Seoul';
const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// UI 표시용 통일된 포맷 (사용자 설정과 별개)
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
  try { localStorage.setItem('settings.timezone', tz); } catch {}
};
export const setStoredDateTimeFormat = (fmt: string) => {
  try { localStorage.setItem('settings.datetimeFormat', fmt); } catch {}
};

// 내부: 다양한 문자열을 Date로 파싱 후 moment로 변환
function toMoment(date: string | Date): moment.Moment | null {
  let dateObj: Date | null;

  if (typeof date === 'string') {
    dateObj = parseDateString(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return null;
  }

  if (!dateObj || isNaN(dateObj.getTime())) return null;

  // parseDateString에서 이미 timezone 변환이 완료되었으므로 그대로 사용
  return moment(dateObj);
}

/**
 * 날짜만 포맷 (YYYY-MM-DD)
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const m = toMoment(date);
    return m ? m.format('YYYY-MM-DD') : '-';
  } catch { return '-'; }
};

/**
 * 날짜/시간 포맷 - 사용자 설정 포맷 사용
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const m = toMoment(date);
    return m ? m.format(getStoredDateTimeFormat()) : '-';
  } catch { return '-'; }
};

/**
 * 상세 포맷 - 사용자 설정 포맷 그대로 사용
 */
export const formatDateTimeDetailed = (date: string | Date | null | undefined): string => {
  return formatDateTime(date);
};

/**
 * UI 표시용 통일된 포맷 (YYYY-MM-DD HH:mm:ss 고정)
 * 테이블, 리스트 등에서 일관된 시간 표시를 위해 사용
 */
export const formatDateTimeUI = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const m = toMoment(date);
    return m ? m.format(UI_DISPLAY_FORMAT) : '-';
  } catch { return '-'; }
};

/**
 * 임의 포맷으로 출력 (설정된 타임존 사용)
 */
export const formatWith = (date: string | Date | null | undefined, format: string): string => {
  if (!date) return '-';
  const m = toMoment(date);
  return m ? m.format(format) : '-';
};

/**
 * 시간 간격을 사람이 읽기 쉬운 형태로 포맷
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
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

/**
 * 서버 업타임을 HH:MM:SS 형태로 포맷 (초 단위 입력)
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
 * 상대 시간 포맷 (예: "2 minutes ago", "Just now")
 */
export const formatRelativeTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';

  try {
    const m = toMoment(date);
    if (!m) return '-';

    const now = moment().tz(getStoredTimezone());
    const diffMs = now.diff(m);

    if (diffMs < 60000) { // Less than 1 minute
      return 'Just now';
    }

    if (diffMs < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    if (diffMs < 86400000) { // Less than 1 day
      const hours = Math.floor(diffMs / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(diffMs / 86400000);
    if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    return formatDate(date);
  } catch (error) {
    return '-';
  }
};

/**
 * 시간만 포맷 (HH:mm:ss)
 */
export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const m = toMoment(date);
    return m ? m.format('HH:mm:ss') : '-';
  } catch { return '-'; }
};

/**
 * 날짜 비교 유틸리티
 */
export const isToday = (date: string | Date | null | undefined): boolean => {
  if (!date) return false;
  try {
    const m = toMoment(date);
    if (!m) return false;
    const today = moment().tz(getStoredTimezone());
    return m.format('YYYY-MM-DD') === today.format('YYYY-MM-DD');
  } catch {
    return false;
  }
};

export const isYesterday = (date: string | Date | null | undefined): boolean => {
  if (!date) return false;
  try {
    const m = toMoment(date);
    if (!m) return false;
    const yesterday = moment().tz(getStoredTimezone()).subtract(1, 'day');
    return m.format('YYYY-MM-DD') === yesterday.format('YYYY-MM-DD');
  } catch {
    return false;
  }
};

// 기존 파서 유지: ISO 또는 'YYYY-MM-DD HH:mm:ss' 지원
// UTC 시간을 timezone에 맞춰 변환
function parseDateString(input: string): Date | null {
  if (!input) return null;

  const timezone = getStoredTimezone();

  // ISO 형식 (T가 포함된 경우) - UTC를 timezone으로 변환
  if (/[Tt]/.test(input)) {
    const utcDate = new Date(input);
    if (isNaN(utcDate.getTime())) return null;

    // timezone 변환 후 offset을 적용한 새로운 Date 생성
    const converted = moment.utc(utcDate).tz(timezone);
    const offsetMinutes = converted.utcOffset();
    return new Date(utcDate.getTime() + (offsetMinutes * 60 * 1000));
  }

  // 'YYYY-MM-DD HH:mm:ss' 형식 - 데이터베이스에서 오는 UTC 시간으로 처리
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})[\s](\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const utcDate = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));

    // timezone 변환 후 offset을 적용한 새로운 Date 생성
    const converted = moment.utc(utcDate).tz(timezone);
    const offsetMinutes = converted.utcOffset();
    return new Date(utcDate.getTime() + (offsetMinutes * 60 * 1000));
  }

  const fallback = new Date(input);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Get dayjs locale based on current language
 * This function is used by DateTimePicker components
 */
export const getDateLocale = (currentLang?: string): string => {
  // If no language is provided, try to get it from i18n
  const lang = currentLang || (typeof window !== 'undefined' && (window as any).i18n?.language) || 'ko';

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
