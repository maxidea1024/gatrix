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
}

export interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  customLogger?: (level: string, message: string, meta?: any) => void;
  timeOffset?: number; // Time offset in hours (e.g., 9 for +09:00). Default: 0 (UTC)
  timestampFormat?: 'iso8601' | 'local'; // Timestamp format. Default: 'iso8601'
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
 * Main SDK Configuration
 */
export interface GatrixSDKConfig {
  // Required
  gatrixUrl: string; // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // Server API Token (required; use 'gatrix-unsecured-server-api-token' for testing)
  applicationName: string; // Application name

  // Optional - Redis (for BullMQ events)
  redis?: RedisConfig;

  // Optional - Cache settings
  cache?: CacheConfig;

  // Optional - Logger settings
  logger?: LoggerConfig;

  // Optional - HTTP retry settings
  retry?: RetryConfig;
}

