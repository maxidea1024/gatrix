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
  deviceId?: string;
  currentTime?: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Variant information from server evaluation
 */
export interface Variant {
  name: string;
  enabled: boolean;
  payload?: string | number | object; // undefined(none), string, number, json
}

/**
 * Variant type enum
 */
export type VariantType = 'none' | 'string' | 'number' | 'json';

/**
 * Evaluated flag from Edge API
 */
export interface EvaluatedFlag {
  name: string;
  enabled: boolean;
  variant: Variant;
  variantType: VariantType;
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
}

/**
 * Fetch Retry Options
 */
export interface FetchRetryOptions {
  /** Number of retry attempts (default: 3) */
  limit?: number;
  /** Backoff limit in ms (default: 8000) */
  backoffLimit?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
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
 * SDK statistics for debugging and monitoring
 */
export interface SdkStats {
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
  /** Number of errors that occurred */
  errorCount: number;
  /** Number of recoveries from error state */
  recoveryCount: number;
  /** Timestamp of last fetchFlags call */
  lastFetchTime: Date | null;
  /** Timestamp of last successful update */
  lastUpdateTime: Date | null;
  /** Timestamp of last error */
  lastErrorTime: Date | null;
  /** Timestamp of last recovery */
  lastRecoveryTime: Date | null;
  /** Last error that occurred */
  lastError: Error | null;
  /** Per-flag enabled/disabled access counts */
  flagEnabledCounts: Record<string, { yes: number; no: number }>;
  /** Per-flag variant access counts (flagName -> variantName -> count) */
  flagVariantCounts: Record<string, Record<string, number>>;
  /** Whether SDK is in offline mode */
  offlineMode: boolean;
  /** Number of syncFlags calls */
  syncFlagsCount: number;
  /** List of active watch group names */
  activeWatchGroups: string[];
  /** Current SDK state */
  sdkState: SdkState;
  /** Current ETag */
  etag: string | null;
  /** SDK start time */
  startTime: Date | null;
  /** Number of impression events sent */
  impressionCount: number;
  /** Number of context changes */
  contextChangeCount: number;
  /** Per-flag last changed times */
  flagLastChangedTimes: Record<string, Date>;
}
