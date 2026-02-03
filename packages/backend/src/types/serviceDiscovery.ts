/**
 * Service Discovery Types
 *
 * Defines types for service discovery system using etcd or Redis
 */

export type ServiceStatus =
  | 'initializing'
  | 'ready'
  | 'shutting_down'
  | 'error'
  | 'terminated'
  | 'no-response'
  | 'heartbeat';

/**
 * Service Ports - Named port mapping
 * Format: { serviceName: port }
 * Example: { game: 7777, internalApi: 8080, externalApi: 8081, metricsApi: 9337 }
 *
 * Common port names:
 * - game: Main game server port
 * - internalApi: Internal HTTP/REST API port (for internal services)
 * - externalApi: External HTTP/REST API port (for external access like edge servers)
 * - websocket: WebSocket server port
 * - grpc: gRPC server port
 * - metricsApi: Prometheus metrics port (default: 9337)
 */
export interface ServicePorts {
  [serviceName: string]: number;
}

/**
 * Service labels for categorization and filtering
 * Common labels:
 * - service: Service type (e.g., 'world', 'auth', 'lobby', 'chat')
 * - group: Service group (e.g., 'kr', 'us', 'eu')
 * - env: Environment (e.g., 'prod', 'staging', 'dev')
 * - region: Cloud region (e.g., 'ap-northeast-2', 'us-east-1')
 * - role: Server role (e.g., 'master', 'slave', 'worker')
 */
export interface ServiceLabels {
  service: string; // Required: Service type (e.g., 'world', 'auth', 'lobby', 'chat')
  group?: string; // Optional: Service group (e.g., 'kr', 'us', 'production')
  [key: string]: string | undefined; // Additional custom labels
}

export interface ServiceInstance {
  instanceId: string; // ULID
  labels: ServiceLabels; // Service labels for categorization
  hostname: string; // Server hostname
  externalAddress: string; // Public IP address (auto-detected from req.ip)
  internalAddress: string; // NIC address (internal IP)
  ports: ServicePorts; // TCP, UDP, HTTP ports
  status: ServiceStatus; // Current status
  createdAt: string; // ISO8601 timestamp (creation time, immutable)
  updatedAt: string; // ISO8601 timestamp (last update time)
  stats?: Record<string, any>; // Dynamic stats (e.g., cpuUsage, memoryUsage, userCount)
  meta?: Record<string, any>; // Static metadata (set at registration, immutable)
}

export interface RegisterServiceInput {
  labels: ServiceLabels; // Service labels
  hostname: string;
  internalAddress: string;
  ports: ServicePorts;
  status?: ServiceStatus;
  stats?: Record<string, any>;
  meta?: Record<string, any>;
  // Note: externalAddress is auto-detected from req.ip, not sent by client
}

export interface UpdateServiceStatusInput {
  instanceId: string; // Required for update
  labels: ServiceLabels; // Required for key generation
  status?: ServiceStatus; // Optional: update status
  stats?: Record<string, any>; // Optional: update stats (merged with existing)

  // Auto-register fields (only used when autoRegisterIfMissing=true and instance doesn't exist)
  hostname?: string; // Required for auto-register
  internalAddress?: string; // Required for auto-register
  ports?: ServicePorts; // Required for auto-register
  meta?: Record<string, any>; // Optional: static metadata (only set during auto-register)
}

export interface WatchEvent {
  type: 'put' | 'delete';
  instance: ServiceInstance;
}

export type WatchCallback = (event: WatchEvent) => void;

/**
 * Service Discovery Provider Interface
 *
 * Abstract interface for service discovery implementations (etcd, Redis)
 */
export interface IServiceDiscoveryProvider {
  /**
   * Register a service instance (full snapshot)
   */
  register(instance: ServiceInstance, ttlSeconds: number): Promise<void>;

  /**
   * Send heartbeat to keep service alive (renew TTL)
   */
  heartbeat(instanceId: string, serviceType: string): Promise<void>;

  /**
   * Unregister a service instance
   * @param forceDelete - If true, permanently delete the service. If false, mark as terminated with TTL.
   */
  unregister(instanceId: string, serviceType: string, forceDelete?: boolean): Promise<void>;

  /**
   * Update service status (partial merge)
   * @param input - Partial update input (only changed fields)
   * @param autoRegisterIfMissing - Auto-register if instance doesn't exist
   */
  updateStatus(input: UpdateServiceStatusInput, autoRegisterIfMissing?: boolean): Promise<void>;

  /**
   * Get all active services or services of a specific type and/or group
   */
  getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]>;

  /**
   * Get all inactive services (terminated, error, no-response)
   */
  getInactiveServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]>;

  /**
   * Get a specific service instance
   */
  getService(instanceId: string, serviceType: string): Promise<ServiceInstance | null>;

  /**
   * Watch for service changes
   * Returns an unwatch function to remove the callback
   */
  watch(callback: WatchCallback): Promise<() => void>;

  /**
   * Detect services with expired leases and mark them as no-response
   * (etcd only - Redis uses keyspace notifications)
   */
  detectNoResponseServices?(): Promise<void>;

  /**
   * Start background monitoring (with leader election if supported)
   */
  startMonitoring?(): Promise<void>;

  /**
   * Clean up all inactive services (terminated, error, no-response)
   * @param serviceTypes - Array of service types to clean up
   * @returns Object with deletedCount and serviceTypes
   */
  cleanupInactiveServices(
    serviceTypes: string[]
  ): Promise<{ deletedCount: number; serviceTypes: string[] }>;

  /**
   * Close connections and cleanup
   */
  close(): Promise<void>;
}
