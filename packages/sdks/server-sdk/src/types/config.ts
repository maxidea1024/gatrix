/**
 * SDK Configuration Types
 */

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
  provider?: 'aws' | 'gcp' | 'azure' | 'tencentcloud' | 'alibabacloud' | 'oraclecloud';
}


/**
 * Features Configuration
 * Toggle caching features on/off based on server needs.
 * Existing features default to true for backward compatibility.
 * New features (for Edge server) default to false.
 */
export interface FeaturesConfig {
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
}

/**
 * Main SDK Configuration
 */
export interface GatrixSDKConfig {
  // Required
  gatrixUrl: string; // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // Server API Token (required; use 'gatrix-unsecured-server-api-token' for testing)
  applicationName: string; // Application name
  service: string; // Service name for identification (e.g., 'auth', 'lobby', 'world', 'chat'). Used in metrics labels and service discovery.
  group: string; // Service group for categorization (e.g., 'kr', 'us', 'production'). Used in metrics labels and service discovery.
  environment: string; // Environment identifier (e.g., 'env_prod', 'env_staging'). Used in metrics labels and service discovery.

  // Optional - Cloud configuration for auto-detecting region
  cloud?: CloudConfig; // Cloud provider configuration. Region is auto-detected from cloud metadata.

  // Optional - World ID for world-specific maintenance checks
  worldId?: string; // Game world ID (e.g., 'world-1', 'asia-1'). Required for isMaintenance() to check world-level maintenance.

  // Optional - Version information (for service discovery)
  version?: string; // Application version (e.g., git tag like 'v1.0.0'). Included in service meta during registration.
  commitHash?: string; // Git commit hash (short, 8 chars). Included in service meta during registration.
  gitBranch?: string; // Git branch name (e.g., 'main', 'develop'). Included in service meta during registration.

  // Optional - Redis (for BullMQ events)
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
  features?: FeaturesConfig;

  // Optional - Target environments (for Edge server)
  // When specified, SDK loads data for these environments instead of just the current one
  // Edge server uses this to serve requests for multiple environments
  // Values:
  //   - '*': All environments mode - dynamically handles all active environments
  //   - ['env1', 'env2', ...]: Specific environments mode - only handle listed environments
  //   - undefined or []: Single-environment mode - use current environment only
  // Example: '*' or ['development', 'production'] or ['env_prod', 'env_staging']
  environments?: string[] | '*';
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
  service?: string; // Override service name
  group?: string; // Override service group
  environment?: string; // Override environment identifier

  // Optional overrides
  gatrixUrl?: string; // Override Gatrix backend URL
  apiToken?: string; // Override API token
  applicationName?: string; // Override application name
  worldId?: string; // Override world ID
  version?: string; // Override version
  commitHash?: string; // Override commit hash
  gitBranch?: string; // Override git branch

  // Configuration overrides (deep merged)
  redis?: Partial<RedisConfig>; // Override Redis config
  cache?: Partial<CacheConfig>; // Override cache settings
  logger?: Partial<LoggerConfig>; // Override logger settings
  retry?: Partial<RetryConfig>; // Override retry settings
  metrics?: Partial<MetricsConfig>; // Override metrics settings
  features?: Partial<FeaturesConfig>; // Override feature toggles
  environments?: string[] | '*'; // Override target environments
  cloud?: Partial<CloudConfig>; // Override cloud configuration
}

