/**
 * Event constants for Gatrix Client SDK
 * All events use the 'flags.' prefix for namespacing
 */
export const EVENTS = {
  /** SDK initialized (from storage/bootstrap) */
  FLAGS_INIT: 'flags.init',
  /** First successful fetch completed */
  FLAGS_READY: 'flags.ready',
  /** Started fetching flags from server */
  FLAGS_FETCH: 'flags.fetch',
  /** Started fetching flags from server (alias for FETCH) */
  FLAGS_FETCH_START: 'flags.fetch_start',
  /** Successfully fetched flags from server */
  FLAGS_FETCH_SUCCESS: 'flags.fetch_success',
  /** Error occurred during fetching */
  FLAGS_FETCH_ERROR: 'flags.fetch_error',
  /** Completed fetching flags (success or error) */
  FLAGS_FETCH_END: 'flags.fetch_end',
  /** Flags changed from server */
  FLAGS_CHANGE: 'flags.change',
  /** General SDK error occurred */
  SDK_ERROR: 'flags.error',
  /** Flag accessed (if impressionData enabled) */
  FLAGS_IMPRESSION: 'flags.impression',
  /** Flags synchronized (explicitSyncMode) */
  FLAGS_SYNC: 'flags.sync',
  /** SDK recovered from error state */
  FLAGS_RECOVERED: 'flags.recovered',
  /** Metrics sent to server */
  FLAGS_METRICS_SENT: 'flags.metrics_sent',
  /** Error sending metrics */
  FLAGS_METRICS_ERROR: 'flags.metrics_error',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];
