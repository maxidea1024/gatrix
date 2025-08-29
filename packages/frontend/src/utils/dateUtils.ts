/**
 * @deprecated Use formatDateTime from dateFormat.ts instead for consistent timezone and format handling
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    return dateString;
  }
};

/**
 * @deprecated Use formatDate from dateFormat.ts instead for consistent timezone handling
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    return dateString;
  }
};

/**
 * @deprecated Use formatTime from dateFormat.ts instead for consistent timezone handling
 */
export const formatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  } catch (error) {
    return dateString;
  }
};

/**
 * @deprecated Use formatDuration from dateFormat.ts instead for consistency
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
 * @deprecated Use formatRelativeTime from dateFormat.ts instead for consistent timezone handling
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
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
    
    return formatDate(dateString);
  } catch (error) {
    return dateString;
  }
};

/**
 * @deprecated Use isToday from dateFormat.ts instead for consistent timezone handling
 */
export const isToday = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * @deprecated Use isYesterday from dateFormat.ts instead for consistent timezone handling
 */
export const isYesterday = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  } catch (error) {
    return false;
  }
};
