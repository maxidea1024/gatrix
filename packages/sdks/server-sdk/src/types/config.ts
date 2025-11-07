/**
 * SDK Configuration Types
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface EtcdConfig {
  hosts: string; // Comma-separated list of etcd hosts
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

export interface ServiceDiscoveryConfig {
  enabled?: boolean; // Enable service discovery (default: false)
  mode?: 'redis' | 'etcd'; // Service discovery mode (default: 'redis')
  ttlSeconds?: number; // Service heartbeat TTL in seconds (default: 30)
  terminatedTTL?: number; // Terminated service TTL in seconds (default: 300 = 5 minutes)
  heartbeatIntervalMs?: number; // Heartbeat interval in milliseconds (default: 10000)
  redis?: RedisConfig; // Redis configuration for service discovery (when mode is 'redis')
  etcd?: EtcdConfig; // etcd configuration for service discovery (when mode is 'etcd')
}

/**
 * Main SDK Configuration
 */
export interface GatrixSDKConfig {
  // Required
  gatrixUrl: string; // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // Server API Token
  applicationName: string; // Application name

  // Optional - Redis (for BullMQ events)
  redis?: RedisConfig;

  // Optional - etcd (for service discovery)
  etcd?: EtcdConfig;

  // Optional - Cache settings
  cache?: CacheConfig;

  // Optional - Logger settings
  logger?: LoggerConfig;

  // Optional - Service discovery settings
  serviceDiscovery?: ServiceDiscoveryConfig;
}

