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
  autoRefresh?: boolean; // Auto refresh cache on events (default: true)
}

export interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  customLogger?: (level: string, message: string, meta?: any) => void;
}

/**
 * HTTP Retry Configuration
 */
export interface RetryConfig {
  enabled?: boolean; // Enable retry (default: true)
  maxRetries?: number; // Max retry attempts (default: 3)
  retryDelay?: number; // Initial retry delay in ms (default: 1000)
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
  apiToken?: string; // Server API Token (default: 'gatrix-unsecured-server-api-token' for testing)
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

