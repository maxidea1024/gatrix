/**
 * Event constants for Gatrix Client SDK
 * All events use the 'flags.' prefix for namespacing
 */
export const EVENTS = {
  /** SDK initialized (from storage/bootstrap) */
  INIT: 'flags.init',
  /** First successful fetch completed */
  READY: 'flags.ready',
  /** Started fetching flags from server */
  FETCH: 'flags.fetch',
  /** Started fetching flags from server (alias for FETCH) */
  FETCH_START: 'flags.fetch_start',
  /** Successfully fetched flags from server */
  FETCH_SUCCESS: 'flags.fetch_success',
  /** Error occurred during fetching */
  FETCH_ERROR: 'flags.fetch_error',
  /** Completed fetching flags (success or error) */
  FETCH_END: 'flags.fetch_end',
  /** Flags changed from server */
  CHANGE: 'flags.change',
  /** Error occurred */
  ERROR: 'flags.error',
  /** Flag accessed (if impressionData enabled) */
  IMPRESSION: 'flags.impression',
  /** Flags synchronized (explicitSyncMode) */
  SYNC: 'flags.sync',
  /** SDK recovered from error state */
  RECOVERED: 'flags.recovered',
  /** Metrics sent to server */
  METRICS_SENT: 'flags.metrics_sent',
  /** Error sending metrics */
  METRICS_ERROR: 'flags.metrics_error',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];
