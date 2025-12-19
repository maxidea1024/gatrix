import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  port: parseInt(process.env.EDGE_PORT || '3400', 10),
  metricsPort: parseInt(process.env.EDGE_METRICS_PORT || '9400', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Backend API configuration
  gatrixUrl: process.env.GATRIX_URL || 'http://localhost:5000',

  // Edge bypass token - allows access to all environments and internal APIs
  // Can be configured via EDGE_BYPASS_TOKEN or EDGE_API_TOKEN environment variable
  apiToken: process.env.EDGE_BYPASS_TOKEN || process.env.EDGE_API_TOKEN || 'gatrix-edge-internal-bypass-token',
  applicationName: process.env.EDGE_APPLICATION_NAME || 'edge-server',

  // SDK required fields for metrics labels and service discovery
  service: process.env.EDGE_SERVICE || 'edge',
  group: process.env.EDGE_GROUP || 'gatrix',
  environment: process.env.EDGE_ENVIRONMENT || 'gatrix-env',

  // Target environments (comma-separated, or '*' for all environments)
  environments: process.env.EDGE_ENVIRONMENTS === '*'
    ? '*' as const
    : (process.env.EDGE_ENVIRONMENTS || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean),

  // Redis configuration (for cache PubSub in event mode)
  // Edge cache-specific Redis settings take priority over global settings
  redis: {
    host: process.env.EDGE_CACHE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.EDGE_CACHE_REDIS_PORT || process.env.REDIS_PORT || '6379', 10),
    password: process.env.EDGE_CACHE_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.EDGE_CACHE_REDIS_DB || process.env.REDIS_DB || '0', 10),
  },

  // Cache configuration
  cache: {
    pollingIntervalMs: parseInt(process.env.EDGE_CACHE_POLLING_INTERVAL_MS || '30000', 10),
    syncMethod: (process.env.EDGE_CACHE_SYNC_METHOD || 'polling') as 'polling' | 'event' | 'manual',
  },

  // Logging
  logLevel: process.env.EDGE_LOG_LEVEL || 'info',

  // Unsecured client token for testing purposes (client -> edge)
  // This token bypasses normal token validation and allows access to all environments
  // WARNING: Only use in development/testing environments
  unsecuredClientToken: process.env.EDGE_CLIENT_UNSECURED_TOKEN || 'gatrix-unsecured-edge-api-token',
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.apiToken) {
    errors.push('EDGE_API_TOKEN is required');
  }

  if (config.environments !== '*' && config.environments.length === 0) {
    errors.push('EDGE_ENVIRONMENTS is required (comma-separated environment IDs or "*" for all)');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
