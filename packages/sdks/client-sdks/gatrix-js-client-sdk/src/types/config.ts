/**
 * SDK configuration type definitions
 */
import { StorageProvider } from '../StorageProvider';
import { Logger } from '../Logger';
import { EvaluatedFlag } from './flag';
import { StreamingConfig } from './streaming';
import { GatrixContext } from './context';


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
    /** Initial SDK-level backoff delay in seconds for consecutive failures (default: 1) */
    initialBackoff?: number;
    /** Maximum SDK-level backoff delay in seconds (default: 60) */
    maxBackoff?: number;
}

/**
 * Features configuration (feature flag specific settings).
 */
export interface FeaturesConfig {
    /** Initial evaluation context */
    context?: GatrixContext;

    /** Custom storage provider */
    storageProvider?: StorageProvider;

    /** Start in offline mode (no network requests, use cached/bootstrap flags) */
    offlineMode?: boolean;

    /** Cache key prefix for storage keys (default: 'gatrix_cache') */
    cacheKeyPrefix?: string;

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

    /** Custom HTTP headers */
    customHeaders?: Record<string, string>;

    /** Custom logger implementation */
    logger?: Logger;

    /** Enable dev mode for detailed debug logging (default: false) */
    enableDevMode?: boolean;

    /** Feature flags configuration */
    features?: FeaturesConfig;
}
