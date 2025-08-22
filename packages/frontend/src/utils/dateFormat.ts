/**
 * 날짜 포맷팅 유틸리티 함수들
 */

/**
 * 날짜를 로컬 날짜 문자열로 포맷 (YYYY-MM-DD)
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    
    return dateObj.toLocaleDateString();
  } catch {
    return '-';
  }
};

/**
 * 날짜와 시간을 로컬 문자열로 포맷 (YYYY-MM-DD HH:MM:SS)
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    
    return dateObj.toLocaleString();
  } catch {
    return '-';
  }
};

/**
 * 날짜와 시간을 상세 포맷으로 표시 (YYYY-MM-DD HH:MM:SS)
 */
export const formatDateTimeDetailed = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return '-';
  }
};
