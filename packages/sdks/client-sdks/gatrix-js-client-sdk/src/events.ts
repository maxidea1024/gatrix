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
  /** Flags updated from server */
  UPDATE: 'flags.update',
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
