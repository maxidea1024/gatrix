/**
 * SDK statistics type definitions
 */

/**
 * SDK internal state
 */
export type SdkState = 'initializing' | 'ready' | 'healthy' | 'error';

/**
 * Streaming connection state
 */
export type StreamingConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded';

/**
 * Error event payload
 */
export interface ErrorEvent {
  type: string;
  error?: Error | unknown;
  code?: number;
}

/**
 * Server invalidation event payload
 */
export interface FlagsChangedEvent {
  globalRevision: number;
  changedKeys: string[];
}

/**
 * Event handler statistics
 */
export interface EventHandlerStats {
  name: string;
  callCount: number;
  isOnce: boolean;
  registeredAt: Date;
}

/**
 * Common SDK statistics (lightweight — scalar values only, no Map iteration)
 */
export interface GatrixSdkLightStats {
  sdkState: SdkState;
  startTime: Date | null;
  connectionId: string;
  errorCount: number;
  lastError: Error | unknown | null;
  lastErrorTime: Date | null;
  offlineMode: boolean;
  /** Lightweight feature flag statistics */
  features: FeaturesLightStats;
}

/**
 * Common SDK statistics
 */
export interface GatrixSdkStats {
  sdkState: SdkState;
  startTime: Date | null;
  connectionId: string;
  errorCount: number;
  lastError: Error | unknown | null;
  lastErrorTime: Date | null;
  offlineMode: boolean;
  /** Feature flag specific statistics */
  features: FeaturesStats;
  /** Event handler monitoring statistics */
  eventHandlerStats: Record<string, EventHandlerStats[]>;
}

/**
 * Lightweight feature flag statistics.
 * Contains only scalar/primitive values that can be read without Map iteration.
 * Use this for frequent polling or low-overhead diagnostics.
 */
export interface FeaturesLightStats {
  /** Current SDK state */
  sdkState: SdkState;
  /** Last error */
  lastError: unknown;
  /** SDK start time */
  startTime: Date | null;
  /** Timestamp of last fetchFlags call */
  lastFetchTime: Date | null;
  /** Timestamp of last successful update */
  lastUpdateTime: Date | null;
  /** Timestamp of last recovery */
  lastRecoveryTime: Date | null;
  /** Timestamp of last error */
  lastErrorTime: Date | null;
  /** Number of fetchFlags calls */
  fetchFlagsCount: number;
  /** Number of successful updates (flag data changed) */
  updateCount: number;
  /** Number of 304 Not Modified responses */
  notModifiedCount: number;
  /** Number of recoveries from error state */
  recoveryCount: number;
  /** Number of fetch errors */
  errorCount: number;
  /** Number of syncFlags calls */
  syncFlagsCount: number;
  /** Number of impression events sent */
  impressionCount: number;
  /** Number of context changes */
  contextChangeCount: number;
  /** Number of metrics payloads sent */
  metricsSentCount: number;
  /** Number of metrics send errors */
  metricsErrorCount: number;
  /** Current ETag */
  etag: string | null;
  /** Current streaming connection state */
  streamingState: StreamingConnectionState;
  /** Number of streaming reconnection attempts */
  streamingReconnectCount: number;
  /** Timestamp of last streaming event received */
  lastStreamingEventTime: Date | null;
  /** Number of 'connected' events received from streaming */
  streamingConnectedCount: number;
  /** Number of 'flags_changed' invalidation events received from streaming */
  streamingFlagsChangedCount: number;
  /** Number of 'heartbeat' events received from streaming */
  streamingHeartbeatCount: number;
}

/**
 * Feature flag specific statistics
 */
export interface FeaturesStats {
  /** Total number of flags in cache */
  totalFlagCount: number;
  /** Map of missing flag names to access count */
  missingFlags: Record<string, number>;
  /** Number of fetchFlags calls */
  fetchFlagsCount: number;
  /** Number of successful updates (flag data changed) */
  updateCount: number;
  /** Number of 304 Not Modified responses */
  notModifiedCount: number;
  /** Number of recoveries from error state */
  recoveryCount: number;
  /** Number of fetch errors */
  errorCount: number;
  /** Current SDK state */
  sdkState: SdkState;
  /** Last error */
  lastError: unknown;
  /** SDK start time */
  startTime: Date | null;
  /** Timestamp of last fetchFlags call */
  lastFetchTime: Date | null;
  /** Timestamp of last successful update */
  lastUpdateTime: Date | null;
  /** Timestamp of last recovery */
  lastRecoveryTime: Date | null;
  /** Timestamp of last error */
  lastErrorTime: Date | null;
  /** Per-flag enabled/disabled access counts */
  flagEnabledCounts: Record<string, { yes: number; no: number }>;
  /** Per-flag variant access counts (flagName -> variantName -> count) */
  flagVariantCounts: Record<string, Record<string, number>>;
  /** Number of syncFlags calls */
  syncFlagsCount: number;
  /** List of active watch group names */
  activeWatchGroups: string[];
  /** Current ETag */
  etag: string | null;
  /** Number of impression events sent */
  impressionCount: number;
  /** Number of context changes */
  contextChangeCount: number;
  /** Per-flag last changed times */
  flagLastChangedTimes: Record<string, Date>;
  /** Number of metrics payloads sent */
  metricsSentCount: number;
  /** Number of metrics send errors */
  metricsErrorCount: number;
  /** Current streaming connection state */
  streamingState: StreamingConnectionState;
  /** Number of streaming reconnection attempts */
  streamingReconnectCount: number;
  /** Timestamp of last streaming event received */
  lastStreamingEventTime: Date | null;
  /** Number of 'connected' events received from streaming */
  streamingConnectedCount: number;
  /** Number of 'flags_changed' invalidation events received from streaming */
  streamingFlagsChangedCount: number;
  /** Number of 'heartbeat' events received from streaming */
  streamingHeartbeatCount: number;
}
