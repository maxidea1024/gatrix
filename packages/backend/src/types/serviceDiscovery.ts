/**
 * Service Discovery Types
 *
 * Defines types for service discovery system using etcd or Redis
 */

export type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated';

export interface ServicePorts {
  tcp?: number[];
  udp?: number[];
  http?: number[];
}

export interface InstanceStats {
  cpuUsage?: number;      // CPU usage percentage (0-100)
  memoryUsage?: number;   // Memory usage in MB
  memoryTotal?: number;   // Total memory in MB
}

export interface ServiceInstance {
  instanceId: string;           // ULID
  type: string;                 // world, auth, channel, chat, etc.
  hostname: string;             // Server hostname
  externalAddress: string;      // Public IP address
  internalAddress: string;      // NIC address (internal IP)
  ports: ServicePorts;          // TCP, UDP, HTTP ports
  status: ServiceStatus;        // Current status
  updatedAt: string;            // ISO8601 timestamp
  instanceStats?: InstanceStats; // CPU, memory usage
  meta?: Record<string, any>;   // Custom metadata (e.g., user count)
}

export interface RegisterServiceInput {
  type: string;
  hostname: string;
  externalAddress: string;
  internalAddress: string;
  ports: ServicePorts;
  status?: ServiceStatus;
  instanceStats?: InstanceStats;
  meta?: Record<string, any>;
}

export interface UpdateServiceStatusInput {
  status: ServiceStatus;
  instanceStats?: InstanceStats;
  meta?: Record<string, any>;
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
   * Register a service instance
   */
  register(instance: ServiceInstance, ttlSeconds: number): Promise<void>;
  
  /**
   * Send heartbeat to keep service alive (renew TTL)
   */
  heartbeat(instanceId: string, type: string): Promise<void>;

  /**
   * Unregister a service instance
   */
  unregister(instanceId: string, type: string): Promise<void>;

  /**
   * Update service status
   */
  updateStatus(instanceId: string, type: string, status: ServiceStatus, instanceStats?: InstanceStats, meta?: Record<string, any>): Promise<void>;
  
  /**
   * Get all services or services of a specific type
   */
  getServices(type?: string): Promise<ServiceInstance[]>;
  
  /**
   * Get a specific service instance
   */
  getService(instanceId: string, type: string): Promise<ServiceInstance | null>;
  
  /**
   * Watch for service changes
   */
  watch(callback: WatchCallback): Promise<void>;
  
  /**
   * Close connections and cleanup
   */
  close(): Promise<void>;
}

