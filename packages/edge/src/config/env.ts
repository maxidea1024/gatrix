import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  port: parseInt(process.env.EDGE_PORT || '1337', 10),
  metricsPort: parseInt(process.env.EDGE_METRICS_PORT || '9337', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Backend API configuration
  gatrixUrl: process.env.GATRIX_URL || 'http://localhost:3000',
  apiToken: process.env.EDGE_API_TOKEN || '',
  applicationName: process.env.EDGE_APPLICATION_NAME || 'edge-server',

  // SDK required fields for metrics labels and service discovery
  service: process.env.EDGE_SERVICE || 'edge',
  group: process.env.EDGE_GROUP || 'default',
  environment: process.env.EDGE_ENVIRONMENT || 'env_default',

  // Target environments (comma-separated)
  environments: (process.env.EDGE_ENVIRONMENTS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean),

  // Redis configuration (for PubSub only)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // Cache configuration
  cache: {
    pollingIntervalMs: parseInt(process.env.CACHE_POLLING_INTERVAL_MS || '60000', 10),
    syncMethod: (process.env.CACHE_SYNC_METHOD || 'polling') as 'polling' | 'event' | 'manual',
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.apiToken) {
    errors.push('EDGE_API_TOKEN is required');
  }

  if (config.environments.length === 0) {
    errors.push('EDGE_ENVIRONMENTS is required (comma-separated environment IDs)');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

