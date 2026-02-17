/**
 * Type definitions for Gatrix Client SDK
 */
import { StorageProvider } from './StorageProvider';
import { Logger } from './Logger';

/**
 * Evaluation context (global for client-side)
 * appName and environment are system fields - always present and cannot be removed
 */
export interface GatrixContext {
  /** Application name (system field - cannot be removed) */
  appName?: string;
  /** Environment name (system field - cannot be removed) */
  environment?: string;
  userId?: string;
  sessionId?: string;
  currentTime?: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Variant information from server evaluation
 */
export interface Variant {
  name: string;
  enabled: boolean;
  value?: string | number | boolean | object; // undefined(none), string, number, boolean, json
}

/**
 * Variant type enum
 */
export type ValueType = 'none' | 'string' | 'number' | 'boolean' | 'json';

/**
 * Evaluated flag from Edge API
 */
export interface EvaluatedFlag {
  name: string;
  enabled: boolean;
  variant: Variant;
  valueType: ValueType;
  enabledValue?: any;
  disabledValue?: any;
  version: number;
  reason?: string;
  impressionData?: boolean;
}

/**
 * API response containing evaluated flags (from Edge or backend)
 */
export interface FlagsApiResponse {
  success: boolean;
  data: {
    flags: EvaluatedFlag[];
  };
  meta: {
    environment: string;
    evaluatedAt: string;
  };
}

/**
 * Impression event data
 */
export interface ImpressionEvent {
  eventType: 'isEnabled' | 'getVariant';
  eventId: string;
  context: GatrixContext;
  enabled: boolean;
  featureName: string;
  impressionData: boolean;
  variantName?: string;
  reason?: string;
}

/**
 * Features configuration (feature flag specific settings)
 */
export interface FeaturesConfig {
  /** Seconds between polls (default: 30) */
  refreshInterval?: number;

  /** Disable automatic polling */
  disableRefresh?: boolean;

  /** Enable explicit sync mode */
  explicitSyncMode?: boolean;

  /** Initial flags for instant availability */
  bootstrap?: EvaluatedFlag[];

  /** Override stored flags with bootstrap (default: true) */
  bootstrapOverride?: boolean;

  /** Disable metrics collection */
  disableMetrics?: boolean;

  /** Track impressions for all flags */
  impressionDataAll?: boolean;

  /** Cache TTL in seconds (default: 0 = no expiration) */
  cacheTtlSeconds?: number;

  /** Use POST requests instead of GET (prevents sensitive context fields from appearing in URL) */
  usePOSTrequests?: boolean;

  /** Initial delay before first metrics send (default: 2 seconds) */
  metricsIntervalInitial?: number;

  /** Metrics send interval (default: 60 seconds) */
  metricsInterval?: number;

  /** Retry options for fetch requests */
  fetchRetryOptions?: FetchRetryOptions;

  /** Disable local statistics tracking (default: false = tracking enabled) */
  disableStats?: boolean;

  /** Streaming configuration for real-time flag invalidation */
  streaming?: StreamingConfig;
}

/**
 * Streaming configuration for real-time flag invalidation via SSE
 */
export interface StreamingConfig {
  /** Enable streaming (default: true) */
  enabled?: boolean;

  /** Streaming endpoint URL override (default: derived from apiUrl) */
  url?: string;

  /** Reconnect initial delay in seconds (default: 1) */
  reconnectBase?: number;

  /** Reconnect max delay in seconds (default: 30) */
  reconnectMax?: number;

  /** Polling jitter range in seconds to prevent thundering herd (default: 5) */
  pollingJitter?: number;
}

/**
 * Fetch Retry Options
 */
export interface FetchRetryOptions {
  /** Number of retry attempts for ky (default: 2) */
  limit?: number;
  /** Backoff limit for ky in ms (default: 8000) */
  backoffLimit?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /**
   * Status codes that should stop polling entirely (default: [401, 403]).
   * When a response with one of these codes is received, polling stops
   * and must be restarted manually via fetchFlags().
   */
  nonRetryableStatusCodes?: number[];
  /** Initial SDK-level backoff delay in ms for consecutive failures (default: 1000) */
  initialBackoffMs?: number;
  /** Maximum SDK-level backoff delay in ms (default: 60000) */
  maxBackoffMs?: number;
}

/**
 * SDK Configuration
 */
export interface GatrixClientConfig {
  // ==================== Required ====================

  /** Base API URL (e.g., http://localhost:45000/api/v1) */
  apiUrl: string;

  /** Client API token */
  apiToken: string;

  /** Application name */
  appName: string;

  /** Environment name (required, e.g., 'development', 'production') */
  environment: string;

  // ==================== Common Settings ====================

  /** Initial context */
  context?: GatrixContext;

  /** Custom storage provider */
  storageProvider?: StorageProvider;

  /** Custom HTTP headers */
  customHeaders?: Record<string, string>;

  /** Custom logger implementation */
  logger?: Logger;

  // ==================== Feature-specific Settings ====================

  /** Start in offline mode (no network requests, use cached/bootstrap flags) */
  offlineMode?: boolean;

  /** Enable dev mode for detailed debug logging (default: false) */
  enableDevMode?: boolean;

  /** Cache key prefix for storage keys (default: 'gatrix_cache') */
  cacheKeyPrefix?: string;

  /** Feature flags configuration */
  features?: FeaturesConfig;
}

/**
 * Variation result with details (value + reason)
 */
export interface VariationResult<T> {
  value: T;
  reason: string;
  flagExists: boolean;
  enabled: boolean;
  /** Variant name reported by the evaluation (e.g. '$type-mismatch', '$missing') */
  variantName?: string;
}

/**
 * Error event payload
 */
export interface ErrorEvent {
  type: string;
  error?: Error | unknown;
  code?: number;
}

/**
 * SDK internal state
 */
export type SdkState = 'initializing' | 'ready' | 'healthy' | 'error';

/**
 * Streaming connection state
 */
export type StreamingConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'degraded';

/**
 * Server invalidation event payload
 */
export interface FlagsChangedEvent {
  globalRevision: number;
  changedKeys: string[];
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
 * Event handler statistics
 */
export interface EventHandlerStats {
  name: string;
  callCount: number;
  isOnce: boolean;
  registeredAt: Date;
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
}
