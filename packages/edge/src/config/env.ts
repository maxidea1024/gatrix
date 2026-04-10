import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  port: parseInt(process.env.EDGE_PORT || '3400', 10),
  metricsPort: parseInt(process.env.EDGE_METRICS_PORT || '9400', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Public-facing URL for this Edge server (used to generate URLs sent to clients)
  // e.g. EDGE_PUBLIC_URL=https://yourdomain.com:3400
  // If not set, falls back to req.protocol + req.get('host') at runtime
  publicUrl: process.env.EDGE_PUBLIC_URL || '',

  // Backend API configuration
  gatrixUrl: process.env.GATRIX_URL || 'http://localhost:45000',

  // Edge bypass token - allows access to all environments and internal APIs
  // Can be configured via EDGE_BYPASS_TOKEN or EDGE_API_TOKEN environment variable
  apiToken:
    process.env.EDGE_BYPASS_TOKEN ||
    process.env.EDGE_API_TOKEN ||
    'gatrix-infra-server-token',
  appName: process.env.EDGE_APPLICATION_NAME || 'edge-server',

  // SDK required fields for metrics labels and service discovery
  meta: {
    service: process.env.EDGE_SERVICE || 'edge',
    group: process.env.EDGE_GROUP || 'gatrix',
    environment: process.env.EDGE_ENVIRONMENT || 'gatrix-env', //TODO 실제 환경이랑 매칭이 되는지?
  },

  // Redis configuration (for cache PubSub in event mode)
  // Priority: EDGE_REDIS_* > REDIS_* (global fallback)
  redis: {
    host: process.env.EDGE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(
      process.env.EDGE_REDIS_PORT || process.env.REDIS_PORT || '6379',
      10
    ),
    password:
      process.env.EDGE_REDIS_PASSWORD ||
      process.env.REDIS_PASSWORD ||
      undefined,
    db: parseInt(process.env.EDGE_REDIS_DB || process.env.REDIS_DB || '0', 10),
  },

  // Cache configuration
  cache: {
    pollingIntervalMs: parseInt(
      process.env.EDGE_CACHE_POLLING_INTERVAL_MS || '30000',
      10
    ),
    syncMethod: (process.env.EDGE_SYNC_METHOD || 'polling') as
      | 'polling'
      | 'event'
      | 'manual',
  },

  // Logging
  logLevel: process.env.EDGE_LOG_LEVEL || 'info',

  // Security configuration
  security: {
    // Rate limiting: max requests per second per IP (0 = disabled)
    rateLimitRps: parseInt(process.env.EDGE_RATE_LIMIT_RPS || '0', 10),
    // Comma-separated list of allowed IPs/CIDRs
    allowIps: process.env.EDGE_ALLOW_IPS || '',
    // Comma-separated list of denied IPs/CIDRs
    denyIps: process.env.EDGE_DENY_IPS || '',
    // CORS allowed origin (default: '*' for all origins)
    corsOrigin: process.env.EDGE_CORS_ORIGIN || '*',
  },

  // Unsecured client token for testing purposes (client -> edge)
  // This token bypasses normal token validation and allows access to all environments
  // WARNING: Only use in development/testing environments
  unsecuredClientToken:
    process.env.EDGE_CLIENT_UNSECURED_TOKEN || 'unsecured-edge-api-token',
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.apiToken) {
    errors.push('EDGE_API_TOKEN is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
