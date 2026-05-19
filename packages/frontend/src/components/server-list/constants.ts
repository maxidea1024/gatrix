/**
 * Server List - Shared constants and utilities
 */

// Heartbeat TTL in seconds - configurable via environment variable
export const HEARTBEAT_TTL_SECONDS = parseInt(
  import.meta.env.VITE_HEARTBEAT_TTL_SECONDS || '30',
  10
);

// Status color helper function - shared across views
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ready':
      return '#4caf50';
    case 'initializing':
      return '#ffc107';
    case 'busy' as any:
      return '#ff9800';
    case 'full':
      return '#f44336';
    case 'starting':
      return '#2196f3';
    case 'terminated':
      return '#9e9e9e';
    case 'error':
      return '#f44336';
    case 'no-response':
      return '#795548';
    case 'shutting_down':
      return '#03a9f4';
    default:
      return '#9e9e9e';
  }
};

// Status translation key helper
export const getStatusTranslationKey = (status: string): string => {
  switch (status) {
    case 'no-response':
      return 'noResponse';
    case 'shutting_down':
      return 'shuttingDown';
    default:
      return status;
  }
};
