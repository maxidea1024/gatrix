/**
 * SDK Configuration Types
 */

import type { ServiceLabels, ServicePorts, ServiceStatus } from './api';

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
  format?: 'pretty' | 'json'; // Output format. Default: 'pretty'
  context?: Record<string, any>; // Additional context fields to include in every log entry (JSON format only)
}

/**
 * Metrics Configuration
 */
export interface MetricsConfig {
  enabled?: boolean; // Enable SDK internal metrics (default: true)
  // Use 'any' to avoid hard dependency on prom-client types
  registry?: any; // Optional custom prom-client Registry to register metrics into
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
 * Service Discovery Configuration
 */
export interface ServiceDiscoveryConfig {
  autoRegister?: boolean; // Auto-register service during SDK initialization (default: false)
  labels?: ServiceLabels; // Service labels (required when autoRegister is true; must include labels.service)
  hostname?: string; // Optional explicit hostname; defaults to os.hostname() when omitted
  internalAddress?: string; // Optional explicit internal address; defaults to first NIC address when omitted
  ports?: ServicePorts; // Service ports (required when autoRegister is true)
  status?: ServiceStatus; // Initial service status. Default: 'ready'
  stats?: Record<string, any>; // Optional instance statistics to send on registration
  meta?: Record<string, any>; // Optional static metadata (immutable after registration)
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
}

/**
 * Main SDK Configuration
 */
export interface GatrixSDKConfig {
  // Required
  gatrixUrl: string; // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // Server API Token (required; use 'gatrix-unsecured-server-api-token' for testing)
  applicationName: string; // Application name

  // Optional - World ID for world-specific maintenance checks
  worldId?: string; // Game world ID (e.g., 'world-1', 'asia-1'). Required for isMaintenance() to check world-level maintenance.

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

  // Optional - Service discovery settings (auto-registration)
  serviceDiscovery?: ServiceDiscoveryConfig;

  // Optional - Feature toggles (for selective caching)
  features?: FeaturesConfig;

  // Optional - Target environments (for Edge server)
  // When specified, SDK loads data for these environments instead of just the current one
  // Edge server uses this to serve requests for multiple environments
  // Example: ['env_prod', 'env_staging', 'env_dev']
  // If not specified or empty, SDK operates in single-environment mode
  environments?: string[];
}

