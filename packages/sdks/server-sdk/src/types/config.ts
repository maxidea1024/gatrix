/**
 * SDK Configuration Types
 */

import { ITokenProvider } from '../utils/token-provider';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface CacheConfig {
  enabled?: boolean; // Enable caching (default: true)
  ttl?: number; // Cache TTL in seconds (default: 300)
  refreshMethod?: 'polling' | 'event' | 'manual'; // Cache refresh method. 'polling': periodic refresh, 'event': real-time via Redis PubSub, 'manual': manual refresh only (default: 'polling')
  skipBackendReady?: boolean; // Skip waiting for backend to be ready during initialization (default: false). Set to true for backend self-registration to avoid infinite wait.
}

export interface LokiConfig {
  enabled?: boolean; // Enable Loki direct push (default: false)
  url: string; // Loki push URL (e.g., http://loki:3100/loki/api/v1/push)
  labels?: Record<string, string>; // Common labels for Loki (e.g., { service: 'auth' })
  batchSize?: number; // Number of logs to buffer before sending (default: 10)
  batchInterval?: number; // Maximum time in ms to wait before sending a batch (default: 5000)
}

export interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  customLogger?: (level: string, message: string, meta?: any) => void;
  timeOffset?: number; // Time offset in hours (e.g., 9 for +09:00). Default: 0 (UTC)
  timestampFormat?: 'iso8601' | 'local'; // Timestamp format. Default: 'iso8601'
  format?: 'pretty' | 'json'; // Output format. Default: 'pretty'
  context?: Record<string, any>; // Additional context fields to include in every log entry (JSON format only)
  sourceCategory?: string; // Source category for logs
  loki?: LokiConfig; // Loki configuration for direct log push
}

/**
 * Metrics Configuration
 * NOTE: Metrics is disabled by default. Set enabled: true to activate.
 */
export interface MetricsConfig {
  enabled?: boolean; // Enable SDK internal metrics (default: false - must be explicitly enabled)
  // Use 'any' to avoid hard dependency on prom-client types
  registry?: any; // Optional custom prom-client Registry to register internal metrics into

  // Metrics server configuration
  serverEnabled?: boolean; // Enable standalone metrics server (default: false)
  port?: number; // Metrics server port (default: 9337 or SDK_METRICS_PORT env)
  bindAddress?: string; // Bind address (default: 0.0.0.0 in dev, 127.0.0.1 in production)

  // Game metrics configuration
  /**
   * If true, enables a separate Prometheus registry for user-specific metrics (e.g. game data).
   */
  userMetricsEnabled?: boolean;
  collectDefaultMetrics?: boolean; // Whether to collect default Node.js metrics in game registry (default: true)
}

/**
 * HTTP Retry Configuration
 */
export interface RetryConfig {
  enabled?: boolean; // Enable retry (default: true)
  maxRetries?: number; // Max retry attempts. -1 for infinite retries (default: 10)
  retryDelay?: number; // Initial retry delay in ms (default: 2000)
  retryDelayMultiplier?: number; // Delay multiplier for exponential backoff (default: 2)
  maxRetryDelay?: number; // Max retry delay in ms (default: 10000)
  retryableStatusCodes?: number[]; // HTTP status codes to retry (default: [408, 429, 500, 502, 503, 504])
}

/**
 * Cloud Configuration
 * Used for auto-detecting cloud provider and region from instance metadata.
 */
export interface CloudConfig {
  /**
   * Cloud provider hint. If specified, SDK will try this provider first.
   * If not specified, SDK will auto-detect by trying all providers.
   * Supported providers: AWS, GCP, Azure, Tencent Cloud, Alibaba Cloud, Oracle Cloud
   */
  provider?:
    | 'aws'
    | 'gcp'
    | 'azure'
    | 'tencentcloud'
    | 'alibabacloud'
    | 'oraclecloud';
}

/**
 * Features Configuration
 * Toggle caching features on/off based on server needs.
 * Existing features default to true for backward compatibility.
 * New features (for Edge server) default to false.
 */
export interface UsesConfig {
  // Existing features - default: true (backward compatible)
  gameWorld?: boolean; // Game world caching (default: true)
  popupNotice?: boolean; // Popup notice caching (default: true)
  survey?: boolean; // Survey caching (default: true)
  whitelist?: boolean; // Whitelist caching (default: true)
  serviceMaintenance?: boolean; // Service maintenance caching (default: true)

  // New features for Edge server - default: false
  clientVersion?: boolean; // Client version caching (default: false)
  serviceNotice?: boolean; // Service notice caching (default: false)
  banner?: boolean; // Banner caching (default: false)
  storeProduct?: boolean; // Store product caching (default: false)
  featureFlag?: boolean; // Feature flag caching and evaluation (default: false)
  vars?: boolean; // Vars (KV) caching (default: false)
}

/**
 * Feature Flag Configuration
 * Settings specific to the feature flag evaluation engine
 */
export interface FeatureFlagConfig {
  /** When true, disabled flags are fetched without strategies/variants/enabledValue to reduce bandwidth (default: true) */
  compact?: boolean;
}

/**
 * Main SDK Configuration
 */
export interface GatrixSDKConfig {
  // Required — only url + token + applicationName
  apiUrl: string; // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // Server API Token (required; use 'unsecured-server-api-token' for testing)
  applicationName: string; // Application name

  // Optional - Service identification (for metrics labels and service discovery)
  service?: string; // Service name (e.g., 'auth', 'lobby', 'world', 'chat')
  group?: string; // Service group (e.g., 'kr', 'us', 'production')

  // Optional - Token provider for multi-token mode (e.g., Edge server)
  // When not provided, SDK uses SingleTokenProvider with the apiToken.
  // Each token maps to exactly one environment (1:1).
  tokenProvider?: ITokenProvider;

  // Optional - Cloud configuration for auto-detecting region
  cloud?: CloudConfig;

  // Optional - World ID for world-specific maintenance checks
  worldId?: string;

  // Optional - Version information (for service discovery)
  version?: string;
  commitHash?: string;
  gitBranch?: string;

  // Optional - Redis (for PubSub events)
  redis?: RedisConfig;

  // Optional - Cache settings
  cache?: CacheConfig;

  // Optional - Logger settings
  logger?: LoggerConfig;

  // Optional - HTTP retry settings
  retry?: RetryConfig;

  // Optional - Metrics settings
  metrics?: MetricsConfig;

  // Optional - Feature toggles (for selective caching)
  uses?: UsesConfig;

  // Optional - Feature flag specific settings
  featureFlags?: FeatureFlagConfig;
}

/**
 * SDK Initialization Override Options
 * Use this to override config values when creating SDK instances per-program/service.
 * All fields are optional - unspecified fields use values from the base GatrixSDKConfig.
 *
 * @example
 * ```typescript
 * // Base config (shared across programs)
 * const baseConfig: GatrixSDKConfig = { ... };
 *
 * // Create instance with overrides for specific program
 * const sdk = GatrixServerSDK.createInstance(baseConfig, {
 *   service: 'billing-worker',
 *   group: 'payment',
 *   worldId: 'world-1',
 *   logger: { level: 'debug' },
 * });
 * ```
 */
export interface GatrixSDKInitOptions {
  // Core identification overrides
  service?: string;
  group?: string;

  // Optional overrides
  apiUrl?: string;
  apiToken?: string;
  applicationName?: string;
  worldId?: string;
  version?: string;
  commitHash?: string;
  gitBranch?: string;

  // Configuration overrides (deep merged)
  redis?: Partial<RedisConfig>;
  cache?: Partial<CacheConfig>;
  logger?: Partial<LoggerConfig>;
  retry?: Partial<RetryConfig>;
  metrics?: Partial<MetricsConfig>;
  uses?: Partial<UsesConfig>;
  featureFlags?: Partial<FeatureFlagConfig>;
  cloud?: Partial<CloudConfig>;
  tokenProvider?: ITokenProvider;
}
